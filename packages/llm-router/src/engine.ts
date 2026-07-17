import type { ProviderFacade, CompletionRequest, CompletionResult, CompletionChunk, StreamCallbacks, ProviderFactory } from "./types"
import { createOpenAIProvider } from "./providers/openai"
import { createAnthropicProvider } from "./providers/anthropic"
import { createGoogleProvider } from "./providers/google"
import { createOllamaProvider } from "./providers/ollama"

export type {
  Message, ContentBlock, TextContent, ImageContent,
  ToolCall, ToolDefinition, CompletionRequest, CompletionResult,
  CompletionChunk, StreamCallbacks, Usage, ProviderFacade, ProviderFactory,
} from "./types"

export interface LLMConfig {
  openaiKey?: string
  anthropicKey?: string
  googleKey?: string
  groqKey?: string
  deepseekKey?: string
  openrouterKey?: string
  togetherKey?: string
  githubCopilotKey?: string
  awsBedrockKey?: string
  azureOpenAIKey?: string
  azureEndpoint?: string
  mistralKey?: string
  perplexityKey?: string
  deepinfraKey?: string
  cerebrasKey?: string
  xaiKey?: string
  cohereKey?: string
  cloudflareKey?: string
  veniceAIKey?: string
  alibabaKey?: string
  ollamaBaseUrl?: string
}

const defaultFactories: Record<string, ProviderFactory> = {
  openai: (key, baseUrl) => createOpenAIProvider({ apiKey: key, baseUrl }),
  anthropic: (key) => createAnthropicProvider(key),
  google: (key) => createGoogleProvider(key),
}

export class LLMEngine {
  private providers = new Map<string, ProviderFacade>()
  private config: LLMConfig

  constructor(config: LLMConfig = {}) {
    this.config = config
    this.initProviders()
  }

  private initProviders(): void {
    if (this.config.openaiKey) {
      this.register("openai", createOpenAIProvider({ apiKey: this.config.openaiKey }))
    }
    if (this.config.anthropicKey) {
      this.register("anthropic", createAnthropicProvider(this.config.anthropicKey))
    }
    if (this.config.googleKey) {
      this.register("google", createGoogleProvider(this.config.googleKey))
    }
    if (this.config.groqKey) {
      this.register("groq", createOpenAIProvider({ apiKey: this.config.groqKey, baseUrl: "https://api.groq.com/openai/v1" }))
    }
    if (this.config.deepseekKey) {
      this.register("deepseek", createOpenAIProvider({ apiKey: this.config.deepseekKey, baseUrl: "https://api.deepseek.com/v1" }))
    }
    if (this.config.openrouterKey) {
      this.register("openrouter", createOpenAIProvider({ apiKey: this.config.openrouterKey, baseUrl: "https://openrouter.ai/api/v1" }))
    }
    if (this.config.togetherKey) {
      this.register("together", createOpenAIProvider({ apiKey: this.config.togetherKey, baseUrl: "https://api.together.xyz/v1" }))
    }
    if (this.config.mistralKey) {
      this.register("mistral", createOpenAIProvider({ apiKey: this.config.mistralKey, baseUrl: "https://api.mistral.ai/v1" }))
    }
    if (this.config.azureOpenAIKey && this.config.azureEndpoint) {
      this.register("azure-openai", createOpenAIProvider({ apiKey: this.config.azureOpenAIKey, baseUrl: this.config.azureEndpoint }))
    }
    if (this.config.perplexityKey) {
      this.register("perplexity", createOpenAIProvider({ apiKey: this.config.perplexityKey, baseUrl: "https://api.perplexity.ai" }))
    }
    if (this.config.deepinfraKey) {
      this.register("deepinfra", createOpenAIProvider({ apiKey: this.config.deepinfraKey, baseUrl: "https://api.deepinfra.com/v1/openai" }))
    }
    if (this.config.cerebrasKey) {
      this.register("cerebras", createOpenAIProvider({ apiKey: this.config.cerebrasKey, baseUrl: "https://api.cerebras.ai/v1" }))
    }
    if (this.config.xaiKey) {
      this.register("xai", createOpenAIProvider({ apiKey: this.config.xaiKey, baseUrl: "https://api.x.ai/v1" }))
    }
    if (this.config.cohereKey) {
      this.register("cohere", createOpenAIProvider({ apiKey: this.config.cohereKey, baseUrl: "https://api.cohere.ai/v1" }))
    }
    if (this.config.cloudflareKey) {
      this.register("cloudflare", createOpenAIProvider({ apiKey: this.config.cloudflareKey, baseUrl: "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1" }))
    }
    if (this.config.veniceAIKey) {
      this.register("venice-ai", createOpenAIProvider({ apiKey: this.config.veniceAIKey, baseUrl: "https://api.venice.ai/v1" }))
    }
    if (this.config.alibabaKey) {
      this.register("alibaba", createOpenAIProvider({ apiKey: this.config.alibabaKey, baseUrl: "https://dashscope.aliyuncs.com/api/v1" }))
    }
    if (this.config.ollamaBaseUrl) {
      this.register("ollama", createOllamaProvider(this.config.ollamaBaseUrl))
    }
  }

  register(id: string, provider: ProviderFacade): void {
    this.providers.set(id, provider)
  }

  getProvider(id: string): ProviderFacade | undefined {
    return this.providers.get(id)
  }

  getProviders(): ProviderFacade[] {
    return Array.from(this.providers.values())
  }

  updateConfig(config: Partial<LLMConfig>): void {
    Object.assign(this.config, config)
    this.initProviders()
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const provider = this.resolveProvider(req)
    return provider.complete(req)
  }

  async stream(req: CompletionRequest, callbacks: StreamCallbacks): Promise<CompletionResult> {
    const provider = this.resolveProvider(req)
    return provider.stream(req, callbacks)
  }

  async *streamAsync(req: CompletionRequest): AsyncGenerator<CompletionChunk, CompletionResult, undefined> {
    const provider = this.resolveProvider(req)
    let resolveResult: ((r: CompletionResult) => void) | undefined
    let rejectResult: ((e: Error) => void) | undefined
    const resultPromise = new Promise<CompletionResult>((resolve, reject) => {
      resolveResult = resolve
      rejectResult = reject
    })

    const callbacks: StreamCallbacks = {
      onChunk: (chunk) => { /* yield is handled below via generator */ },
      onDone: (result) => resolveResult?.(result),
      onError: (error) => rejectResult?.(error),
    }

    const streamPromise = provider.stream(req, callbacks).then((result) => {
      resolveResult?.(result)
      return result
    }).catch((e) => {
      rejectResult?.(e)
      throw e
    })

    // Can't easily yield from callbacks in async generator
    // For now, collect chunks and yield after
    const chunks: CompletionChunk[] = []
    const wrappedCallbacks: StreamCallbacks = {
      onChunk: (chunk) => { chunks.push(chunk) },
      onDone: (result) => resolveResult?.(result),
      onError: (error) => rejectResult?.(error),
    }

    provider.stream(req, wrappedCallbacks).then((r) => resolveResult?.(r)).catch((e) => rejectResult?.(e))

    for (const chunk of chunks) {
      yield chunk
    }

    return resultPromise
  }

  private resolveProvider(req: CompletionRequest): ProviderFacade {
    if (req.provider) {
      const p = this.providers.get(req.provider)
      if (p) return p
    }

    if (req.model) {
      for (const p of this.providers.values()) {
        if (p.id === "openai") return p // default
      }
    }

    const first = this.providers.values().next().value
    if (!first) throw new Error("No LLM providers configured. Set at least one API key.")
    return first
  }
}

export const defaultEngine = new LLMEngine()

export { createOpenAIProvider } from "./providers/openai"
export { createAnthropicProvider } from "./providers/anthropic"
export { createGoogleProvider } from "./providers/google"
