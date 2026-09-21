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

// Bridges the callback-based stream API to an async generator. Chunks are
// pushed here by onChunk and pulled by the generator, so the provider is
// called exactly once per stream.
class AsyncChunkQueue {
  private items: CompletionChunk[] = []
  private waiters: Array<() => void> = []
  private finished = false
  private failure: Error | undefined

  push(chunk: CompletionChunk): void {
    this.items.push(chunk)
    this.wakeWaiter()
  }

  finish(): void {
    this.finished = true
    this.wakeWaiter()
  }

  fail(error: Error): void {
    this.failure = error
    this.finished = true
    this.wakeWaiter()
  }

  private wakeWaiter(): void {
    const waiter = this.waiters.shift()
    waiter?.()
  }

  // Returns the next chunk, or undefined once the stream is finished.
  // Throws the stream error when the provider reported one.
  async next(): Promise<CompletionChunk | undefined> {
    while (true) {
      if (this.items.length > 0) return this.items.shift()
      if (this.failure) throw this.failure
      if (this.finished) return undefined
      await new Promise<void>((resolve) => this.waiters.push(resolve))
    }
  }
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

    // Chunks flow from onChunk into a queue that this generator drains,
    // so the provider is invoked exactly once (the old code called
    // provider.stream() twice, doubling API usage and risking empty output).
    const queue = new AsyncChunkQueue()
    let settledResult: CompletionResult | undefined

    const callbacks: StreamCallbacks = {
      onChunk: (chunk) => queue.push(chunk),
      onDone: (result) => {
        settledResult = result
        queue.finish()
      },
      onError: (error) => queue.fail(error),
    }

    const streamPromise = provider.stream(req, callbacks)
    // A rejection that never reached onError (e.g. the fetch itself failed)
    // must still unblock the queue, otherwise the generator waits forever.
    streamPromise.catch((error: unknown) => {
      queue.fail(error instanceof Error ? error : new Error(String(error)))
    })

    while (true) {
      const chunk = await queue.next()
      if (chunk === undefined) break
      yield chunk
    }

    // onDone normally supplies the result; awaiting the promise also
    // surfaces HTTP failures that never reached the callbacks.
    return (await streamPromise) ?? settledResult!
  }

  private resolveProvider(req: CompletionRequest): ProviderFacade {
    if (req.provider) {
      const explicit = this.providers.get(req.provider)
      if (explicit) return explicit
    }

    if (req.model) {
      const matched = this.matchModelToProvider(req.model)
      if (matched) return matched
    }

    const first = this.providers.values().next().value
    if (!first) throw new Error("No LLM providers configured. Set at least one API key.")
    return first
  }

  // Picks the provider most likely to serve a model name. The old code
  // always returned "openai" whenever a model was set, even if only
  // Ollama or Anthropic was configured. Unknown names fall through so the
  // caller gets the first configured provider instead of a wrong one.
  private matchModelToProvider(model: string): ProviderFacade | undefined {
    const normalized = model.toLowerCase()
    const rules: Array<[RegExp, string]> = [
      [/^gpt-/, "openai"],
      [/^o[1-9](-|$)/, "openai"],
      [/^chatgpt-/, "openai"],
      [/^claude-/, "anthropic"],
      [/^gemini-/, "google"],
      [/^command(-|$)/, "cohere"],
      [/^deepseek-/, "deepseek"],
      [/^llama|^qwen|^mistral|^gemma|^phi|^tinyllama|^mxbai|^nomic/, "ollama"],
    ]
    for (const [pattern, providerId] of rules) {
      if (pattern.test(normalized)) {
        const provider = this.providers.get(providerId)
        if (provider) return provider
      }
    }
    return undefined
  }
}

export const defaultEngine = new LLMEngine()

export { createOpenAIProvider } from "./providers/openai"
export { createAnthropicProvider } from "./providers/anthropic"
export { createGoogleProvider } from "./providers/google"
