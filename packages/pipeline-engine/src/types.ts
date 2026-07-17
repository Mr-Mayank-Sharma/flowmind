export type NodeType =
  | "cronTrigger" | "webhookTrigger" | "channelTrigger" | "manualTrigger" | "pollingTrigger"
  | "aiAgent" | "contentWriter" | "dataExtractor" | "classifier" | "summarizer" | "webResearcher" | "imageGenerator"
  | "httpRequest" | "databaseQuery" | "sendEmail" | "sendMessage" | "codeExecute"
  | "condition" | "switch" | "parallelFork" | "merge" | "loop" | "wait"
  | "subPipeline"
  | "integrationNode"

export type NodeKind = "trigger" | "ai" | "action" | "flow" | "integration"

export interface PipelineNode {
  id: string
  type: NodeType
  label: string
  position: { x: number; y: number }
  config: Record<string, unknown>
  continueOnFail?: boolean
  retryOnFail?: boolean
  maxRetries?: number
  pinData?: unknown
  disabled?: boolean
}

export interface PipelineEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type?: string
}

export interface PipelineGraph {
  nodes: PipelineNode[]
  edges: PipelineEdge[]
}

export interface WorkflowSettings {
  timezone?: string
  executionOrder?: "sequential" | "parallel"
  errorWorkflowId?: string
  saveDataOnError?: "all" | "none"
  saveManualExecutions?: boolean
  retryOnFail?: boolean
  maxRetries?: number
  timeout?: number
}

export interface NodeOutput {
  nodeId: string
  nodeType: NodeType
  output: unknown
  error?: string
  durationMs: number
  timestamp: number
  retryCount?: number
}

export interface BinaryDataEntry {
  fileName: string
  mimeType: string
  data: string
  id: string
}

export interface ExecutionContext {
  runId: string
  pipelineId: string
  graph: PipelineGraph
  settings?: WorkflowSettings
  input: unknown
  outputs: Map<string, NodeOutput>
  variables: Record<string, unknown>
  staticData: Record<string, unknown>
  nodeStaticData: Map<string, Record<string, unknown>>
  binaryData: Map<string, BinaryDataEntry[]>
  abortSignal: AbortSignal
  credentialResolver?: CredentialResolver
  subPipelineRunner?: SubPipelineRunner
}

export interface CredentialResolver {
  getCredential(credentialId: string): Promise<Record<string, string> | null>
  getCredentialsByType(type: string): Promise<Array<{ id: string; name: string; config: Record<string, unknown> }>>
}

export interface SubPipelineRunner {
  run(pipelineId: string, input: unknown, parentContext: ExecutionContext): Promise<unknown>
}

export type NodeStatusCallback = (event: {
  runId: string
  nodeId: string
  nodeType: string
  status: "running" | "completed" | "failed"
  error?: string
  durationMs?: number
}) => void

export interface NodeRunner {
  type: NodeType
  execute(node: PipelineNode, context: ExecutionContext): Promise<unknown>
}

export interface ExecutionPlan {
  nodes: PipelineNode[]
  edges: PipelineEdge[]
  executionOrder: string[]
}

export interface RunResult {
  runId: string
  status: "success" | "error" | "cancelled"
  outputs: NodeOutput[]
  error?: string
  startedAt: number
  completedAt: number
  durationMs: number
}

export interface TriggerEvent {
  id: string
  type: string
  source: string
  payload: unknown
  timestamp: number
}

export interface TriggerHandler {
  type: string
  start(pipelineId: string, config: Record<string, unknown>, onEvent: (event: TriggerEvent) => void): Promise<() => void>
}

export interface CredentialStore {
  encrypt(value: string): Promise<string>
  decrypt(value: string): Promise<string>
  save(credential: { id: string; name: string; type: string; encrypted: string; userId: string }): Promise<void>
  get(id: string): Promise<{ id: string; name: string; type: string; encrypted: string } | null>
  listByType(type: string): Promise<Array<{ id: string; name: string; type: string }>>
  delete(id: string): Promise<void>
}

export function kindForNodeType(type: NodeType): NodeKind {
  if (["cronTrigger", "webhookTrigger", "channelTrigger", "manualTrigger", "pollingTrigger"].includes(type)) return "trigger"
  if (["aiAgent", "contentWriter", "dataExtractor", "classifier", "summarizer", "webResearcher", "imageGenerator"].includes(type)) return "ai"
  if (["httpRequest", "databaseQuery", "sendEmail", "sendMessage", "codeExecute", "subPipeline"].includes(type)) return "action"
  if (["condition", "switch", "parallelFork", "merge", "loop", "wait"].includes(type)) return "flow"
  return "integration"
}

export function isSubPipeline(nodeType: NodeType): boolean {
  return nodeType === "subPipeline"
}

export const expressionPrefixes: string[] = ["$json", "$node", "$items", "$env", "$now", "$run", "$binary"]
