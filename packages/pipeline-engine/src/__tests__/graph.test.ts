import { describe, it, expect } from "vitest";
import { validateGraph, buildExecutionPlan, getDirectPredecessors, getSourceNodes, getLeafNodes } from "../graph";
import type { PipelineGraph } from "../types";

const validGraph: PipelineGraph = {
  nodes: [
    { id: "n1", type: "manualTrigger", label: "Start", position: { x: 0, y: 0 }, config: {} },
    { id: "n2", type: "httpRequest", label: "Fetch", position: { x: 200, y: 0 }, config: { url: "https://example.com" } },
    { id: "n3", type: "summarizer", label: "Summarize", position: { x: 400, y: 0 }, config: {} },
  ],
  edges: [
    { id: "e1", source: "n1", target: "n2" },
    { id: "e2", source: "n2", target: "n3" },
  ],
};

describe("validateGraph", () => {
  it("returns empty for a valid graph", () => {
    expect(validateGraph(validGraph)).toEqual([]);
  });

  it("accepts empty graph", () => {
    expect(validateGraph({ nodes: [], edges: [] })).toEqual([]);
  });

  it("returns error for cyclic graph", () => {
    const cyclic: PipelineGraph = {
      nodes: [
        { id: "n1", type: "manualTrigger", label: "S", position: { x: 0, y: 0 }, config: {} },
        { id: "n2", type: "httpRequest", label: "A", position: { x: 200, y: 0 }, config: {} },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n1" },
      ],
    };
    const errs = validateGraph(cyclic);
    expect(errs.length).toBeGreaterThan(0);
  });

  it("reports dangling edges", () => {
    const errs = validateGraph({
      nodes: [
        { id: "n1", type: "manualTrigger", label: "Start", position: { x: 0, y: 0 }, config: {} },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
    });
    expect(errs.some((e) => e.includes("n2"))).toBe(true);
  });
});

describe("buildExecutionPlan", () => {
  it("returns execution order", () => {
    const plan = buildExecutionPlan(validGraph);
    expect(plan.executionOrder).toBeDefined();
    expect(plan.executionOrder.length).toBe(3);
    expect(plan.executionOrder[0]).toBe("n1");
    expect(plan.executionOrder[1]).toBe("n2");
    expect(plan.executionOrder[2]).toBe("n3");
  });

  it("handles parallel branches in execution order", () => {
    const parallel: PipelineGraph = {
      nodes: [
        { id: "n1", type: "manualTrigger", label: "Start", position: { x: 0, y: 0 }, config: {} },
        { id: "n2", type: "httpRequest", label: "A", position: { x: 200, y: -100 }, config: {} },
        { id: "n3", type: "httpRequest", label: "B", position: { x: 200, y: 100 }, config: {} },
        { id: "n4", type: "merge", label: "Merge", position: { x: 400, y: 0 }, config: {} },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n1", target: "n3" },
        { id: "e3", source: "n2", target: "n4" },
        { id: "e4", source: "n3", target: "n4" },
      ],
    };
    const plan = buildExecutionPlan(parallel);
    expect(plan.executionOrder.length).toBe(4);
    expect(plan.executionOrder[0]).toBe("n1");
    expect(plan.executionOrder[3]).toBe("n4");
  });
});

describe("getSourceNodes", () => {
  it("returns nodes with no incoming edges", () => {
    const sources = getSourceNodes(validGraph);
    expect(sources).toHaveLength(1);
    expect(sources[0]!.id).toBe("n1");
  });
});

describe("getLeafNodes", () => {
  it("returns nodes with no outgoing edges", () => {
    const leaves = getLeafNodes(validGraph);
    expect(leaves).toHaveLength(1);
    expect(leaves[0]!.id).toBe("n3");
  });
});

describe("getDirectPredecessors", () => {
  it("returns connected predecessors", () => {
    const preds = getDirectPredecessors("n3", validGraph.edges);
    expect(preds).toHaveLength(1);
    expect(preds[0]!.source).toBe("n2");
  });

  it("returns empty for root node", () => {
    const preds = getDirectPredecessors("n1", validGraph.edges);
    expect(preds).toHaveLength(0);
  });
});
