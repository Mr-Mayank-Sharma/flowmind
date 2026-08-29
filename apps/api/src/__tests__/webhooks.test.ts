import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const WEBHOOK_ENV_KEYS = [
  "TELEGRAM_WEBHOOK_SECRET",
  "SLACK_WEBHOOK_SECRET",
  "DISCORD_WEBHOOK_SECRET",
  "WHATSAPP_WEBHOOK_SECRET",
  "WEBHOOK_SECRET",
  "ALLOW_UNVERIFIED_WEBHOOKS",
  "NODE_ENV",
] as const;

const fetchMock = vi.fn();

async function loadRouter(env: Partial<Record<string, string>> = {}) {
  for (const key of WEBHOOK_ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  vi.resetModules();
  const mod = await import("../routers/webhooks");
  return mod.webhooksRouter;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of WEBHOOK_ENV_KEYS) delete process.env[key];
});

describe("webhooksRouter.telegram secret verification", () => {
  it("rejects a wrong secret without contacting the agent runtime", async () => {
    const router = await loadRouter({ TELEGRAM_WEBHOOK_SECRET: "expected-secret" });
    const caller = router.createCaller({} as never);

    const err = await caller
      .telegram({ body: { message: { text: "hi", from: { id: "1" }, chat: { id: "c1" } } }, secret: "wrong" })
      .catch((e: Error) => e);

    expect(err).toMatchObject({ code: "UNAUTHORIZED" });
    expect(err.message).toContain("Invalid webhook secret for telegram");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards a verified payload", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    const router = await loadRouter({ TELEGRAM_WEBHOOK_SECRET: "expected-secret" });
    const caller = router.createCaller({} as never);

    const result = await caller.telegram({
      body: { message: { text: "hi", from: { id: "abc" }, chat: { id: "chat-1" } } },
      secret: "expected-secret",
    });

    expect(result.received).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8001/webhook/ingest",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("permits unverified requests in development only", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    const router = await loadRouter();
    const caller = router.createCaller({} as never);

    const result = await caller.telegram({ body: { message: { text: "hi" } } });

    expect(result.received).toBe(true);
  });

  it("rejects unverified requests in production", async () => {
    const router = await loadRouter({ NODE_ENV: "production" });
    const caller = router.createCaller({} as never);

    const err = await caller.telegram({ body: { message: { text: "hi" } } }).catch((e: Error) => e);

    expect(err).toMatchObject({ code: "UNAUTHORIZED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("honors an explicit opt-in to unverified webhooks in production", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    const router = await loadRouter({ NODE_ENV: "production", ALLOW_UNVERIFIED_WEBHOOKS: "true" });
    const caller = router.createCaller({} as never);

    const result = await caller.telegram({ body: { message: { text: "hi" } } });

    expect(result.received).toBe(true);
  });
});

describe("webhooksRouter.telegram forwarding failures", () => {
  it("surfaces an unreachable agent runtime as BAD_GATEWAY", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const router = await loadRouter({ TELEGRAM_WEBHOOK_SECRET: "expected-secret" });
    const caller = router.createCaller({} as never);

    const err = await caller
      .telegram({ body: { message: { text: "hi" } }, secret: "expected-secret" })
      .catch((e: Error) => e);

    expect(err).toMatchObject({ code: "BAD_GATEWAY" });
    expect(err.message).toContain("Agent runtime unreachable");
  });

  it("surfaces a non-2xx runtime response as BAD_GATEWAY", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));

    const router = await loadRouter({ TELEGRAM_WEBHOOK_SECRET: "expected-secret" });
    const caller = router.createCaller({} as never);

    const err = await caller
      .telegram({ body: { message: { text: "hi" } }, secret: "expected-secret" })
      .catch((e: Error) => e);

    expect(err).toMatchObject({ code: "BAD_GATEWAY" });
    expect(err.message).toContain("rejected telegram webhook with status 500");
  });
});