import { LLMEngine, resolveDefaultOllamaModel } from "@flowmind/llm-router"
import type { LLMProvider, PipelineGraph, PipelineNode } from "@flowmind/pipeline-engine"
import { config } from "./config"
import { buildLLMConfig } from "./llm-keys"

export function buildLLMProvider(): LLMProvider | undefined {
  const llmConfig = buildLLMConfig(config)

  const hasAnyProvider = Boolean(
    llmConfig.openaiKey || llmConfig.anthropicKey || llmConfig.googleKey || llmConfig.groqKey || llmConfig.deepseekKey || llmConfig.openrouterKey ||
    llmConfig.togetherKey || llmConfig.mistralKey || llmConfig.perplexityKey || llmConfig.deepinfraKey || llmConfig.cerebrasKey || llmConfig.xaiKey ||
    llmConfig.cohereKey || llmConfig.cloudflareKey || llmConfig.veniceAIKey || llmConfig.alibabaKey || llmConfig.ollamaBaseUrl,
  )
  if (!hasAnyProvider) return undefined

  const llmEngine = new LLMEngine(llmConfig)

  return {
    complete: async (req) => {
      const model = req.model || (await resolveDefaultOllamaModel()) || "tinyllama"
      const result = await llmEngine.complete({
        messages: req.messages as any,
        model,
        maxTokens: req.maxTokens ?? 500,
        temperature: req.temperature,
      })
      return { content: result.message.content as string, model: result.model }
    },
  }
}

export function normalizeGraph(graph: any): PipelineGraph {
  if (!graph || !graph.nodes) return { nodes: [], edges: [] }
  return {
    nodes: (graph.nodes as any[]).map((n: any) => ({
      id: n.id,
      type: n.engineType ?? n.type,
      label: n.label ?? "",
      position: n.position ?? { x: 0, y: 0 },
      config: n.config ?? {},
      continueOnFail: n.continueOnFail,
      retryOnFail: n.retryOnFail,
      maxRetries: n.maxRetries,
      disabled: n.disabled,
    } as PipelineNode)),
    edges: (graph.edges || []).map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    })),
  }
}