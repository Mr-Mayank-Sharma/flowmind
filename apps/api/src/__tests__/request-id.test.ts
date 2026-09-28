import { describe, it, expect } from "vitest";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import pino from "pino";
import {
  REQUEST_ID_HEADER,
  newRequestId,
  parseIncomingRequestId,
  resolveRequestId,
} from "../lib/request-id";
import { buildLoggerOptions } from "../lib/log-redaction";
import { genRequestId, registerRequestLogging } from "../plugins/request-logging";
import { logSink, type LogSink } from "./helpers/log-sink";

const UUID = /^[0-9a-f-]{36}$/;

function serverWithSink(): { server: FastifyInstance; sink: LogSink } {
  const sink = logSink();
  // Built from the same options production uses, so the hooks run against the real
  // logger rather than a stand-in. The destination has to be bound here, at
  // construction: Fastify derives `req.log` from this logger, so a destination attached
  // later would leave every request log going to stdout.
  const server = Fastify({
    genReqId: genRequestId,
    logger: pino({ ...buildLoggerOptions(), level: "info" }, sink.stream) as FastifyBaseLogger,
  });
  registerRequestLogging(server);
  return { server, sink };
}

describe("request id parsing", () => {
  it("accepts an id that is safe to echo in a header and a log line", () => {
    expect(parseIncomingRequestId("req-abc_123.4:5")).toBe("req-abc_123.4:5");
  });

  it("uses only the first value when the header was repeated", () => {
    expect(parseIncomingRequestId(["first", "second"])).toBe("first");
  });

  it("trims surrounding whitespace before judging the id", () => {
    expect(parseIncomingRequestId("  padded-id  ")).toBe("padded-id");
  });

  it("discards an id that could break a header or a log line", () => {
    for (const hostile of ["has space", "has\nnewline", 'has"quote', "", "x".repeat(129)]) {
      expect(parseIncomingRequestId(hostile), JSON.stringify(hostile)).toBeNull();
    }
  });

  it("treats a missing header as no id at all", () => {
    expect(parseIncomingRequestId(undefined)).toBeNull();
    expect(parseIncomingRequestId(null)).toBeNull();
  });

  it("falls back to a fresh uuid rather than repairing a bad id", () => {
    expect(parseIncomingRequestId("not safe")).toBeNull();
    expect(resolveRequestId("not safe")).toMatch(UUID);
  });

  it("generates distinct ids", () => {
    expect(newRequestId()).not.toBe(newRequestId());
  });
});

describe("request id propagation through a router", () => {
  it("echoes an inherited id in the response header and in the completion log", async () => {
    const { server, sink } = serverWithSink();
    server.get("/trpc/thing.get", async () => ({ ok: true }));
    await server.ready();

    const response = await server.inject({
      method: "GET",
      url: "/trpc/thing.get",
      headers: { [REQUEST_ID_HEADER]: "inherited-id-1" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers[REQUEST_ID_HEADER]).toBe("inherited-id-1");

    const completion = sink.find((e) => e.event === "request.completed");
    expect(completion).toBeDefined();
    expect(completion?.requestId).toBe("inherited-id-1");
    // The route template, not the raw url, so one operation is one log line.
    expect(completion?.operation).toBe("/trpc/thing.get");
    expect(completion?.status).toBe(200);
    expect(typeof completion?.durationMs).toBe("number");
    expect(completion?.userId).toBeNull();
  });

  it("generates an id when the caller sends none, and reports it the same way", async () => {
    const { server, sink } = serverWithSink();
    server.get("/trpc/thing.list", async () => ({ ok: true }));
    await server.ready();

    const response = await server.inject({ method: "GET", url: "/trpc/thing.list" });
    const generated = response.headers[REQUEST_ID_HEADER] as string;

    expect(generated).toMatch(UUID);
    expect(sink.find((e) => e.event === "request.completed")?.requestId).toBe(generated);
  });

  it("replaces a hostile id rather than reflecting it back", async () => {
    const { server, sink } = serverWithSink();
    server.get("/trpc/thing.get", async () => ({ ok: true }));
    await server.ready();

    const response = await server.inject({
      method: "GET",
      url: "/trpc/thing.get",
      headers: { [REQUEST_ID_HEADER]: "bad id with spaces" },
    });

    const header = response.headers[REQUEST_ID_HEADER] as string;
    expect(header).not.toBe("bad id with spaces");
    expect(header).toMatch(UUID);
    expect(sink.find((e) => e.event === "request.completed")?.requestId).toBe(header);
  });

  it("reports the user the request was attributed to", async () => {
    const { server, sink } = serverWithSink();
    server.get("/trpc/thing.get", async (req) => {
      // `createContext` attributes the request this way; the completion log reads it back.
      (req as typeof req & { userId?: string }).userId = "user-1";
      return { ok: true };
    });
    await server.ready();

    await server.inject({ method: "GET", url: "/trpc/thing.get" });

    expect(sink.find((e) => e.event === "request.completed")?.userId).toBe("user-1");
  });

  it("logs a failing request the same way as a succeeding one", async () => {
    const { server, sink } = serverWithSink();
    server.get("/trpc/thing.boom", async () => {
      throw new Error("handler exploded");
    });
    await server.ready();

    const response = await server.inject({ method: "GET", url: "/trpc/thing.boom" });

    expect(response.statusCode).toBe(500);
    const completion = sink.find((e) => e.event === "request.completed");
    expect(completion?.status).toBe(500);
    expect(completion?.operation).toBe("/trpc/thing.boom");
    expect(typeof completion?.durationMs).toBe("number");
  });
});
