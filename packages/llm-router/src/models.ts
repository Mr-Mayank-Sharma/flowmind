const PREFERRED_LOCAL_MODELS = ["llama3.1", "llama3.2", "qwen2.5", "qwen2.5-coder", "llama3", "mistral", "gemma2"]

const CACHE_TTL_MS = 30_000

let modelCache: { timestamp: number; models: string[] } | null = null

export async function getInstalledOllamaModels(baseUrl?: string): Promise<string[]> {
  if (modelCache && Date.now() - modelCache.timestamp < CACHE_TTL_MS) {
    return modelCache.models
  }

  const ollamaBase = baseUrl || process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || "http://localhost:11434"
  try {
    const res = await fetch(`${ollamaBase}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return []
    const data = (await res.json()) as { models?: Array<{ name: string }> }
    const models = (data.models ?? []).map((m) => m.name)
    modelCache = { timestamp: Date.now(), models }
    return models
  } catch {
    return []
  }
}

export function clearOllamaModelCache(): void {
  modelCache = null
}

export async function resolveDefaultOllamaModel(requested?: string, baseUrl?: string): Promise<string | null> {
  const installed = await getInstalledOllamaModels(baseUrl)
  if (installed.length === 0) return null

  if (requested) {
    const exact = installed.find((m) => m === requested || m.startsWith(`${requested}:`))
    if (exact) return exact
    return null
  }

  for (const preferred of PREFERRED_LOCAL_MODELS) {
    const match = installed.find((m) => m === preferred || m.startsWith(`${preferred}:`))
    if (match) return match
  }
  return installed[0] ?? null
}
