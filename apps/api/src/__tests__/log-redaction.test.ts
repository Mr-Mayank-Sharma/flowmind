import { describe, it, expect } from "vitest";
import pino from "pino";
import {
  REDACTED,
  isSecretField,
  redactSecrets,
  scrubText,
  buildLoggerOptions,
} from "../lib/log-redaction";
import { logSink } from "./helpers/log-sink";

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk";

function collectingLogger() {
  const sink = logSink();
  return { sink, logger: pino({ ...buildLoggerOptions(), level: "info" }, sink.stream) };
}

describe("isSecretField", () => {
  it("matches secret fields however they are spelled", () => {
    for (const name of [
      "authorization",
      "Authorization",
      "X-Internal-Token",
      "x_internal_token",
      "xInternalToken",
      "hub.verify_token",
      "passwordHash",
      "api_key",
      "STRIPE_SIGNATURE",
    ]) {
      expect(isSecretField(name), name).toBe(true);
    }
  });

  it("matches secret-shaped suffixes so provider credentials are covered", () => {
    expect(isSecretField("openaiApiKey")).toBe(true);
    expect(isSecretField("slackBotToken")).toBe(true);
    expect(isSecretField("signingSecret")).toBe(true);
  });

  it("does not match ordinary words that merely end in a secret-ish suffix", () => {
    for (const name of ["keywords", "maxTokens", "monkey", "tokenizer", "signaturePad", "userId"]) {
      expect(isSecretField(name), name).toBe(false);
    }
  });
});

describe("scrubText", () => {
  it("masks a bearer token but keeps the scheme readable", () => {
    const scrubbed = scrubText("Authorization: Bearer abc123.SECRET-part_here==");
    expect(scrubbed).toBe(`Authorization: Bearer ${REDACTED}`);
    expect(scrubbed).not.toContain("SECRET-part");
  });

  it("masks a bare JWT wherever it appears in a message", () => {
    const scrubbed = scrubText(`login failed for token ${JWT}`);
    expect(scrubbed).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(scrubbed).toBe(`login failed for token ${REDACTED}`);
  });

  it("masks every token in a text holding several", () => {
    const scrubbed = scrubText(`a=${JWT} b=Bearer zzz.top`);
    expect(scrubbed).not.toContain("eyJ");
    expect(scrubbed).not.toContain("zzz.top");
  });

  it("leaves harmless text untouched", () => {
    expect(scrubText("pipeline run finished in 42ms")).toBe("pipeline run finished in 42ms");
  });
});

describe("redactSecrets", () => {
  it("masks secret fields at any depth", () => {
    const redacted = redactSecrets({
      event: "provider call",
      credentials: { openaiApiKey: "sk-live-abc", region: "eu" },
      headers: { authorization: "Bearer abc" },
    });

    expect(redacted.credentials.openaiApiKey).toBe(REDACTED);
    // A sibling field that merely looks similar must survive.
    expect(redacted.credentials.region).toBe("eu");
    expect(redacted.headers.authorization).toBe(REDACTED);
    expect(redacted.event).toBe("provider call");
  });

  it("walks arrays and masks inside them", () => {
    const redacted = redactSecrets({ items: [{ token: "t1" }, { token: "t2", id: 7 }] });
    expect(redacted.items[0]!.token).toBe(REDACTED);
    expect(redacted.items[1]!.token).toBe(REDACTED);
    expect(redacted.items[1]!.id).toBe(7);
  });

  it("keeps an error's name, message and stack while masking secrets inside them", () => {
    const redacted = redactSecrets({
      err: new Error(`request to https://api.example.com/v1?key=${JWT} failed`),
    });

    expect(redacted.err.name).toBe("Error");
    expect(redacted.err.message).not.toContain("eyJ");
    expect(redacted.err.stack).toBeTruthy();
    expect(redacted.err.stack).not.toContain("eyJhbGciOiJIUzI1NiJ9");
  });

  it("copies rather than mutating its input", () => {
    const original = { apiKey: "sk-live-abc", nested: { secret: "s" } };
    const redacted = redactSecrets(original);

    expect(original.apiKey).toBe("sk-live-abc");
    expect(redacted).not.toBe(original);
    expect(redacted.nested).not.toBe(original.nested);
  });

  it("survives a cycle instead of overflowing the stack", () => {
    const cyclic: Record<string, unknown> = { name: "loop" };
    cyclic.self = cyclic;

    const redacted = redactSecrets(cyclic) as Record<string, unknown>;

    expect(redacted.name).toBe("loop");
    expect(redacted.self).toBe("[circular]");
  });

  it("does not mistake a repeated sibling for a cycle", () => {
    const shared = { id: "same" };
    const redacted = redactSecrets({ left: shared, right: shared });

    expect(redacted.left).toEqual({ id: "same" });
    expect(redacted.right).toEqual({ id: "same" });
    expect(redacted.left).not.toBe("[circular]");
  });

  it("passes primitives and dates through unchanged", () => {
    const when = new Date("2026-01-01T00:00:00.000Z");
    const redacted = redactSecrets({ when, count: 3, missing: null, off: false });
    expect(redacted.when).toBe(when);
    expect(redacted.count).toBe(3);
    expect(redacted.missing).toBeNull();
    expect(redacted.off).toBe(false);
  });
});

describe("the logMethod hook", () => {
  it("masks secrets in a structured log call", () => {
    const { sink, logger } = collectingLogger();

    logger.info({ event: "provider call", apiKey: "sk-live-abc", model: "gpt-4" }, "calling provider");

    const entry = sink.entries()[0]!;
    expect(entry.apiKey).toBe(REDACTED);
    expect(entry.model).toBe("gpt-4");
    expect(entry.msg).toBe("calling provider");
  });

  it("masks a token embedded in the log message itself", () => {
    const { sink, logger } = collectingLogger();

    logger.warn(`rejected Authorization: Bearer ${JWT}`);

    expect(sink.lines[0]).not.toContain("eyJ");
    expect(sink.lines[0]).toContain(REDACTED);
  });

  it("masks secrets bound onto a child logger, which the hook alone cannot reach", () => {
    const { sink, logger } = collectingLogger();

    logger.child({ req: { headers: { authorization: "Bearer abc123" } } }).info("handling request");

    expect(sink.lines[0]).not.toContain("abc123");
    expect(sink.lines[0]).toContain(REDACTED);
  });

  it("masks a nested payload that the hook would otherwise pass through", () => {
    const { sink, logger } = collectingLogger();

    logger.info({ result: { payload: { password: "hunter2" } } }, "ran skill");

    expect(sink.lines[0]).not.toContain("hunter2");
    expect(sink.lines[0]).toContain(REDACTED);
  });
});
