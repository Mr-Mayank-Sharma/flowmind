import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => {
  let queryResult: unknown = { rows: [], rowCount: 0, fields: [] };
  class PgClientMock {
    static instances: PgClientMock[] = [];
    opts: { connectionString: string };
    connect = vi.fn(async () => {});
    query = vi.fn(async () => queryResult);
    end = vi.fn(async () => {});
    constructor(opts: { connectionString: string }) {
      this.opts = opts;
      PgClientMock.instances.push(this);
    }
  }
  return {
    dnsLookup: vi.fn(),
    PgClient: PgClientMock,
    setQueryResult: (r: unknown) => {
      queryResult = r;
    },
  };
});

vi.mock("node:dns/promises", () => ({
  default: { lookup: mocks.dnsLookup },
}));

vi.mock("pg", () => ({ Client: mocks.PgClient }));

import { assertPublicHttpUrl, fetchPublic, BlockedUrlError } from "../network-guard";
import { runCodeSandboxed } from "../code-sandbox";
import { getRunner } from "../runners";
import type { ExecutionContext, PipelineNode } from "../types";

function makeContext(): ExecutionContext {
  return {
    runId: "test-run",
    pipelineId: "test-pipeline",
    graph: { nodes: [], edges: [] },
    input: {},
    outputs: new Map(),
    variables: {},
    staticData: {},
    nodeStaticData: new Map(),
    binaryData: new Map(),
    abortSignal: new AbortController().signal,
  };
}

function dbNode(config: Record<string, unknown>): PipelineNode {
  return { id: "n1", type: "databaseQuery", label: "DB", position: { x: 0, y: 0 }, config };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.DATABASE_URL;
  mocks.setQueryResult({ rows: [], rowCount: 0, fields: [] });
  mocks.PgClient.instances.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.DATABASE_URL;
});

describe("assertPublicHttpUrl", () => {
  const blocked = [
    "http://127.0.0.1:9000/x",
    "http://0.0.0.0:80/x",
    "http://10.0.0.5/x",
    "http://100.64.0.1/x",
    "http://169.254.169.254/latest/meta-data",
    "http://172.16.0.1/x",
    "http://192.168.1.1/x",
  ];

  for (const url of blocked) {
    it(`rejects ${new URL(url).hostname}`, async () => {
      await expect(assertPublicHttpUrl(url, false)).rejects.toThrow(BlockedUrlError);
      expect(mocks.dnsLookup).not.toHaveBeenCalled();
    });
  }

  it("rejects IPv6 loopback", async () => {
    await expect(assertPublicHttpUrl("http://[::1]/x", false)).rejects.toThrow(BlockedUrlError);
  });

  it("rejects an IPv4-mapped loopback address", async () => {
    await expect(assertPublicHttpUrl("http://[::ffff:127.0.0.1]/x", false)).rejects.toThrow(BlockedUrlError);
  });

  it("rejects a hostname resolving to a private address", async () => {
    mocks.dnsLookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);

    await expect(assertPublicHttpUrl("https://evil.internal/x", false)).rejects.toThrow(/resolves to 10\.0\.0\.5/);
    expect(mocks.dnsLookup).toHaveBeenCalledWith("evil.internal", { all: true });
  });

  it("accepts a public IP and a resolving public hostname", async () => {
    await expect(assertPublicHttpUrl("https://93.184.216.34/path", false)).resolves.toBeInstanceOf(URL);
    mocks.dnsLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    await expect(assertPublicHttpUrl("https://example.com/path", false)).resolves.toBeInstanceOf(URL);
  });

  it("allows private URLs when the operator explicitly opts in", async () => {
    await expect(assertPublicHttpUrl("http://10.0.0.5/x", true)).resolves.toBeInstanceOf(URL);
  });

  it("rejects non-http protocols", async () => {
    await expect(assertPublicHttpUrl("file:///etc/passwd", false)).rejects.toThrow(/Only http\/https URLs are allowed/);
    await expect(assertPublicHttpUrl("ftp://example.com/x", false)).rejects.toThrow(/Only http\/https URLs are allowed/);
  });
});

describe("fetchPublic", () => {
  it("never fetches a blocked target", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublic("http://127.0.0.1:9000/x")).rejects.toThrow(BlockedUrlError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("re-validates every redirect hop and blocks a redirect into a private range", async () => {
    mocks.dnsLookup.mockImplementation((host: string) =>
      host === "public.example"
        ? [{ address: "93.184.216.34", family: 4 }]
        : [{ address: "127.0.0.1", family: 4 }],
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "http://192.168.1.2/steal" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublic("https://public.example/start")).rejects.toThrow(BlockedUrlError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("follows safe redirects and returns the final response", async () => {
    mocks.dnsLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://public.example/final" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchPublic("https://public.example/start");

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("runCodeSandboxed", () => {
  it("returns the evaluated result of benign code", async () => {
    const { output } = await runCodeSandboxed("return 2 + 2", {});
    expect(output).toBe(4);
  });

  it("exposes no host globals to the isolate", async () => {
    const { output } = await runCodeSandboxed(
      "return { require: typeof require, process: typeof process, fetch: typeof fetch, module: typeof module }",
      {},
    );

    expect(output).toMatchObject({
      require: "undefined",
      process: "undefined",
      fetch: "undefined",
      module: "undefined",
    });
  });

  it("enforces the timeout on runaway code", async () => {
    await expect(runCodeSandboxed("while (true) {}", {}, { timeoutMs: 200 })).rejects.toThrow(
      /Code execution failed/,
    );
  });
});

describe("databaseQuery runner", () => {
  it("blocks a custom connection string without constructing a pg client", async () => {
    const runner = getRunner("databaseQuery")!;
    const result = await runner(dbNode({ query: "SELECT 1", connectionString: "postgres://evil" }), makeContext());

    expect(result).toMatchObject({ rows: [], rowCount: 0 });
    expect((result as { error: string }).error).toContain("custom connection string is not supported");
    expect(mocks.PgClient.instances.length).toBe(0);
  });

  it("requires a server-configured DATABASE_URL", async () => {
    const runner = getRunner("databaseQuery")!;
    const result = await runner(dbNode({ query: "SELECT 1" }), makeContext());

    expect((result as { error: string }).error).toContain("No server DATABASE_URL configured");
    expect(mocks.PgClient.instances.length).toBe(0);
  });

  it("permits only single read-only statements", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@db.internal:5432/flowmind";
    const runner = getRunner("databaseQuery")!;

    const multi = (await runner(dbNode({ query: "SELECT 1; SELECT 2" }), makeContext())) as { error: string };
    const dml = (await runner(dbNode({ query: "INSERT INTO users (id) VALUES (1)" }), makeContext())) as { error: string };
    const empty = (await runner(dbNode({ query: "" }), makeContext())) as { error: string };

    expect(multi.error).toContain("single statement");
    expect(dml.error).toContain("read-only SELECT");
    expect(empty.error).toContain("requires a query");
    expect(mocks.PgClient.instances.length).toBe(0);
  });

  it("executes a safe SELECT against the pg client", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@db.internal:5432/flowmind";
    mocks.setQueryResult({ rows: [{ id: 1 }], rowCount: 1, fields: [{ name: "id" }] });

    const runner = getRunner("databaseQuery")!;
    const result = await runner(dbNode({ query: "SELECT id FROM users" }), makeContext());

    expect(result).toMatchObject({ rows: [{ id: 1 }], rowCount: 1 });
    expect(mocks.PgClient.instances.length).toBe(1);
    expect(mocks.PgClient.instances[0]!.opts).toEqual({ connectionString: process.env.DATABASE_URL });
    expect(mocks.PgClient.instances[0]!.connect).toHaveBeenCalledTimes(1);
    expect(mocks.PgClient.instances[0]!.query).toHaveBeenCalledWith("SELECT id FROM users");
    expect(mocks.PgClient.instances[0]!.end).toHaveBeenCalledTimes(1);
  });
});