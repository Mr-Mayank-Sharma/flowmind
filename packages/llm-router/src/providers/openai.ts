import type { ProviderFacade, CompletionRequest, CompletionResult, CompletionChunk, StreamCallbacks, Message, ToolCall, Usage } from "../types"

export interface OpenAIConfig {
  apiKey?: string
  baseUrl?: string
}

interface OpenAIRequest {
  model: string
  messages: Array<{
    role: string
    content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }>
    name?: string
    tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>
    tool_call_id?: string
  }>
  stream?: boolean
  temperature?: number
  max_tokens?: number
  top_p?: number
  stop?: string | string[]
  tools?: Array<{
    type: "function"
    function: { name: string; description: string; parameters: Record<string, unknown> }
  }>
  tool_choice?: string | Record<string, unknown>
  response_format?: { type: string; json_schema?: Record<string, unknown> }
  stream_options?: { include_usage: boolean }
}

interface OpenAIResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string | null
      tool_calls?: Array<{
        id: string
        type: "function"
        function: { name: string; arguments: string }
      }>
    }
    finish_reason: string
  }>
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

interface OpenAIStreamChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string
      tool_calls?: Array<{
        index: number
        id?: string
        type?: "function"
        function?: { name?: string; arguments?: string }
      }>
    }
    finish_reason: string | null
  }>
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

function convertMessages(messages: Message[]): OpenAIRequest["messages"] {
  return messages.map((m) => {
    const base: Record<string, unknown> = { role: m.role }
    if (m.name) base.name = m.name
    if (m.tool_call_id) base.tool_call_id = m.tool_call_id

    if (typeof m.content === "string") {
      base.content = m.content
    } else {
      base.content = m.content.map((c) => {
        if (c.type === "text") return { type: "text", text: c.text }
        if (c.type === "image_url") return { type: "image_url", image_url: c.image_url }
        return { type: "text", text: "" }
      })
    }

    if (m.tool_calls) {
      base.tool_calls = m.tool_calls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }))
    }

    return base as OpenAIRequest["messages"][0]
  })
}

function mapFinishReason(reason: string): string {
  if (reason === "stop") return "stop"
  if (reason === "length") return "max_tokens"
  if (reason === "tool_calls") return "tool_calls"
  return reason
}

function buildToolCalls(tcs: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>): ToolCall[] {
  return tcs.map((tc) => ({
    id: tc.id,
    type: "function" as const,
    function: { name: tc.function.name, arguments: tc.function.arguments },
  }))
}

export function createOpenAIProvider(config?: OpenAIConfig): ProviderFacade {
  const apiKey = config?.apiKey
  const baseUrl = (config?.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "")

  async function request(body: OpenAIRequest): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`
    return fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })
  }

  async function complete(req: CompletionRequest): Promise<CompletionResult> {
    const oaiReq: OpenAIRequest = {
      model: req.model ?? "gpt-4o",
      messages: convertMessages(req.messages),
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      top_p: req.topP,
      stop: req.stop,
    }
    if (req.tools) oaiReq.tools = req.tools
    if (req.tool_choice) {
      oaiReq.tool_choice = typeof req.tool_choice === "string" ? req.tool_choice : req.tool_choice
    }
    if (req.response_format) oaiReq.response_format = req.response_format

    const res = await request(oaiReq)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`OpenAI API error ${res.status}: ${text}`)
    }

    const data = (await res.json()) as OpenAIResponse
    const choice = data.choices[0]!
    const message: Message = { role: "assistant", content: choice.message.content ?? "" }
    if (choice.message.tool_calls) {
      message.tool_calls = buildToolCalls(choice.message.tool_calls)
    }

    const usage: Usage = {
      prompt_tokens: data.usage.prompt_tokens,
      completion_tokens: data.usage.completion_tokens,
      total_tokens: data.usage.total_tokens,
    }

    return { message, finish_reason: mapFinishReason(choice.finish_reason), usage, model: data.model, provider: "openai" }
  }

  async function stream(req: CompletionRequest, callbacks: StreamCallbacks): Promise<CompletionResult> {
    const oaiReq: OpenAIRequest = {
      model: req.model ?? "gpt-4o",
      messages: convertMessages(req.messages),
      stream: true,
      stream_options: { include_usage: true },
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      top_p: req.topP,
      stop: req.stop,
    }
    if (req.tools) oaiReq.tools = req.tools
    if (req.tool_choice) {
      oaiReq.tool_choice = typeof req.tool_choice === "string" ? req.tool_choice : req.tool_choice
    }
    if (req.response_format) oaiReq.response_format = req.response_format

    const res = await request(oaiReq)
    if (!res.ok) {
      const text = await res.text()
      const err = new Error(`OpenAI API error ${res.status}: ${text}`)
      callbacks.onError?.(err)
      throw err
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error("No response body")

    const decoder = new TextDecoder()
    let buffer = ""
    let fullContent = ""
    const collectedToolCalls: Array<{ index: number; id?: string; type?: string; function?: { name?: string; arguments?: string } }> = []
    let finishReason = "stop"
    let finalModel = oaiReq.model
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
          if (!trimmed || !trimmed.startsWith("data: ")) continue
          const data = trimmed.slice(6)
          if (data === "[DONE]") continue

          try {
            const parsed = JSON.parse(data) as OpenAIStreamChunk
            finalModel = parsed.model

            for (const choice of parsed.choices) {
              const delta = choice.delta
              const chunk: CompletionChunk = { delta: {}, model: parsed.model, provider: "openai" }
              if (delta.role) chunk.delta.role = delta.role as any
              if (delta.content) {
                chunk.delta.content = delta.content
                fullContent += delta.content
              }
              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  collectedToolCalls[tc.index] = {
                    ...collectedToolCalls[tc.index],
                    index: tc.index,
                    id: tc.id ?? collectedToolCalls[tc.index]?.id,
                    type: tc.type ?? collectedToolCalls[tc.index]?.type,
                    function: {
                      name: tc.function?.name ?? collectedToolCalls[tc.index]?.function?.name ?? "",
                      arguments: tc.function?.arguments ?? collectedToolCalls[tc.index]?.function?.arguments ?? "",
                    },
                  }
                }
                chunk.delta.tool_calls = delta.tool_calls.map((tc) => ({
                  id: tc.id ?? "",
                  type: "function" as const,
                  function: { name: tc.function?.name ?? "", arguments: tc.function?.arguments ?? "" },
                }))
              }
              if (choice.finish_reason) {
                finishReason = mapFinishReason(choice.finish_reason)
                chunk.finish_reason = finishReason
              }
              callbacks.onChunk?.(chunk)
            }

            if (parsed.usage) {
              finalUsage = {
                prompt_tokens: parsed.usage.prompt_tokens,
                completion_tokens: parsed.usage.completion_tokens,
                total_tokens: parsed.usage.total_tokens,
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

    const toolCalls: ToolCall[] = collectedToolCalls
      .filter((tc) => tc?.id && tc?.function?.name)
      .map((tc) => ({
        id: tc.id!,
        type: "function" as const,
        function: { name: tc.function!.name!, arguments: tc.function!.arguments ?? "" },
      }))

    const resultMessage: Message = { role: "assistant", content: fullContent }
    if (toolCalls.length > 0) resultMessage.tool_calls = toolCalls

    const result: CompletionResult = {
      message: resultMessage,
      finish_reason: finishReason,
      usage: finalUsage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      model: finalModel,
      provider: "openai",
    }

    callbacks.onDone?.(result)
    return result
  }

  return { id: "openai", baseUrl, complete, stream }
}
