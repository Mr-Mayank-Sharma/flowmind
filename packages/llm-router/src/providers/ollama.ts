import type { ProviderFacade, CompletionRequest, CompletionResult, CompletionChunk, StreamCallbacks, Message, Usage } from "../types"

interface OllamaChatRequest {
  model: string
  messages: Array<{ role: string; content: string }>
  stream?: boolean
  options?: { temperature?: number; top_p?: number; stop?: string[]; num_predict?: number }
}

interface OllamaChatResponse {
  model: string
  created_at: string
  message: { role: string; content: string }
  done: boolean
  total_duration?: number
  prompt_eval_count?: number
  eval_count?: number
}

interface OllamaTagsResponse {
  models: Array<{ name: string; modified_at: string; size: number; digest: string; details?: { family: string; parameter_size: string; quantization_level: string } }>
}

function convertMessages(messages: Message[]): Array<{ role: string; content: string }> {
  return messages.map((m) => ({
    role: m.role === "tool" ? "user" : m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user",
    content: typeof m.content === "string" ? m.content : m.content.map((c) => ("text" in c ? c.text : "")).join(" "),
  }))
}

export function createOllamaProvider(baseUrl?: string): ProviderFacade {
  const url = (baseUrl ?? "http://localhost:11434").replace(/\/$/, "")

  async function listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) })
      if (!res.ok) return []
      const data = (await res.json()) as OllamaTagsResponse
      return data.models.map((m) => m.name)
    } catch {
      return []
    }
  }

  async function complete(req: CompletionRequest): Promise<CompletionResult> {
    const ollamaReq: OllamaChatRequest = {
      model: req.model ?? "tinyllama",
      messages: convertMessages(req.messages),
      options: {
        temperature: req.temperature,
        top_p: req.topP,
        stop: req.stop ? (Array.isArray(req.stop) ? req.stop : [req.stop]) : undefined,
        num_predict: req.maxTokens,
      },
    }

    const res = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ollamaReq),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Ollama API error ${res.status}: ${text}`)
    }

    const data = (await res.json()) as OllamaChatResponse
    const content = data.message?.content ?? ""

    const usage: Usage = {
      prompt_tokens: data.prompt_eval_count ?? 0,
      completion_tokens: data.eval_count ?? 0,
      total_tokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
    }

    return {
      message: { role: "assistant", content },
      finish_reason: "stop",
      usage,
      model: data.model,
      provider: "ollama",
    }
  }

  async function stream(req: CompletionRequest, callbacks: StreamCallbacks): Promise<CompletionResult> {
    const ollamaReq: OllamaChatRequest = {
      model: req.model ?? "tinyllama",
      messages: convertMessages(req.messages),
      stream: true,
      options: {
        temperature: req.temperature,
        top_p: req.topP,
        stop: req.stop ? (Array.isArray(req.stop) ? req.stop : [req.stop]) : undefined,
        num_predict: req.maxTokens,
      },
    }

    const res = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ollamaReq),
    })

    if (!res.ok) {
      const text = await res.text()
      const err = new Error(`Ollama API error ${res.status}: ${text}`)
      callbacks.onError?.(err)
      throw err
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error("No response body")

    const decoder = new TextDecoder()
    let buffer = ""
    let fullContent = ""
    let finalModel = ollamaReq.model
    let finalUsage: Usage | undefined

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          try {
            const chunk = JSON.parse(trimmed) as OllamaChatResponse & { done: boolean }
            finalModel = chunk.model

            if (chunk.message?.content) {
              fullContent += chunk.message.content
              callbacks.onChunk?.({ delta: { content: chunk.message.content }, model: chunk.model, provider: "ollama" })
            }

            if (chunk.done) {
              finalUsage = {
                prompt_tokens: chunk.prompt_eval_count ?? 0,
                completion_tokens: chunk.eval_count ?? 0,
                total_tokens: (chunk.prompt_eval_count ?? 0) + (chunk.eval_count ?? 0),
              }
            }
          } catch {}
        }
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      callbacks.onError?.(err)
      throw err
    }

    const result: CompletionResult = {
      message: { role: "assistant", content: fullContent },
      finish_reason: "stop",
      usage: finalUsage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      model: finalModel,
      provider: "ollama",
    }

    callbacks.onDone?.(result)
    return result
  }

  return { id: "ollama", baseUrl: url, complete, stream }
}
