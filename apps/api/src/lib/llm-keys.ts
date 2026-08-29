import { type LLMConfig } from "@flowmind/llm-router"
import { providerRegistry } from "@flowmind/provider-registry"

const LLM_PROVIDER_KEY_FIELDS = [
  ["openai", "openaiKey"],
  ["anthropic", "anthropicKey"],
  ["google", "googleKey"],
  ["groq", "groqKey"],
  ["deepseek", "deepseekKey"],
  ["openrouter", "openrouterKey"],
  ["together", "togetherKey"],
  ["mistral", "mistralKey"],
  ["perplexity", "perplexityKey"],
  ["deepinfra", "deepinfraKey"],
  ["cerebras", "cerebrasKey"],
  ["xai", "xaiKey"],
  ["cohere", "cohereKey"],
  ["cloudflare", "cloudflareKey"],
  ["venice-ai", "veniceAIKey"],
  ["alibaba", "alibabaKey"],
] as const satisfies ReadonlyArray<readonly [providerId: string, field: keyof LLMConfig]>

export function buildLLMConfig(base: LLMConfig = {}): LLMConfig {
  const merged: LLMConfig = { ...base }
  for (const [providerId, field] of LLM_PROVIDER_KEY_FIELDS) {
    if (!merged[field]) {
      const registryKey = providerRegistry.getApiKey(providerId)
      if (registryKey) merged[field] = registryKey
    }
  }
  return merged
}