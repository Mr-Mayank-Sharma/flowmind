import { describe, it, expect, vi, afterEach } from "vitest";
import { executeNode, getRunner } from "../runners";
import type { PipelineNode, ExecutionContext, PipelineGraph, NodeOutput } from "../types";

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
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
    ...overrides,
  };
}

function addOutput(ctx: ExecutionContext, nodeId: string, output: unknown): void {
  const nodeOutput: NodeOutput = {
    nodeId,
    nodeType: "httpRequest",
    output,
    durationMs: 10,
    timestamp: Date.now(),
  };
  ctx.outputs.set(nodeId, nodeOutput);
}

describe("getRunner", () => {
  it("returns a runner for known node types", () => {
    expect(getRunner("manualTrigger")).toBeDefined();
    expect(getRunner("httpRequest")).toBeDefined();
    expect(getRunner("summarizer")).toBeDefined();
    expect(getRunner("condition")).toBeDefined();
    expect(getRunner("codeExecute")).toBeDefined();
  });

  it("returns undefined for unknown node types", () => {
    expect(getRunner("nonexistent")).toBeUndefined();
  });
});

describe("executeNode", () => {
  it("returns error output for unknown node type", async () => {
    const node: PipelineNode = { id: "n1", type: "manualTrigger", label: "X", position: { x: 0, y: 0 }, config: {} };
    (node as any).type = "unknown";
    const result = await executeNode(node as any, makeContext());
    expect(result.error).toBeDefined();
  });

  it("executes manual trigger and returns triggered=true", async () => {
    const node: PipelineNode = { id: "n1", type: "manualTrigger", label: "Start", position: { x: 0, y: 0 }, config: {} };
    const result = await executeNode(node, makeContext());
    expect(result.nodeId).toBe("n1");
    expect((result.output as any).triggered).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("executes wait node with correct delay", async () => {
    const node: PipelineNode = { id: "n1", type: "wait", label: "Wait", position: { x: 0, y: 0 }, config: { durationMs: 50 } };
    const start = Date.now();
    const result = await executeNode(node, makeContext());
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
    expect((result.output as any).waited).toBe(true);
  });

  it("executes condition node with $json from predecessor outputs", async () => {
    const node: PipelineNode = { id: "n2", type: "condition", label: "Check", position: { x: 0, y: 0 }, config: { condition: "$json.value > 5" } };
    const ctx = makeContext();
    // Condition reads $json from outputs' .json property
    addOutput(ctx, "n1", { json: { value: 10 } });
    ctx.graph = {
      nodes: [
        { id: "n1", type: "httpRequest", label: "", position: { x: 0, y: 0 }, config: {} },
        node,
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
    };
    const result = await executeNode(node, ctx);
    expect((result.output as any).result).toBe(true);
  });

  it("executes httpRequest and returns mocked response", async () => {
    const responseBody = { args: {}, origin: "127.0.0.1" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: { entries: () => [["content-type", "application/json"]] },
      text: () => Promise.resolve(JSON.stringify(responseBody)),
    }));

    const node: PipelineNode = { id: "n1", type: "httpRequest", label: "Fetch", position: { x: 0, y: 0 }, config: { url: "https://httpbin.org/get", method: "GET" } };
    const ctx = makeContext();
    const result = await executeNode(node, ctx);
    expect((result.output as any).status).toBe(200);
    expect((result.output as any).body).toEqual(responseBody);
  });

  it.skip("executes httpRequest with real fetch (integration)", async () => {
    vi.setConfig({ testTimeout: 15_000 });
    const node: PipelineNode = { id: "n1", type: "httpRequest", label: "Fetch", position: { x: 0, y: 0 }, config: { url: "https://httpbin.org/get", method: "GET" } };
    const ctx = makeContext();
    const result = await executeNode(node, ctx);
    expect((result.output as any).status).toBe(200);
  });

  it("executes codeExecute for JavaScript", async () => {
    const node: PipelineNode = { id: "n1", type: "codeExecute", label: "Code", position: { x: 0, y: 0 }, config: { language: "javascript", code: "return 2 + 2" } };
    const result = await executeNode(node, makeContext());
    expect((result.output as any).result).toBe(4);
  });

  it("executes switch and returns the resolved expression value", async () => {
    const node: PipelineNode = { id: "n1", type: "switch", label: "Switch", position: { x: 0, y: 0 }, config: { expression: "'active'", cases: "active,inactive" } };
    const result = await executeNode(node, makeContext());
    const val = (result.output as any).value;
    expect(val).toMatch(/active/);
  });

  it("resolves expressions in condition using predecessor data", async () => {
    const node: PipelineNode = { id: "n2", type: "condition", label: "Check", position: { x: 0, y: 0 }, config: { condition: "$json.status === 'ok'" } };
    const ctx = makeContext();
    addOutput(ctx, "n1", { json: { status: "ok" } });
    ctx.graph = {
      nodes: [
        { id: "n1", type: "httpRequest", label: "", position: { x: 0, y: 0 }, config: {} },
        node,
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
    };
    const result = await executeNode(node, ctx);
    expect((result.output as any).result).toBe(true);
  });

  it("resolves expressions in loop", async () => {
    const node: PipelineNode = { id: "n1", type: "loop", label: "Loop", position: { x: 0, y: 0 }, config: { iterations: 5 } };
    const result = await executeNode(node, makeContext());
    expect((result.output as any).iterations).toBe(5);
  });

  it("handles merge with predecessor data", async () => {
    const ctx = makeContext();
    addOutput(ctx, "n0", { data: "hello" });
    ctx.graph = {
      nodes: [
        { id: "n0", type: "httpRequest", label: "", position: { x: 0, y: 0 }, config: {} },
        { id: "n1", type: "merge", label: "", position: { x: 100, y: 0 }, config: {} },
      ],
      edges: [{ id: "e1", source: "n0", target: "n1" }],
    };
    const node = ctx.graph.nodes[1]!;
    const result = await executeNode(node, ctx);
    expect((result.output as any).merged).toBe(true);
    expect((result.output as any).inputs).toHaveProperty("n0");
  });
});
