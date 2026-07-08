import { describe, it, expect } from "vitest";
import { PipelineEngine } from "../engine";
import type { PipelineGraph } from "../types";

const engine = new PipelineEngine();

describe("PipelineEngine", () => {
  it("accepts empty inputs (returns success with no outputs)", async () => {
    const result = await engine.execute("r1", "p1", { nodes: [], edges: [] }, {});
    expect(result.status).toBe("success");
  });

  it("executes a simple trigger to httpRequest pipeline", async () => {
    const graph: PipelineGraph = {
      nodes: [
        { id: "n1", type: "manualTrigger", label: "Start", position: { x: 0, y: 0 }, config: {} },
        { id: "n2", type: "httpRequest", label: "Fetch", position: { x: 200, y: 0 }, config: { url: "https://httpbin.org/get" } },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
    };

    const result = await engine.execute("r1", "p1", graph, {});
    expect(result.status).toBe("success");
    expect(result.outputs).toHaveLength(2);
    expect(result.outputs[0]!.nodeId).toBe("n1");
    expect(result.outputs[1]!.nodeId).toBe("n2");
    expect((result.outputs[1]!.output as any).status).toBe(200);
  }, 15_000);

  it("executes codeExecute node within a pipeline", async () => {
    const graph: PipelineGraph = {
      nodes: [
        { id: "n1", type: "manualTrigger", label: "Start", position: { x: 0, y: 0 }, config: {} },
        { id: "n2", type: "codeExecute", label: "Compute", position: { x: 200, y: 0 }, config: { language: "javascript", code: "return $json.value * 2" } },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
    };

    const result = await engine.execute("r2", "p1", graph, { value: 21 });
    expect(result.status).toBe("success");
    const lastOutput = result.outputs[result.outputs.length - 1]!.output as any;
    expect(lastOutput.result).toBe(42);
  }, 15_000);

  it("executes condition and follows the path", async () => {
    const graph: PipelineGraph = {
      nodes: [
        { id: "n1", type: "manualTrigger", label: "Start", position: { x: 0, y: 0 }, config: {} },
        { id: "n2", type: "condition", label: "Check", position: { x: 200, y: 0 }, config: { condition: "true" } },
        { id: "n3", type: "httpRequest", label: "Success", position: { x: 400, y: -100 }, config: { url: "https://httpbin.org/get" } },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
      ],
    };

    const result = await engine.execute("r3", "p1", graph, {});
    expect(result.status).toBe("success");
    expect(result.outputs).toHaveLength(3);
  }, 15_000);

  it("reports error when a node fails", async () => {
    const graph: PipelineGraph = {
      nodes: [
        { id: "n1", type: "manualTrigger", label: "Start", position: { x: 0, y: 0 }, config: {} },
        { id: "n2", type: "httpRequest", label: "BadURL", position: { x: 200, y: 0 }, config: { url: "https://nonexistent.invalid" } },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
    };

    const result = await engine.execute("r4", "p1", graph, {});
    expect(result.status).toBe("error");
    expect(result.outputs[1]!.error).toBeDefined();
  }, 15_000);

  it("returns runId and timing info", async () => {
    const graph: PipelineGraph = {
      nodes: [
        { id: "n1", type: "manualTrigger", label: "Start", position: { x: 0, y: 0 }, config: {} },
      ],
      edges: [],
    };

    const result = await engine.execute("r5", "p1", graph, {});
    expect(result.runId).toBe("r5");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.startedAt).toBeLessThanOrEqual(result.completedAt!);
  });
});
