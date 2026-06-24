export type ProviderId = "openai" | "anthropic" | "google" | "mistral" | "ollama"

export type ModelConfig = {
  id: string
  provider: ProviderId
  displayName: string
  maxTokens: number
  costPer1kTokens: number
  capabilities: string[]
  local: boolean
}

export type ProviderConfig = {
  id: ProviderId
  name: string
  baseUrl: string
  apiKey?: string
  models: ModelConfig[]
  rateLimited: boolean
  costRoutingEnabled: boolean
  priority: number
}

export type CompletionRequest = {
  prompt: string
  model?: string
  provider?: ProviderId
  stream?: boolean
  temperature?: number
  maxTokens?: number
}

export type CompletionChunk = {
  content: string
  done: boolean
  model?: string
  provider?: ProviderId
  fallbackUsed?: boolean
  fallbackProvider?: ProviderId
}

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4o", provider: "openai", displayName: "GPT-4o", maxTokens: 128000, costPer1kTokens: 0.005, capabilities: ["text", "vision", "tools"], local: false },
      { id: "gpt-4o-mini", provider: "openai", displayName: "GPT-4o Mini", maxTokens: 128000, costPer1kTokens: 0.00015, capabilities: ["text", "tools"], local: false },
    ],
    rateLimited: false,
    costRoutingEnabled: false,
    priority: 1,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    models: [
      { id: "claude-sonnet-4-20250514", provider: "anthropic", displayName: "Claude Sonnet 4", maxTokens: 200000, costPer1kTokens: 0.003, capabilities: ["text", "vision", "tools"], local: false },
      { id: "claude-haiku-3-5", provider: "anthropic", displayName: "Claude Haiku 3.5", maxTokens: 200000, costPer1kTokens: 0.0008, capabilities: ["text", "tools"], local: false },
    ],
    rateLimited: false,
    costRoutingEnabled: false,
    priority: 2,
  },
  {
    id: "google",
    name: "Google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: [
      { id: "gemini-2.0-flash", provider: "google", displayName: "Gemini 2.0 Flash", maxTokens: 1048576, costPer1kTokens: 0.0001, capabilities: ["text", "vision", "tools"], local: false },
    ],
    rateLimited: false,
    costRoutingEnabled: false,
    priority: 3,
  },
  {
    id: "mistral",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    models: [
      { id: "mistral-large-2501", provider: "mistral", displayName: "Mistral Large", maxTokens: 128000, costPer1kTokens: 0.002, capabilities: ["text", "tools"], local: false },
    ],
    rateLimited: false,
    costRoutingEnabled: false,
    priority: 4,
  },
  {
    id: "ollama",
    name: "Ollama",
    baseUrl: "http://localhost:11434",
    models: [
      { id: "llama3.3", provider: "ollama", displayName: "Llama 3.3", maxTokens: 128000, costPer1kTokens: 0, capabilities: ["text", "tools"], local: true },
      { id: "mistral", provider: "ollama", displayName: "Mistral (Ollama)", maxTokens: 32000, costPer1kTokens: 0, capabilities: ["text"], local: true },
      { id: "codellama", provider: "ollama", displayName: "CodeLlama", maxTokens: 16000, costPer1kTokens: 0, capabilities: ["text"], local: true },
    ],
    rateLimited: false,
    costRoutingEnabled: false,
    priority: 0,
  },
]

export class LllmRouter {
  private providers: Map<ProviderId, ProviderConfig> = new Map()
  private ollamaAvailable: boolean = false

  constructor(providers?: ProviderConfig[]) {
    const configs = providers ?? DEFAULT_PROVIDERS
    for (const p of configs) {
      this.providers.set(p.id, p)
    }
  }

  getProviders(): ProviderConfig[] {
    return Array.from(this.providers.values())
  }

  getProvider(id: ProviderId): ProviderConfig | undefined {
    return this.providers.get(id)
  }

  async isOllamaAvailable(): Promise<boolean> {
    try {
      const res = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(2000) })
      this.ollamaAvailable = res.ok
    } catch {
      this.ollamaAvailable = false
    }
    return this.ollamaAvailable
  }

  async selectProvider(request: CompletionRequest): Promise<{
    provider: ProviderConfig
    model: ModelConfig
    fallbackUsed: boolean
    fallbackProvider?: ProviderId
  }> {
    if (request.model) {
      for (const p of this.providers.values()) {
        const model = p.models.find((m) => m.id === request.model)
        if (model) {
          return { provider: p, model, fallbackUsed: false }
        }
      }
    }

    if (request.provider === "ollama" || !request.provider) {
      const ollama = this.providers.get("ollama")
      if (ollama) {
        const available = await this.isOllamaAvailable()
        if (available) {
          const model = ollama.models[0]!
          return { provider: ollama, model, fallbackUsed: false }
        }
      }
    }

    if (request.provider === "ollama" || !request.provider) {
      const fallback = this.findCloudFallback()
      if (fallback) {
        const model = fallback.models[0]!
        return { provider: fallback, model, fallbackUsed: true, fallbackProvider: fallback.id }
      }
    }

    if (request.provider) {
      const p = this.providers.get(request.provider)
      if (p && !p.rateLimited) {
        const model = p.models[0]!
        return { provider: p, model, fallbackUsed: false }
      }
    }

    for (const p of this.getSortedByPriority()) {
      if (!p.rateLimited) {
        const model = p.models[0]!
        return { provider: p, model, fallbackUsed: false }
      }
    }

    for (const p of this.getSortedByPriority()) {
      const model = p.models[0]!
      return { provider: p, model, fallbackUsed: false }
    }

    throw new Error("No LLM providers available")
  }

  async streamCompletion(
    request: CompletionRequest,
    provider?: ProviderConfig,
    options?: { onChunk?: (chunk: CompletionChunk) => void },
  ): Promise<CompletionChunk> {
    const { provider: selectedProvider, model, fallbackUsed, fallbackProvider } = await this.selectProvider(request)
    const activeProvider = provider ?? selectedProvider

    const mockChunks = [
      `Thinking using ${model.displayName}...`,
      `\n\nThis is a mock response from ${activeProvider.name}.`,
      `\n\nYour prompt was: "${request.prompt.substring(0, 50)}..."`,
      `\n\n[TODO: integrate real ${activeProvider.id} API via ${activeProvider.baseUrl}]`,
    ]

    for (const chunk of mockChunks) {
      const c: CompletionChunk = {
        content: chunk,
        done: false,
        model: model.id,
        provider: activeProvider.id,
        fallbackUsed,
        fallbackProvider,
      }
      options?.onChunk?.(c)
    }

    const final: CompletionChunk = {
      content: "",
      done: true,
      model: model.id,
      provider: activeProvider.id,
      fallbackUsed,
      fallbackProvider,
    }
    options?.onChunk?.(final)
    return final
  }

  markRateLimited(providerId: ProviderId): void {
    const p = this.providers.get(providerId)
    if (p) {
      p.rateLimited = true
    }
  }

  clearRateLimit(providerId: ProviderId): void {
    const p = this.providers.get(providerId)
    if (p) {
      p.rateLimited = false
    }
  }

  private findCloudFallback(): ProviderConfig | undefined {
    const sorted = this.getSortedByPriority()
    return sorted.find((p) => !p.rateLimited && !p.models.every((m) => m.local))
  }

  private getSortedByPriority(): ProviderConfig[] {
    return Array.from(this.providers.values()).sort((a, b) => a.priority - b.priority)
  }
}
