import type { PipelineGraph, PipelineNode, ExecutionContext, RunResult, CredentialResolver, SubPipelineRunner, NodeOutput, WorkflowSettings, BinaryDataEntry, NodeStatusCallback, LLMProvider } from "./types"
import { buildExecutionPlan, getDirectPredecessors } from "./graph"
import { executeNode, getRunner } from "./runners"
import { validateGraph } from "./graph"
import { providerRegistry } from "@flowmind/provider-registry"

export interface EngineOptions {
  credentialResolver?: CredentialResolver
  subPipelineRunner?: SubPipelineRunner
  onNodeStatus?: NodeStatusCallback
  llm?: LLMProvider
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export class PipelineEngine {
  private credentialResolver?: CredentialResolver
  private subPipelineRunner?: SubPipelineRunner
  private onNodeStatus?: NodeStatusCallback
  private llm?: LLMProvider

  constructor(options: EngineOptions = {}) {
    this.credentialResolver = options.credentialResolver
    this.subPipelineRunner = options.subPipelineRunner
    this.onNodeStatus = options.onNodeStatus
    this.llm = options.llm
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

    const errors = validateGraph(graph)
    if (errors.length > 0) {
      return {
        runId,
        status: "error",
        outputs: [],
        error: `Graph validation failed: ${errors.join("; ")}`,
        startedAt: startTime,
        completedAt: Date.now(),
        durationMs: Date.now() - startTime,
      }
    }

    const plan = buildExecutionPlan(graph)
    const outputs = new Map<string, NodeOutput>()
    const abortSignal = signal ?? new AbortController().signal
    let runError: string | undefined

    const context: ExecutionContext = {
      runId,
      pipelineId,
      graph,
      settings,
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
    }

    for (const nodeId of plan.executionOrder) {
      if (abortSignal.aborted) {
        return {
          runId,
          status: "cancelled",
          outputs: Array.from(outputs.values()),
          error: "Execution cancelled",
          startedAt: startTime,
          completedAt: Date.now(),
          durationMs: Date.now() - startTime,
        }
      }

      const node = graph.nodes.find((n) => n.id === nodeId)
      if (!node) continue

      if (node.disabled) {
        outputs.set(nodeId, {
          nodeId,
          nodeType: node.type,
          output: { skipped: true, reason: "disabled" },
          durationMs: 0,
          timestamp: Date.now(),
        })
        continue
      }

      this.onNodeStatus?.({ runId, nodeId, nodeType: node.type, status: "running" })
      const nodeOutput = await this.executeNodeWithRetry(node, context)
      outputs.set(nodeId, nodeOutput)
      this.onNodeStatus?.({
        runId, nodeId, nodeType: node.type,
        status: nodeOutput.error ? "failed" : "completed",
        error: nodeOutput.error,
        durationMs: nodeOutput.durationMs,
      })

      if (nodeOutput.error && !node.continueOnFail) {
        runError = `Node "${node.label}" (${nodeId}) failed: ${nodeOutput.error}`
        break
      }
    }

    const allOutputs = Array.from(outputs.values())
    const hasError = allOutputs.some((o) => o.error) || !!runError

    return {
      runId,
      status: hasError ? "error" : "success",
      outputs: allOutputs,
      error: runError,
      startedAt: startTime,
      completedAt: Date.now(),
      durationMs: Date.now() - startTime,
    }
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
