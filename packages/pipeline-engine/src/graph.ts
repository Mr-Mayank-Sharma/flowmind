import type { PipelineGraph, PipelineNode, PipelineEdge, ExecutionPlan } from "./types"

export function topologicalSort(graph: PipelineGraph): string[] {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]))
  const edges = graph.edges
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const n of graph.nodes) {
    inDegree.set(n.id, 0)
    adjacency.set(n.id, [])
  }

  for (const e of edges) {
    adjacency.get(e.source)?.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const sorted: string[] = []
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    sorted.push(nodeId)
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDeg)
      if (newDeg === 0) queue.push(neighbor)
    }
  }

  if (sorted.length !== graph.nodes.length) {
    throw new Error("Graph contains a cycle")
  }

  return sorted
}

export function getSourceNodes(graph: PipelineGraph): PipelineNode[] {
  const targets = new Set(graph.edges.map((e) => e.target))
  return graph.nodes.filter((n) => !targets.has(n.id))
}

export function getLeafNodes(graph: PipelineGraph): PipelineNode[] {
  const sources = new Set(graph.edges.map((e) => e.source))
  return graph.nodes.filter((n) => !sources.has(n.id))
}

export function getUpstreamNodes(nodeId: string, graph: PipelineGraph): PipelineNode[] {
  const visited = new Set<string>()
  const result: PipelineNode[] = []
  const walk = (id: string) => {
    if (visited.has(id)) return
    visited.add(id)
    const node = graph.nodes.find((n) => n.id === id)
    if (node) result.push(node)
    const parents = graph.edges.filter((e) => e.target === id).map((e) => e.source)
    for (const p of parents) walk(p)
  }
  walk(nodeId)
  return result
}

export function getDownstreamNodes(nodeId: string, graph: PipelineGraph): PipelineNode[] {
  const visited = new Set<string>()
  const result: PipelineNode[] = []
  const walk = (id: string) => {
    if (visited.has(id)) return
    visited.add(id)
    const node = graph.nodes.find((n) => n.id === id)
    if (node) result.push(node)
    const children = graph.edges.filter((e) => e.source === id).map((e) => e.target)
    for (const c of children) walk(c)
  }
  walk(nodeId)
  return result
}

export function getDirectPredecessors(nodeId: string, edges: PipelineEdge[]): PipelineEdge[] {
  return edges.filter((e) => e.target === nodeId)
}

export function getDirectSuccessors(nodeId: string, edges: PipelineEdge[]): PipelineEdge[] {
  return edges.filter((e) => e.source === nodeId)
}

export function buildExecutionPlan(graph: PipelineGraph): ExecutionPlan {
  const order = topologicalSort(graph)
  return { nodes: graph.nodes, edges: graph.edges, executionOrder: order }
}

export function validateGraph(graph: PipelineGraph): string[] {
  const errors: string[] = []
  const nodeIds = new Set(graph.nodes.map((n) => n.id))

  for (const e of graph.edges) {
    if (!nodeIds.has(e.source)) errors.push(`Edge ${e.id} references missing source node ${e.source}`)
    if (!nodeIds.has(e.target)) errors.push(`Edge ${e.id} references missing target node ${e.target}`)
  }

  if (graph.nodes.length > 0 && getSourceNodes(graph).length === 0) {
    errors.push("Graph has no source node (all nodes have incoming edges)")
  }

  try {
    topologicalSort(graph)
  } catch (e) {
    errors.push((e as Error).message)
  }

  return errors
}
