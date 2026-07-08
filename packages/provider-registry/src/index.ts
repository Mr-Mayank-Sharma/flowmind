export interface ModelCapabilities {
  temperature: boolean
  reasoning: boolean
  toolCall: boolean
  attachment: boolean
  input: { text: boolean; audio: boolean; image: boolean }
  output: { text: boolean; audio?: boolean }
}

export interface ModelInfo {
  id: string
  name: string
  providerId: string
  capabilities: ModelCapabilities
  context: number
  maxOutput: number
  cost?: { input: number; output: number }
}

export interface ProviderInfo {
  id: string
  name: string
  description: string
  authType: "api_key" | "oauth" | "none"
  baseUrl?: string
  models: ModelInfo[]
  website?: string
}

const builtInProviders: ProviderInfo[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "OpenAI models including GPT-4 and GPT-3.5",
    authType: "api_key",
    baseUrl: "https://api.openai.com/v1",
    website: "https://openai.com",
    models: [
      { id: "gpt-4o", name: "GPT-4o", providerId: "openai", context: 128000, maxOutput: 16384, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: true, input: { text: true, audio: false, image: true }, output: { text: true } } },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", providerId: "openai", context: 128000, maxOutput: 16384, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: true, input: { text: true, audio: false, image: true }, output: { text: true } } },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", providerId: "openai", context: 128000, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: true, input: { text: true, audio: false, image: true }, output: { text: true } } },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", providerId: "openai", context: 16385, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Anthropic Claude models",
    authType: "api_key",
    baseUrl: "https://api.anthropic.com/v1",
    website: "https://anthropic.com",
    models: [
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", providerId: "anthropic", context: 200000, maxOutput: 8192, capabilities: { temperature: true, reasoning: true, toolCall: true, attachment: true, input: { text: true, audio: false, image: true }, output: { text: true } } },
      { id: "claude-haiku-3-5", name: "Claude Haiku 3.5", providerId: "anthropic", context: 200000, maxOutput: 8192, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: true, input: { text: true, audio: false, image: true }, output: { text: true } } },
    ],
  },
  {
    id: "google",
    name: "Google AI",
    description: "Google Gemini models",
    authType: "api_key",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    website: "https://ai.google.dev",
    models: [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", providerId: "google", context: 1048576, maxOutput: 8192, capabilities: { temperature: true, reasoning: true, toolCall: true, attachment: true, input: { text: true, audio: true, image: true }, output: { text: true } } },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", providerId: "google", context: 1048576, maxOutput: 8192, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: true, input: { text: true, audio: true, image: true }, output: { text: true } } },
    ],
  },
  {
    id: "ollama",
    name: "Ollama",
    description: "Local models via Ollama",
    authType: "none",
    baseUrl: "http://localhost:11434",
    website: "https://ollama.ai",
    models: [
      { id: "llama3.2", name: "Llama 3.2", providerId: "ollama", context: 128000, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: false, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
      { id: "mistral", name: "Mistral", providerId: "ollama", context: 32000, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: false, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
      { id: "codellama", name: "Code Llama", providerId: "ollama", context: 16384, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: false, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
    ],
  },
  {
    id: "groq",
    name: "Groq",
    description: "Fast inference via Groq",
    authType: "api_key",
    baseUrl: "https://api.groq.com/openai/v1",
    website: "https://groq.com",
    models: [
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7b", providerId: "groq", context: 32768, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
      { id: "llama3-70b-8192", name: "Llama 3 70B", providerId: "groq", context: 8192, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "DeepSeek models",
    authType: "api_key",
    baseUrl: "https://api.deepseek.com/v1",
    website: "https://deepseek.com",
    models: [
      { id: "deepseek-chat", name: "DeepSeek Chat", providerId: "deepseek", context: 65536, maxOutput: 8192, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Multi-provider access via OpenRouter",
    authType: "api_key",
    baseUrl: "https://openrouter.ai/api/v1",
    website: "https://openrouter.ai",
    models: [
      { id: "openrouter/auto", name: "OpenRouter Auto", providerId: "openrouter", context: 128000, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: true, input: { text: true, audio: false, image: true }, output: { text: true } } },
    ],
  },
  {
    id: "together",
    name: "Together AI",
    description: "Open-source models via Together AI",
    authType: "api_key",
    baseUrl: "https://api.together.xyz/v1",
    website: "https://together.ai",
    models: [
      { id: "together-mix", name: "Together Mix", providerId: "together", context: 32768, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
    ],
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    description: "GitHub Copilot models",
    authType: "oauth",
    baseUrl: "https://api.githubcopilot.com",
    website: "https://github.com/features/copilot",
    models: [
      { id: "copilot-gpt-4o", name: "Copilot GPT-4o", providerId: "github-copilot", context: 128000, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
    ],
  },
  {
    id: "aws-bedrock",
    name: "AWS Bedrock",
    description: "Amazon Bedrock managed models",
    authType: "api_key",
    website: "https://aws.amazon.com/bedrock",
    models: [
      { id: "bedrock-claude-3", name: "Claude 3 on Bedrock", providerId: "aws-bedrock", context: 200000, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: true, input: { text: true, audio: false, image: true }, output: { text: true } } },
    ],
  },
  {
    id: "azure-openai",
    name: "Azure OpenAI",
    description: "Azure OpenAI Service",
    authType: "api_key",
    website: "https://azure.microsoft.com/en-us/products/ai-services/openai-service",
    models: [
      { id: "azure-gpt-4o", name: "Azure GPT-4o", providerId: "azure-openai", context: 128000, maxOutput: 16384, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: true, input: { text: true, audio: false, image: true }, output: { text: true } } },
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    description: "Mistral AI models",
    authType: "api_key",
    baseUrl: "https://api.mistral.ai/v1",
    website: "https://mistral.ai",
    models: [
      { id: "mistral-large-2501", name: "Mistral Large", providerId: "mistral", context: 128000, maxOutput: 8192, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
      { id: "mistral-small-2501", name: "Mistral Small", providerId: "mistral", context: 32000, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
    ],
  },
  {
    id: "perplexity",
    name: "Perplexity AI",
    description: "Perplexity AI search-powered models",
    authType: "api_key",
    baseUrl: "https://api.perplexity.ai",
    website: "https://perplexity.ai",
    models: [
      { id: "sonar-pro", name: "Sonar Pro", providerId: "perplexity", context: 200000, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: false, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
      { id: "sonar-small", name: "Sonar Small", providerId: "perplexity", context: 128000, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: false, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
    ],
  },
  {
    id: "deepinfra",
    name: "DeepInfra",
    description: "Serverless inference for open-source models",
    authType: "api_key",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    website: "https://deepinfra.com",
    models: [
      { id: "meta-llama-3.3-70b", name: "Llama 3.3 70B", providerId: "deepinfra", context: 128000, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
      { id: "mixtral-8x22b", name: "Mixtral 8x22B", providerId: "deepinfra", context: 65536, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
    ],
  },
  {
    id: "cerebras",
    name: "Cerebras",
    description: "Fast inference via Cerebras wafer-scale chips",
    authType: "api_key",
    baseUrl: "https://api.cerebras.ai/v1",
    website: "https://cerebras.ai",
    models: [
      { id: "cerebras-llama-3.3-70b", name: "Cerebras Llama 3.3 70B", providerId: "cerebras", context: 8192, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: false, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
    ],
  },
  {
    id: "xai",
    name: "xAI",
    description: "xAI Grok models",
    authType: "api_key",
    baseUrl: "https://api.x.ai/v1",
    website: "https://x.ai",
    models: [
      { id: "grok-3", name: "Grok 3", providerId: "xai", context: 131072, maxOutput: 8192, capabilities: { temperature: true, reasoning: true, toolCall: true, attachment: true, input: { text: true, audio: false, image: true }, output: { text: true } } },
    ],
  },
  {
    id: "cohere",
    name: "Cohere",
    description: "Cohere Command and embedding models",
    authType: "api_key",
    baseUrl: "https://api.cohere.ai/v1",
    website: "https://cohere.com",
    models: [
      { id: "command-r-plus", name: "Command R+", providerId: "cohere", context: 128000, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
    ],
  },
  {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    description: "Cloudflare Workers AI inference",
    authType: "api_key",
    baseUrl: "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1",
    website: "https://cloudflare.com",
    models: [
      { id: "@cf/meta/llama-3.3-70b", name: "Llama 3.3 70B (CF)", providerId: "cloudflare", context: 8192, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: false, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
    ],
  },
  {
    id: "venice-ai",
    name: "Venice AI",
    description: "Private and uncensored AI via Venice",
    authType: "api_key",
    baseUrl: "https://api.venice.ai/v1",
    website: "https://venice.ai",
    models: [
      { id: "venice-llama-3.3-70b", name: "Venice Llama 3.3 70B", providerId: "venice-ai", context: 128000, maxOutput: 4096, capabilities: { temperature: true, reasoning: false, toolCall: false, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
    ],
  },
  {
    id: "alibaba",
    name: "Alibaba Cloud (Qwen)",
    description: "Alibaba Cloud Qwen models via DashScope",
    authType: "api_key",
    baseUrl: "https://dashscope.aliyuncs.com/api/v1",
    website: "https://alibaba.cloud",
    models: [
      { id: "qwen-max", name: "Qwen Max", providerId: "alibaba", context: 32768, maxOutput: 8192, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
      { id: "qwen-plus", name: "Qwen Plus", providerId: "alibaba", context: 131072, maxOutput: 8192, capabilities: { temperature: true, reasoning: false, toolCall: true, attachment: false, input: { text: true, audio: false, image: false }, output: { text: true } } },
    ],
  },
]

export class ProviderRegistry {
  private providers: Map<string, ProviderInfo> = new Map()
  private apiKeys: Map<string, string> = new Map()

  constructor() {
    for (const p of builtInProviders) {
      this.providers.set(p.id, p)
    }
  }

  getProviders(): ProviderInfo[] {
    return Array.from(this.providers.values())
  }

  getProvider(id: string): ProviderInfo | undefined {
    return this.providers.get(id)
  }

  getModels(providerId?: string): ModelInfo[] {
    if (providerId) {
      return this.providers.get(providerId)?.models ?? []
    }
    return Array.from(this.providers.values()).flatMap((p) => p.models)
  }

  getModel(id: string): ModelInfo | undefined {
    for (const p of this.providers.values()) {
      const model = p.models.find((m) => m.id === id)
      if (model) return model
    }
    return undefined
  }

  setApiKey(providerId: string, key: string): void {
    this.apiKeys.set(providerId, key)
  }

  getApiKey(providerId: string): string | undefined {
    return this.apiKeys.get(providerId)
  }

  registerProvider(provider: ProviderInfo): void {
    this.providers.set(provider.id, provider)
  }

  searchModels(query: string): ModelInfo[] {
    const q = query.toLowerCase()
    return this.getModels().filter(
      (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.providerId.toLowerCase().includes(q)
    )
  }
}

export const providerRegistry = new ProviderRegistry()
