import type { PipelineGraph, PipelineNode, ExecutionContext, RunResult, CredentialResolver, SubPipelineRunner, NodeOutput, WorkflowSettings, BinaryDataEntry, NodeStatusCallback, LLMProvider, RAGSearchFn, ApprovalRequester, ApprovalDecision, PipelineEdge } from "./types"
import { buildExecutionPlan, getDirectPredecessors, getDownstreamNodes, validateGraph } from "./graph"
import { executeNode, getRunner } from "./runners"
import { providerRegistry } from "@flowmind/provider-registry"

export interface EngineOptions {
  credentialResolver?: CredentialResolver
  subPipelineRunner?: SubPipelineRunner
  onNodeStatus?: NodeStatusCallback
  llm?: LLMProvider
  ragSearch?: RAGSearchFn
  requestApproval?: ApprovalRequester
  approvalOverrides?: Record<string, ApprovalDecision>
  /**
   * When set, execution starts at this node id instead of the first node.
   * Used by the API to resume a paused human-approval run at the exact node.
   * Nodes before it are skipped, but their outputs must be supplied via
   * `initialOutputs` so downstream nodes can still read them.
   */
  resumeFrom?: string
  /**
   * Pre-loaded node outputs (typically the outputs of a paused run). Used with
   * `resumeFrom` so the resumed run does not re-execute already-finished nodes.
   */
  initialOutputs?: NodeOutput[]
  /**
   * Seed variables for the execution context. Used to propagate state such as
   * the sub-pipeline nesting depth into a child engine's fresh context.
   */
  initialVariables?: Record<string, unknown>
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// Result of processing a single node. Exactly one of these is populated when
// the node should stop the run; otherwise all are empty and execution continues.
interface NodeProcessResult {
  runError?: string
  pauseStatus?: "cancelled" | "awaiting_approval"
  pauseError?: string
}

export class PipelineEngine {
  private credentialResolver?: CredentialResolver
  private subPipelineRunner?: SubPipelineRunner
  private onNodeStatus?: NodeStatusCallback
  private llm?: LLMProvider
  private ragSearch?: RAGSearchFn
  private requestApproval?: ApprovalRequester
  private approvalOverrides?: Record<string, ApprovalDecision>
  private resumeFrom?: string
  private initialOutputs?: NodeOutput[]
  private initialVariables?: Record<string, unknown>

  constructor(options: EngineOptions = {}) {
    this.credentialResolver = options.credentialResolver
    this.subPipelineRunner = options.subPipelineRunner
    this.onNodeStatus = options.onNodeStatus
    this.llm = options.llm
    this.ragSearch = options.ragSearch
    this.requestApproval = options.requestApproval
    this.approvalOverrides = options.approvalOverrides
    this.resumeFrom = options.resumeFrom
    this.initialOutputs = options.initialOutputs
    this.initialVariables = options.initialVariables
  }

  async execute(
    runId: string,
    pipelineId: string,
    graph: PipelineGraph,
    input: unknown,
    settings?: WorkflowSettings,
    signal?: AbortSignal,
  ): Promise<RunResult> {
    const startTime = Date.now()
    const finish = (status: RunResult["status"], error?: string): RunResult => ({
      runId,
      status,
      outputs: Array.from(outputs.values()),
      error,
      startedAt: startTime,
      completedAt: Date.now(),
      durationMs: Date.now() - startTime,
    })

    const errors = validateGraph(graph)
    if (errors.length > 0) {
      return finish("error", `Graph validation failed: ${errors.join("; ")}`)
    }

    const plan = buildExecutionPlan(graph)
    const outputs = new Map<string, NodeOutput>()

    // Resume support: preload the outputs captured from the paused run so
    // downstream nodes can read predecessors that were already executed.
    if (this.initialOutputs) {
      for (const nodeOutput of this.initialOutputs) {
        outputs.set(nodeOutput.nodeId, nodeOutput)
      }
    }

    const abortSignal = signal ?? new AbortController().signal
    let runError: string | undefined

    const context: ExecutionContext = {
      runId,
      pipelineId,
      graph,
      settings,
      input,
      outputs,
      variables: { ...(this.initialVariables ?? {}) },
      staticData: {},
      nodeStaticData: new Map(),
      binaryData: new Map(),
      abortSignal,
      credentialResolver: this.credentialResolver,
      subPipelineRunner: this.subPipelineRunner,
      llm: this.llm,
      ragSearch: this.ragSearch,
      requestApproval: this.requestApproval,
      approvalOverrides: this.approvalOverrides,
      executeSubgraph: (nodeIds, extraVars) => this.runSubgraph(nodeIds, extraVars, context, runId, startTime),
    }

    // Resume: start at the paused node so its approval decision is re-applied
    // and execution continues from there instead of re-running the whole graph.
    let order = plan.executionOrder
    if (this.resumeFrom) {
      const resumeIndex = order.indexOf(this.resumeFrom)
      if (resumeIndex >= 0) order = order.slice(resumeIndex)
    }

    // Nodes downstream of a loop or parallelFork are owned by that flow node:
    // they only run via executeSubgraph (once per iteration/branch) and must
    // not also run in the main sequence.
    const ownedByFlow = new Set<string>()
    for (const node of graph.nodes) {
      if (node.type === "loop" || node.type === "parallelFork") {
        for (const downstream of getDownstreamNodes(node.id, graph)) {
          ownedByFlow.add(downstream.id)
        }
      }
    }
    order = order.filter((nodeId) => !ownedByFlow.has(nodeId))

    if (settings?.executionOrder === "parallel") {
      // Parallel mode: group the plan into dependency levels and run each
      // level's independent nodes concurrently (real branch parallelism).
      const levels = this.computeLevels(graph, order)
      for (const level of levels) {
        const results = await Promise.allSettled(
          level.map((nodeId) => this.processNode(nodeId, context, runId)),
        )
        for (const result of results) {
          if (result.status === "rejected") {
            runError = result.reason instanceof Error ? result.reason.message : String(result.reason)
            break
          }
          const value = result.value
          if (value.pauseStatus === "cancelled") return finish("cancelled", "Execution cancelled")
          if (value.pauseStatus === "awaiting_approval") return finish("awaiting_approval", value.pauseError)
          if (value.runError) {
            runError = value.runError
            break
          }
        }
        if (runError) break
      }
    } else {
      // Sequential mode: run the plan in topological order, one node at a time.
      for (const nodeId of order) {
        const result = await this.processNode(nodeId, context, runId)
        if (result.pauseStatus === "cancelled") return finish("cancelled", "Execution cancelled")
        if (result.pauseStatus === "awaiting_approval") return finish("awaiting_approval", result.pauseError)
        if (result.runError) {
          runError = result.runError
          break
        }
      }
    }

    const allOutputs = Array.from(outputs.values())
    const hasError = allOutputs.some((o) => o.error) || !!runError
    return finish(hasError ? "error" : "success", runError)
  }

  /**
   * Runs one node (its runner + status callbacks + error/approval handling)
   * against the shared context. Shared by the main sequence, parallel levels,
   * and executeSubgraph so every execution path behaves identically.
   */
  private async processNode(nodeId: string, context: ExecutionContext, runId: string): Promise<NodeProcessResult> {
    const { graph, outputs, abortSignal } = context
    if (abortSignal.aborted) {
      return { pauseStatus: "cancelled", pauseError: "Execution cancelled" }
    }

    const node = graph.nodes.find((n) => n.id === nodeId)
    if (!node) return {}

    if (node.disabled) {
      outputs.set(nodeId, {
        nodeId,
        nodeType: node.type,
        output: { skipped: true, reason: "disabled" },
        durationMs: 0,
        timestamp: Date.now(),
      })
      return {}
    }

    this.onNodeStatus?.({ runId, nodeId, nodeType: node.type, status: "running" })
    const nodeOutput = await this.executeNodeWithRetry(node, context)
    outputs.set(nodeId, nodeOutput)
    this.onNodeStatus?.({
      runId,
      nodeId,
      nodeType: node.type,
      status: nodeOutput.error ? "failed" : "completed",
      error: nodeOutput.error,
      durationMs: nodeOutput.durationMs,
      output: nodeOutput.output,
    })

    if (nodeOutput.error && !node.continueOnFail) {
      return { runError: `Node "${node.label}" (${nodeId}) failed: ${nodeOutput.error}` }
    }

    if (
      node.type === "humanApproval" &&
      nodeOutput.output &&
      typeof nodeOutput.output === "object" &&
      ((nodeOutput.output as { status?: string }).status === "awaiting_approval" ||
        (nodeOutput.output as { status?: string }).status === "rejected")
    ) {
      const denied = (nodeOutput.output as { status: string }).status === "rejected"
      return {
        pauseStatus: "awaiting_approval",
        pauseError: denied
          ? `Approval denied at node "${node.label}" (${nodeId})`
          : `Execution paused awaiting approval at node "${node.label}" (${nodeId})`,
      }
    }

    return {}
  }

  /**
   * Executes a subset of the graph (used by loop / parallelFork runners to
   * re-run their downstream subgraph once per iteration or branch). Shares the
   * parent context's outputs, variables, and abort signal, so subgraph nodes
   * see everything the parent has produced so far.
   */
  private async runSubgraph(
    nodeIds: string[],
    extraVars: Record<string, unknown> | undefined,
    context: ExecutionContext,
    runId: string,
    startTime: number,
  ): Promise<Map<string, NodeOutput>> {
    const idSet = new Set(nodeIds)
    const subGraph: PipelineGraph = {
      nodes: context.graph.nodes.filter((n) => idSet.has(n.id)),
      edges: context.graph.edges.filter((e) => idSet.has(e.source) && idSet.has(e.target)),
    }
    const subPlan = buildExecutionPlan(subGraph)

    if (extraVars) {
      for (const [key, value] of Object.entries(extraVars)) {
        context.variables[key] = value
      }
    }

    for (const subNodeId of subPlan.executionOrder) {
      const result = await this.processNode(subNodeId, context, runId)
      if (result.pauseStatus === "cancelled") throw new Error("Execution cancelled")
      if (result.pauseStatus === "awaiting_approval") throw new Error(result.pauseError ?? "Execution paused")
      if (result.runError) throw new Error(result.runError)
    }

    const resultMap = new Map<string, NodeOutput>()
    for (const id of nodeIds) {
      const nodeOutput = context.outputs.get(id)
      if (nodeOutput) resultMap.set(id, nodeOutput)
    }
    return resultMap
  }

  /**
   * Groups an execution order into dependency levels for parallel execution.
   * A node's level is one more than the highest level of its in-plan
   * predecessors, so nodes in the same level never depend on each other.
   */
  private computeLevels(graph: PipelineGraph, order: string[]): string[][] {
    const inOrder = new Set(order)
    const levelOf = new Map<string, number>()

    for (const nodeId of order) {
      const predecessors = getDirectPredecessors(nodeId, graph.edges)
        .map((edge: PipelineEdge) => edge.source)
        .filter((sourceId) => inOrder.has(sourceId))
      let level = 0
      for (const predId of predecessors) {
        level = Math.max(level, (levelOf.get(predId) ?? 0) + 1)
      }
      levelOf.set(nodeId, level)
    }

    const levels: string[][] = []
    for (const nodeId of order) {
      const level = levelOf.get(nodeId) ?? 0
      if (!levels[level]) levels[level] = []
      levels[level]!.push(nodeId)
    }
    return levels
  }

  private async executeNodeWithRetry(node: PipelineNode, context: ExecutionContext): Promise<NodeOutput> {
    const maxRetries = node.retryOnFail ? (node.maxRetries ?? 3) : 0
    let lastError: string | undefined

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
        await sleep(backoff)
      }

      const output = await this.executeNodeOnce(node, context, attempt)
      if (!output.error) return output
      lastError = output.error
    }

    return {
      nodeId: node.id,
      nodeType: node.type,
      output: { error: lastError },
      error: lastError,
      durationMs: 0,
      timestamp: Date.now(),
      retryCount: maxRetries,
    }
  }

  private async executeNodeOnce(node: PipelineNode, context: ExecutionContext, retryCount: number): Promise<NodeOutput> {
    const start = Date.now()
    const runner = getRunner(node.type)

    const nodeStaticData = context.nodeStaticData.get(node.id) ?? {}

    if (node.pinData !== undefined) {
      return {
        nodeId: node.id,
        nodeType: node.type,
        output: node.pinData,
        durationMs: Date.now() - start,
        timestamp: Date.now(),
        retryCount,
      }
    }

    if (!runner) {
      return {
        nodeId: node.id,
        nodeType: node.type,
        output: { error: `No runner for node type: ${node.type}` },
        error: `Unknown node type: ${node.type}`,
        durationMs: Date.now() - start,
        timestamp: Date.now(),
        retryCount,
      }
    }

    try {
      const result = await runner(
        { ...node, config: { ...node.config, nodeStaticData } },
        context,
      )
      return {
        nodeId: node.id,
        nodeType: node.type,
        output: result,
        durationMs: Date.now() - start,
        timestamp: Date.now(),
        retryCount,
      }
    } catch (err: any) {
      return {
        nodeId: node.id,
        nodeType: node.type,
        output: { error: err.message },
        error: err.message,
        durationMs: Date.now() - start,
        timestamp: Date.now(),
        retryCount,
      }
    }
  }

  async executeSingleNode(
    runId: string,
    pipelineId: string,
    graph: PipelineGraph,
    nodeId: string,
    input: unknown,
    signal?: AbortSignal,
  ): Promise<NodeOutput> {
    const node = graph.nodes.find((n) => n.id === nodeId)
    if (!node) throw new Error(`Node ${nodeId} not found in graph`)

    const outputs = new Map<string, NodeOutput>()
    const abortSignal = signal ?? new AbortController().signal

    const context: ExecutionContext = {
      runId,
      pipelineId,
      graph,
      input,
      outputs,
      variables: {},
      staticData: {},
      nodeStaticData: new Map(),
      binaryData: new Map(),
      abortSignal,
      credentialResolver: this.credentialResolver,
      subPipelineRunner: this.subPipelineRunner,
      llm: this.llm,
      ragSearch: this.ragSearch,
      requestApproval: this.requestApproval,
      approvalOverrides: this.approvalOverrides,
    }

    return this.executeNodeWithRetry(node, context)
  }

  simulate(graph: PipelineGraph): RunResult {
    const outputs: NodeOutput[] = graph.nodes
      .filter((n) => !n.disabled)
      .map((node) => ({
        nodeId: node.id,
        nodeType: node.type,
        output: node.pinData ?? { simulated: true },
        durationMs: 0,
        timestamp: Date.now(),
      }))

    return {
      runId: "simulated",
      status: "success",
      outputs,
      startedAt: Date.now(),
      completedAt: Date.now(),
      durationMs: 0,
    }
  }

  async loadOptions(
    nodeType: string,
    field: string,
    config: Record<string, unknown>,
    filter?: string,
  ): Promise<Array<{ label: string; value: string; description?: string }>> {
    const runner = getRunner(nodeType)
    if (!runner || typeof (runner as any).loadOptions !== "function") {
      return this.defaultLoadOptions(nodeType, field, config, filter)
    }
    try {
      return await (runner as any).loadOptions(field, config, filter)
    } catch {
      return this.defaultLoadOptions(nodeType, field, config, filter)
    }
  }

  private defaultLoadOptions(
    nodeType: string,
    _field: string,
    _config: Record<string, unknown>,
    _filter?: string,
  ): Array<{ label: string; value: string; description?: string }> {
    if (nodeType === "httpRequest") {
      return [
        { label: "GET", value: "GET" },
        { label: "POST", value: "POST" },
        { label: "PUT", value: "PUT" },
        { label: "PATCH", value: "PATCH" },
        { label: "DELETE", value: "DELETE" },
      ]
    }
    if (nodeType.startsWith("ai")) {
      return providerRegistry.getModels().map((m) => ({
        label: `${m.name} (${m.providerId})`,
        value: m.id,
        description: `Context: ${m.context} | Max output: ${m.maxOutput}`,
      }))
    }
    return []
  }
}