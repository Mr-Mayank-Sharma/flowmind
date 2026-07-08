import type { ProviderFacade, CompletionRequest, CompletionResult, CompletionChunk, StreamCallbacks, Message, ToolCall, Usage } from "../types"

interface GoogleRequest {
  contents: Array<{
    role: string
    parts: Array<{
      text?: string
      inline_data?: { mime_type: string; data: string }
      function_call?: { name: string; args: Record<string, unknown> }
      function_response?: { name: string; response: Record<string, unknown> }
    }>
  }>
  system_instruction?: { parts: Array<{ text: string }> }
  generationConfig?: {
    temperature?: number
    maxOutputTokens?: number
    topP?: number
    stopSequences?: string[]
  }
  tools?: Array<{
    function_declarations: Array<{
      name: string
      description: string
      parameters: Record<string, unknown>
    }>
  }>
  tool_config?: { function_calling_config?: { mode: string; allowed_function_names?: string[] } }
}

interface GoogleResponse {
  candidates: Array<{
    content: {
      role: string
      parts: Array<{
        text?: string
        functionCall?: { name: string; args: Record<string, unknown> }
      }>
    }
    finishReason: string
    usageMetadata?: {
      promptTokenCount: number
      candidatesTokenCount: number
      totalTokenCount: number
    }
  }>
}

interface GoogleStreamChunk {
  candidates: Array<{
    content: {
      role: string
      parts: Array<{
        text?: string
        functionCall?: { name: string; args: Record<string, unknown> }
      }>
    }
    finishReason?: string
    usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number }
  }>
}

function convertMessages(messages: Message[]): { contents: GoogleRequest["contents"]; system: string | undefined } {
  let system: string | undefined
  const contents: GoogleRequest["contents"] = []

  for (const m of messages) {
    if (m.role === "system") {
      system = typeof m.content === "string" ? m.content : m.content.map((c) => "text" in c ? c.text : "").join("\n")
      continue
    }

    const parts: GoogleRequest["contents"][0]["parts"] = []

    if (typeof m.content === "string") {
      parts.push({ text: m.content })
    } else {
      for (const c of m.content) {
        if ("text" in c) parts.push({ text: c.text })
        else if ("image_url" in c) parts.push({ inline_data: { mime_type: "image/png", data: c.image_url.url.split(",")[1] ?? c.image_url.url } })
      }
    }

    if (m.role === "tool" && m.tool_call_id) {
      const name = m.name ?? "unknown"
      parts.push({
        function_response: {
          name,
          response: { result: typeof m.content === "string" ? m.content : JSON.stringify(m.content) },
        },
      })
    }

    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) {
        parts.push({
          function_call: { name: tc.function.name, args: JSON.parse(tc.function.arguments) },
        })
      }
    }

    const role = m.role === "assistant" ? "model" : "user"
    contents.push({ role, parts })
  }

  return { contents, system }
}

function convertTools(tools: NonNullable<CompletionRequest["tools"]>): GoogleRequest["tools"] {
  return [{
    function_declarations: tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    })),
  }]
}

function convertToolChoice(tc: NonNullable<CompletionRequest["tool_choice"]>): GoogleRequest["tool_config"] | undefined {
  if (tc === "none") return { function_calling_config: { mode: "NONE" } }
  if (tc === "auto" || tc === undefined) return undefined
  if (tc === "required") return { function_calling_config: { mode: "ANY" } }
  if (typeof tc === "object" && "function" in tc) {
    return { function_calling_config: { mode: "ANY", allowed_function_names: [tc.function.name] } }
  }
  return undefined
}

function mapFinishReason(reason: string): string {
  if (reason === "STOP") return "stop"
  if (reason === "MAX_TOKENS") return "max_tokens"
  if (reason === "SAFETY") return "content_filter"
  if (reason === "RECITATION") return "content_filter"
  if (reason === "FUNCTION_CALL") return "tool_calls"
  return reason
}

export function createGoogleProvider(apiKey?: string): ProviderFacade {
  const baseUrl = "https://generativelanguage.googleapis.com/v1beta"

  function buildUrl(model: string, stream: boolean): string {
    const key = apiKey ?? ""
    return `${baseUrl}/models/${model}:${stream ? "streamGenerateContent" : "generateContent"}?alt=sse&key=${key}`
  }

  async function complete(req: CompletionRequest): Promise<CompletionResult> {
    const { contents, system } = convertMessages(req.messages)
    const model = req.model ?? "gemini-2.0-flash"
    const googleReq: GoogleRequest = { contents }
    if (system) googleReq.system_instruction = { parts: [{ text: system }] }
    googleReq.generationConfig = { temperature: req.temperature, maxOutputTokens: req.maxTokens, topP: req.topP, stopSequences: req.stop ? (Array.isArray(req.stop) ? req.stop : [req.stop]) : undefined }
    if (req.tools) googleReq.tools = convertTools(req.tools)
    if (req.tool_choice) googleReq.tool_config = convertToolChoice(req.tool_choice)

    const res = await fetch(buildUrl(model, false), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(googleReq),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Google API error ${res.status}: ${text}`)
    }

    const data = (await res.json()) as GoogleResponse
    const candidate = data.candidates[0]
    if (!candidate) throw new Error("No candidates in response")

    const textParts: string[] = []
    let toolCalls: ToolCall[] | undefined

    for (const part of candidate.content.parts) {
      if (part.text) textParts.push(part.text)
      if (part.functionCall) {
        if (!toolCalls) toolCalls = []
        toolCalls.push({
          id: `fc_${part.functionCall.name}`,
          type: "function",
          function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args) },
        })
      }
    }

    const message: Message = { role: "assistant", content: textParts.join("") }
    if (toolCalls) message.tool_calls = toolCalls

    const usage: Usage = {
      prompt_tokens: data.candidates[0]?.usageMetadata?.promptTokenCount ?? 0,
      completion_tokens: data.candidates[0]?.usageMetadata?.candidatesTokenCount ?? 0,
      total_tokens: data.candidates[0]?.usageMetadata?.totalTokenCount ?? 0,
    }

    return { message, finish_reason: mapFinishReason(candidate.finishReason), usage, model, provider: "google" }
  }

  async function stream(req: CompletionRequest, callbacks: StreamCallbacks): Promise<CompletionResult> {
    const { contents, system } = convertMessages(req.messages)
    const model = req.model ?? "gemini-2.0-flash"
    const googleReq: GoogleRequest = { contents }
    if (system) googleReq.system_instruction = { parts: [{ text: system }] }
    googleReq.generationConfig = { temperature: req.temperature, maxOutputTokens: req.maxTokens, topP: req.topP, stopSequences: req.stop ? (Array.isArray(req.stop) ? req.stop : [req.stop]) : undefined }
    if (req.tools) googleReq.tools = convertTools(req.tools)
    if (req.tool_choice) googleReq.tool_config = convertToolChoice(req.tool_choice)

    const res = await fetch(buildUrl(model, true), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(googleReq),
    })

    if (!res.ok) {
      const text = await res.text()
      const err = new Error(`Google API error ${res.status}: ${text}`)
      callbacks.onError?.(err)
      throw err
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error("No response body")

    const decoder = new TextDecoder()
    let buffer = ""
    let fullContent = ""
    const collectedToolCalls: Array<{ name?: string; args?: string }> = []
    let finishReason = "stop"
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
            const parsed = JSON.parse(data) as GoogleStreamChunk
            for (const candidate of parsed.candidates ?? []) {
              for (const part of candidate.content?.parts ?? []) {
                if (part.text) {
                  fullContent += part.text
                  callbacks.onChunk?.({ delta: { content: part.text }, model, provider: "google" })
                }
                if (part.functionCall) {
                  collectedToolCalls.push({ name: part.functionCall.name, args: JSON.stringify(part.functionCall.args) })
                  callbacks.onChunk?.({ delta: { tool_calls: [{ id: `fc_${part.functionCall.name}`, type: "function", function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args) } }] }, model, provider: "google" })
                }
              }
              if (candidate.finishReason) finishReason = mapFinishReason(candidate.finishReason)
              if (candidate.usageMetadata) {
                finalUsage = {
                  prompt_tokens: candidate.usageMetadata.promptTokenCount,
                  completion_tokens: candidate.usageMetadata.candidatesTokenCount,
                  total_tokens: candidate.usageMetadata.totalTokenCount,
                }
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

    const toolCalls: ToolCall[] = collectedToolCalls.map((tc) => ({
      id: `fc_${tc.name}`,
      type: "function" as const,
      function: { name: tc.name!, arguments: tc.args ?? "{}" },
    }))

    const resultMessage: Message = { role: "assistant", content: fullContent }
    if (toolCalls.length > 0) resultMessage.tool_calls = toolCalls

    const result: CompletionResult = {
      message: resultMessage,
      finish_reason: finishReason,
      usage: finalUsage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      model,
      provider: "google",
    }

    callbacks.onDone?.(result)
    return result
  }

  return { id: "google", baseUrl, complete, stream }
}
