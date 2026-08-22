import { z } from "zod"
import { router, protectedProcedure } from "../middleware/trpc"

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434"

interface OllamaModel {
  name: string
  modified_at: string
  size: number
  digest: string
  details?: {
    format: string
    family: string
    families: string[]
    parameter_size: string
    quantization_level: string
  }
}

interface OllamaTagsResponse {
  models: OllamaModel[]
}

async function ollamaFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${OLLAMA_BASE_URL}${path}`, {
    signal: AbortSignal.timeout(15000),
    ...init,
  })
  if (!res.ok) throw new Error(`Ollama API error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

export const modelsRouter = router({

  list: protectedProcedure.query(async () => {
    try {
      const data = await ollamaFetch<OllamaTagsResponse>("/api/tags")
      return (data.models ?? []).map((m) => ({
        name: m.name,
        size: m.size,
        modified: m.modified_at,
        digest: m.digest,
        parameterSize: m.details?.parameter_size ?? "unknown",
        quantization: m.details?.quantization_level ?? "unknown",
        family: m.details?.family ?? "unknown",
      }))
    } catch {
      return []
    }
  }),

  getProviders: protectedProcedure.query(async () => {
    const providers = [
      { id: "ollama", name: "Ollama", available: false, modelCount: 0 },
      { id: "openai", name: "OpenAI", available: !!process.env.OPENAI_API_KEY, modelCount: 0 },
      { id: "anthropic", name: "Anthropic", available: !!process.env.ANTHROPIC_API_KEY, modelCount: 0 },
      { id: "google", name: "Google", available: !!process.env.GOOGLE_API_KEY, modelCount: 0 },
      { id: "groq", name: "Groq", available: !!process.env.GROQ_API_KEY, modelCount: 0 },
      { id: "deepseek", name: "DeepSeek", available: !!process.env.DEEPSEEK_API_KEY, modelCount: 0 },
      { id: "openrouter", name: "OpenRouter", available: !!process.env.OPENROUTER_API_KEY, modelCount: 0 },
      { id: "together", name: "Together", available: !!process.env.TOGETHER_API_KEY, modelCount: 0 },
      { id: "mistral", name: "Mistral", available: !!process.env.MISTRAL_API_KEY, modelCount: 0 },
    ]
    try {
      const data = await ollamaFetch<OllamaTagsResponse>("/api/tags")
      const ollama = providers.find((p) => p.id === "ollama")!
      ollama.available = true
      ollama.modelCount = data.models?.length ?? 0
    } catch {}
    return providers
  }),

  pullModel: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const res = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: input.name, stream: true }),
          signal: AbortSignal.timeout(600000),
        })
        if (!res.ok) throw new Error(`Pull failed: ${res.statusText}`)
        if (!res.body) return { status: "success", name: input.name, progress: 100 }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let progress = 0
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          for (const line of chunk.split("\n")) {
            if (!line.trim()) continue
            try {
              const msg = JSON.parse(line)
              if (msg.total && msg.completed) progress = Math.round((msg.completed / msg.total) * 100)
            } catch {}
          }
        }
        return { status: "success", name: input.name, progress }
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : "Pull failed")
      }
    }),

  deleteModel: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const res = await fetch(`${OLLAMA_BASE_URL}/api/delete`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: input.name }),
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) throw new Error(`Delete failed: ${res.statusText}`)
        return { success: true }
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : "Delete failed")
      }
    }),

  searchModels: protectedProcedure
    .input(z.object({ query: z.string().default("") }))
    .query(async ({ input }) => {
      try {
        const data = await ollamaFetch<OllamaTagsResponse>("/api/tags")
        const models = data.models ?? []
        if (!input.query) return models.map((m) => ({ name: m.name, size: m.size }))
        const q = input.query.toLowerCase()
        return models
          .filter((m) => m.name.toLowerCase().includes(q))
          .map((m) => ({ name: m.name, size: m.size }))
      } catch {
        return []
      }
    }),

  getRuntimeHealth: protectedProcedure.query(async () => {
    try {
      const res = await fetch(OLLAMA_BASE_URL, { signal: AbortSignal.timeout(3000) })
      return { online: res.ok, status: res.ok ? "ok" : "error" }
    } catch {
      return { online: false, status: "unreachable" }
    }
  }),
})
