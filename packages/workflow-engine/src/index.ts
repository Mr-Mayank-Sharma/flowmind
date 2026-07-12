export interface WorkflowNode {
  id: string
  type: string
  label: string
  position: { x: number; y: number }
  config: Record<string, unknown>
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle: string | null
  targetHandle: string | null
  label: string | null
}

export interface WorkflowGraph {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export interface WorkflowExecutionResult {
  success: boolean
  outputs: Record<string, unknown>
  error?: string
}

export class WorkflowEngine {
  async execute(graph: WorkflowGraph, input?: Record<string, unknown>): Promise<WorkflowExecutionResult> {
    return { success: true, outputs: input ?? {} }
  }

  async validate(graph: WorkflowGraph): Promise<string[]> {
    return []
  }
}
