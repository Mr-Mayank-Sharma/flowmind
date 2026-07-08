import type { ProviderFacade, CompletionRequest, CompletionResult, CompletionChunk, StreamCallbacks, Message, ToolCall, Usage, ContentBlock } from "../types"

interface AnthropicRequest {
  model: string
  messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>
  system?: string | Array<{ type: string; text: string }>
  max_tokens: number
  stream?: boolean
  temperature?: number
  top_p?: number
  stop_sequences?: string[]
  tools?: Array<{
    name: string
    description: string
    input_schema: Record<string, unknown>
  }>
  tool_choice?: { type: "auto" | "any" | "tool"; name?: string }
}

interface AnthropicResponse {
  id: string
  type: string
  role: string
  content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>
  model: string
  stop_reason: string | null
  usage: { input_tokens: number; output_tokens: number }
}

interface AnthropicStreamEvent {
  type: string
  delta?: { text?: string; stop_reason?: string; type?: string }
  content_block?: { type: string; id?: string; name?: string; input?: Record<string, unknown> }
  content_block_delta?: { type: string; text?: string; partial_json?: string }
  message?: { id: string; model: string }
  usage?: { input_tokens: number; output_tokens: number }
}

function convertMessages(messages: Message[]): { msgs: AnthropicRequest["messages"]; system: string | undefined } {
  let system: string | undefined
  const msgs: AnthropicRequest["messages"] = []

  for (const m of messages) {
    if (m.role === "system") {
      system = typeof m.content === "string" ? m.content : m.content.map((c) => "text" in c ? c.text : "").join("\n")
      continue
    }

    if (m.role === "tool") {
      msgs.push({ role: "user", content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }] })
      continue
    }

    if (m.role === "assistant" && m.tool_calls) {
      const content: Array<Record<string, unknown>> = []
      if (m.content) {
        if (typeof m.content === "string") content.push({ type: "text", text: m.content })
        else content.push(...(m.content as unknown as Array<Record<string, unknown>>))
      }
      for (const tc of m.tool_calls) {
        content.push({ type: "tool_use", id: tc.id, name: tc.function.name, input: JSON.parse(tc.function.arguments) })
      }
      msgs.push({ role: "assistant", content })
      continue
    }

    if (typeof m.content === "string") {
      msgs.push({ role: m.role, content: m.content })
    } else {
      msgs.push({ role: m.role, content: m.content as any })
    }
  }

  return { msgs, system }
}

function convertTools(tools: NonNullable<CompletionRequest["tools"]>): AnthropicRequest["tools"] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }))
}

function convertToolChoice(tc: NonNullable<CompletionRequest["tool_choice"]>): AnthropicRequest["tool_choice"] {
  if (tc === "auto") return { type: "auto" }
  if (tc === "required") return { type: "any" }
  if (tc === "none") return undefined
  if (typeof tc === "object" && "function" in tc) {
    return { type: "tool", name: tc.function.name }
  }
  return { type: "auto" }
}

function mapStopReason(reason: string | null): string {
  if (reason === "end_turn") return "stop"
  if (reason === "max_tokens") return "max_tokens"
  if (reason === "tool_use") return "tool_calls"
  return reason ?? "stop"
}

export function createAnthropicProvider(apiKey?: string): ProviderFacade {
  const baseUrl = "https://api.anthropic.com/v1"

  async function complete(req: CompletionRequest): Promise<CompletionResult> {
    const { msgs, system } = convertMessages(req.messages)
    const anthropicReq: AnthropicRequest = {
      model: req.model ?? "claude-sonnet-4-20250514",
      messages: msgs,
      max_tokens: req.maxTokens ?? 8192,
      temperature: req.temperature,
      top_p: req.topP,
      stop_sequences: req.stop ? (Array.isArray(req.stop) ? req.stop : [req.stop]) : undefined,
    }
    if (system) anthropicReq.system = system
    if (req.tools) anthropicReq.tools = convertTools(req.tools)
    if (req.tool_choice) anthropicReq.tool_choice = convertToolChoice(req.tool_choice)

    const res = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(anthropicReq),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Anthropic API error ${res.status}: ${text}`)
    }

    const data = (await res.json()) as AnthropicResponse
    const textParts: string[] = []
    let toolCalls: ToolCall[] | undefined

    for (const block of data.content) {
      if (block.type === "text" && block.text) textParts.push(block.text)
      if (block.type === "tool_use" && block.id && block.name) {
        if (!toolCalls) toolCalls = []
        toolCalls.push({
          id: block.id,
          type: "function",
          function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
        })
      }
    }

    const message: Message = { role: "assistant", content: textParts.join("") }
    if (toolCalls) message.tool_calls = toolCalls

    const usage: Usage = {
      prompt_tokens: data.usage.input_tokens,
      completion_tokens: data.usage.output_tokens,
      total_tokens: data.usage.input_tokens + data.usage.output_tokens,
    }

    return { message, finish_reason: mapStopReason(data.stop_reason), usage, model: data.model, provider: "anthropic" }
  }

  async function stream(req: CompletionRequest, callbacks: StreamCallbacks): Promise<CompletionResult> {
    const { msgs, system } = convertMessages(req.messages)
    const anthropicReq: AnthropicRequest = {
      model: req.model ?? "claude-sonnet-4-20250514",
      messages: msgs,
      max_tokens: req.maxTokens ?? 8192,
      stream: true,
      temperature: req.temperature,
      top_p: req.topP,
      stop_sequences: req.stop ? (Array.isArray(req.stop) ? req.stop : [req.stop]) : undefined,
    }
    if (system) anthropicReq.system = system
    if (req.tools) anthropicReq.tools = convertTools(req.tools)
    if (req.tool_choice) anthropicReq.tool_choice = convertToolChoice(req.tool_choice)

    const res = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(anthropicReq),
    })

    if (!res.ok) {
      const text = await res.text()
      const err = new Error(`Anthropic API error ${res.status}: ${text}`)
      callbacks.onError?.(err)
      throw err
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error("No response body")

    const decoder = new TextDecoder()
    let buffer = ""
    let fullContent = ""
    const collectedToolCalls: Array<{ id?: string; name?: string; input?: string }> = []
    let finishReason = "stop"
    let finalModel = anthropicReq.model
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
          if (!trimmed || !trimmed.startsWith("event:") || trimmed.startsWith("event: ping")) continue
          if (!trimmed.startsWith("data: ")) {
            if (!trimmed.startsWith("event:")) continue
            const nextLineIdx = lines.indexOf(line) + 1
            if (nextLineIdx < lines.length) {
              const dataLine = lines[nextLineIdx]?.trim()
              if (!dataLine?.startsWith("data: ")) continue
              const data = dataLine.slice(6)
              try {
                const event = JSON.parse(data) as AnthropicStreamEvent
                processEvent(event)
              } catch {}
            }
            continue
          }

          const data = trimmed.slice(6)
          try {
            const event = JSON.parse(data) as AnthropicStreamEvent
            processEvent(event)
          } catch {}
        }
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      callbacks.onError?.(err)
      throw err
    }

    function processEvent(event: AnthropicStreamEvent) {
      if (event.message?.model) finalModel = event.message.model
      if (event.usage) {
        finalUsage = { prompt_tokens: event.usage.input_tokens, completion_tokens: event.usage.output_tokens, total_tokens: event.usage.input_tokens + event.usage.output_tokens }
      }

      if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
        const cb = event.content_block
        collectedToolCalls.push({ id: cb.id, name: cb.name, input: "" })
      }

      if (event.type === "content_block_delta") {
        const delta = event.content_block_delta
        if (delta?.type === "text_delta" && delta.text) {
          fullContent += delta.text
          callbacks.onChunk?.({ delta: { content: delta.text }, model: finalModel, provider: "anthropic" })
        }
        if (delta?.type === "input_json_delta" && delta.partial_json && collectedToolCalls.length > 0) {
          const last = collectedToolCalls[collectedToolCalls.length - 1]!
          last.input = (last.input ?? "") + delta.partial_json
        }
      }

      if (event.type === "message_delta" && event.delta) {
        if (event.delta.stop_reason) {
          finishReason = mapStopReason(event.delta.stop_reason)
        }
      }

      if (event.type === "message_stop" || event.type === "message_complete") {
        // done — will be handled after the reader loop
      }
    }

    const toolCalls: ToolCall[] = collectedToolCalls
      .filter((tc) => tc.id && tc.name)
      .map((tc) => ({
        id: tc.id!,
        type: "function" as const,
        function: { name: tc.name!, arguments: tc.input ?? "{}" },
      }))

    const resultMessage: Message = { role: "assistant", content: fullContent }
    if (toolCalls.length > 0) resultMessage.tool_calls = toolCalls

    const result: CompletionResult = {
      message: resultMessage,
      finish_reason: finishReason,
      usage: finalUsage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      model: finalModel,
      provider: "anthropic",
    }

    callbacks.onDone?.(result)
    return result
  }

  return { id: "anthropic", baseUrl, complete, stream }
}
