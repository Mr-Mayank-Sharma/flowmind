export type ProviderId = "openai" | "anthropic" | "google" | "mistral" | "ollama" | "groq" | "deepseek" | "openrouter" | "together" | "github-copilot" | "aws-bedrock" | "azure-openai" | "perplexity" | "deepinfra" | "cerebras" | "xai" | "cohere" | "cloudflare" | "venice-ai" | "alibaba"

export type AuthType = "api_key" | "oauth" | "none"

export type ApiType = "openai-compatible" | "anthropic-native" | "google-native" | "aws-bedrock" | "azure-openai" | "cloudflare-workers"

export interface ProviderInfo {
  id: ProviderId
  name: string
  description: string
  authType: AuthType
  apiType: ApiType
  baseUrl?: string
  website?: string
  docs?: string
}

export interface ModelCapabilities {
  temperature: boolean
  reasoning: boolean
  toolCall: boolean
  attachment: boolean
  vision: boolean
  audio: boolean
  streaming: boolean
}

export interface ModelCost {
  input: number
  output: number
  currency: string
}

export interface ModelVariant {
  id: string
  name: string
  providerId: ProviderId
  family: string
  context: number
  maxOutput: number
  capabilities: ModelCapabilities
  cost?: ModelCost
  releaseDate?: string
}

export interface ModelFamily {
  name: string
  providerId: ProviderId
  variants: ModelVariant[]
  description?: string
}

export interface CompletionUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface CompletionConfig {
  temperature: number
  maxTokens: number
  topP: number
  stop: string[]
}

export const DEFAULT_COMPLETION_CONFIG: CompletionConfig = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1,
  stop: [],
}

export const PROVIDER_MAP: Record<ProviderId, ProviderInfo> = {
  openai: { id: "openai", name: "OpenAI", description: "GPT-4, GPT-3.5, and more", authType: "api_key", apiType: "openai-compatible", baseUrl: "https://api.openai.com/v1", website: "https://openai.com" },
  anthropic: { id: "anthropic", name: "Anthropic", description: "Claude models", authType: "api_key", apiType: "anthropic-native", baseUrl: "https://api.anthropic.com/v1", website: "https://anthropic.com" },
  google: { id: "google", name: "Google AI", description: "Gemini models", authType: "api_key", apiType: "google-native", baseUrl: "https://generativelanguage.googleapis.com/v1beta", website: "https://ai.google.dev" },
  mistral: { id: "mistral", name: "Mistral AI", description: "Mistral Large, Small, and more", authType: "api_key", apiType: "openai-compatible", baseUrl: "https://api.mistral.ai/v1", website: "https://mistral.ai" },
  ollama: { id: "ollama", name: "Ollama", description: "Local models via Ollama", authType: "none", apiType: "openai-compatible", baseUrl: "http://localhost:11434", website: "https://ollama.ai" },
  groq: { id: "groq", name: "Groq", description: "Fast inference on LPUs", authType: "api_key", apiType: "openai-compatible", baseUrl: "https://api.groq.com/openai/v1", website: "https://groq.com" },
  deepseek: { id: "deepseek", name: "DeepSeek", description: "DeepSeek Chat and Code", authType: "api_key", apiType: "openai-compatible", baseUrl: "https://api.deepseek.com/v1", website: "https://deepseek.com" },
  openrouter: { id: "openrouter", name: "OpenRouter", description: "Unified API for many models", authType: "api_key", apiType: "openai-compatible", baseUrl: "https://openrouter.ai/api/v1", website: "https://openrouter.ai" },
  together: { id: "together", name: "Together AI", description: "Open-source model inference", authType: "api_key", apiType: "openai-compatible", baseUrl: "https://api.together.xyz/v1", website: "https://together.ai" },
  "github-copilot": { id: "github-copilot", name: "GitHub Copilot", description: "Copilot models via GitHub", authType: "oauth", apiType: "openai-compatible", baseUrl: "https://api.githubcopilot.com", website: "https://github.com/features/copilot" },
  "aws-bedrock": { id: "aws-bedrock", name: "AWS Bedrock", description: "Managed foundation models", authType: "api_key", apiType: "aws-bedrock", website: "https://aws.amazon.com/bedrock" },
  "azure-openai": { id: "azure-openai", name: "Azure OpenAI", description: "OpenAI via Azure", authType: "api_key", apiType: "azure-openai", website: "https://azure.microsoft.com/en-us/products/ai-services/openai-service" },
  perplexity: { id: "perplexity", name: "Perplexity AI", description: "Search-powered models", authType: "api_key", apiType: "openai-compatible", baseUrl: "https://api.perplexity.ai", website: "https://perplexity.ai" },
  deepinfra: { id: "deepinfra", name: "DeepInfra", description: "Serverless open-source inference", authType: "api_key", apiType: "openai-compatible", baseUrl: "https://api.deepinfra.com/v1/openai", website: "https://deepinfra.com" },
  cerebras: { id: "cerebras", name: "Cerebras", description: "Wafer-scale fast inference", authType: "api_key", apiType: "openai-compatible", baseUrl: "https://api.cerebras.ai/v1", website: "https://cerebras.ai" },
  xai: { id: "xai", name: "xAI", description: "Grok models", authType: "api_key", apiType: "openai-compatible", baseUrl: "https://api.x.ai/v1", website: "https://x.ai" },
  cohere: { id: "cohere", name: "Cohere", description: "Command and embedding models", authType: "api_key", apiType: "openai-compatible", baseUrl: "https://api.cohere.ai/v1", website: "https://cohere.com" },
  cloudflare: { id: "cloudflare", name: "Cloudflare Workers AI", description: "AI inference on Cloudflare", authType: "api_key", apiType: "cloudflare-workers", website: "https://cloudflare.com" },
  "venice-ai": { id: "venice-ai", name: "Venice AI", description: "Private uncensored AI", authType: "api_key", apiType: "openai-compatible", baseUrl: "https://api.venice.ai/v1", website: "https://venice.ai" },
  alibaba: { id: "alibaba", name: "Alibaba Cloud (Qwen)", description: "Qwen models via DashScope", authType: "api_key", apiType: "openai-compatible", baseUrl: "https://dashscope.aliyuncs.com/api/v1", website: "https://alibaba.cloud" },
}
