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

export interface GraphDiffEntry {
  id: string
  status: "added" | "removed" | "modified"
  changes?: Array<{ field: string; from: unknown; to: unknown }>
}

export interface GraphDiff {
  nodes: GraphDiffEntry[]
  edges: GraphDiffEntry[]
  summary: {
    addedNodes: number
    removedNodes: number
    modifiedNodes: number
    addedEdges: number
    removedEdges: number
    modifiedEdges: number
  }
}

function diffField(entry: GraphDiffEntry, field: string, from: unknown, to: unknown): void {
  if (JSON.stringify(from) === JSON.stringify(to)) return
  entry.changes ??= []
  entry.changes.push({ field, from, to })
}

function normalizedContent(node: PipelineNode): Record<string, unknown> {
  const { position: _position, ...rest } = node
  return rest
}

export function diffGraphs(base: PipelineGraph, proposed: PipelineGraph): GraphDiff {
  const nodeEntries: GraphDiffEntry[] = []
  const edgeEntries: GraphDiffEntry[] = []

  const baseNodes = new Map(base.nodes.map((n) => [n.id, n]))
  const proposedNodes = new Map(proposed.nodes.map((n) => [n.id, n]))

  for (const node of proposed.nodes) {
    const existing = baseNodes.get(node.id)
    if (!existing) {
      nodeEntries.push({ id: node.id, status: "added" })
      continue
    }
    const entry: GraphDiffEntry = { id: node.id, status: "modified" }
    const from = normalizedContent(existing)
    const to = normalizedContent(node)
    const fields = new Set([...Object.keys(from), ...Object.keys(to)])
    let changed = false
    for (const field of fields) {
      if (field === "id") continue
      if (JSON.stringify(from[field]) !== JSON.stringify(to[field])) {
        diffField(entry, field, from[field], to[field])
        changed = true
      }
    }
    if (changed) nodeEntries.push(entry)
  }

  for (const node of base.nodes) {
    if (!proposedNodes.has(node.id)) {
      nodeEntries.push({ id: node.id, status: "removed" })
    }
  }

  const baseEdges = new Map(base.edges.map((e) => [e.id, e]))
  const proposedEdges = new Map(proposed.edges.map((e) => [e.id, e]))

  for (const edge of proposed.edges) {
    const existing = baseEdges.get(edge.id)
    if (!existing) {
      edgeEntries.push({ id: edge.id, status: "added" })
      continue
    }
    const entry: GraphDiffEntry = { id: edge.id, status: "modified" }
    let changed = false
    for (const field of ["source", "target", "sourceHandle", "targetHandle", "type"] as const) {
      if (existing[field] !== edge[field]) {
        diffField(entry, field, existing[field], edge[field])
        changed = true
      }
    }
    if (changed) edgeEntries.push(entry)
  }

  for (const edge of base.edges) {
    if (!proposedEdges.has(edge.id)) {
      edgeEntries.push({ id: edge.id, status: "removed" })
    }
  }

  const count = (entries: GraphDiffEntry[], status: GraphDiffEntry["status"]) => entries.filter((e) => e.status === status).length

  return {
    nodes: nodeEntries,
    edges: edgeEntries,
    summary: {
      addedNodes: count(nodeEntries, "added"),
      removedNodes: count(nodeEntries, "removed"),
      modifiedNodes: count(nodeEntries, "modified"),
      addedEdges: count(edgeEntries, "added"),
      removedEdges: count(edgeEntries, "removed"),
      modifiedEdges: count(edgeEntries, "modified"),
    },
  }
}

export function mergeGraphs(base: PipelineGraph, proposed: PipelineGraph, diff: GraphDiff): PipelineGraph {
  const removedNodeIds = new Set(diff.nodes.filter((d) => d.status === "removed").map((d) => d.id))
  const modifiedNodes = new Map(
    diff.nodes.filter((d) => d.status === "modified").map((d) => [d.id, d]),
  )

  const nodes = base.nodes
    .filter((n) => !removedNodeIds.has(n.id))
    .map((n) => {
      const entry = modifiedNodes.get(n.id)
      if (!entry?.changes) return n
      const next: PipelineNode = { ...n }
      for (const change of entry.changes) {
        ;(next as unknown as Record<string, unknown>)[change.field] = change.to
      }
      return next
    })

  const proposedNodeMap = new Map(proposed.nodes.map((n) => [n.id, n]))
  for (const entry of diff.nodes) {
    if (entry.status === "added") {
      const node = proposedNodeMap.get(entry.id)
      if (node) nodes.push(node)
    }
  }

  const removedEdgeIds = new Set(diff.edges.filter((d) => d.status === "removed").map((d) => d.id))
  const modifiedEdges = new Map(
    diff.edges.filter((d) => d.status === "modified").map((d) => [d.id, d]),
  )

  const edges = base.edges
    .filter((e) => !removedEdgeIds.has(e.id))
    .map((e) => {
      const entry = modifiedEdges.get(e.id)
      if (!entry?.changes) return e
      const next: PipelineEdge = { ...e }
      for (const change of entry.changes) {
        ;(next as unknown as Record<string, unknown>)[change.field] = change.to
      }
      return next
    })

  const proposedEdgeMap = new Map(proposed.edges.map((e) => [e.id, e]))
  for (const entry of diff.edges) {
    if (entry.status === "added") {
      const edge = proposedEdgeMap.get(entry.id)
      if (edge) edges.push(edge)
    }
  }

  return { nodes, edges }
}
