export type MessageRole = "user" | "assistant" | "system" | "tool"

export interface TextContent {
  type: "text"
  text: string
}

export interface ImageContent {
  type: "image_url"
  image_url: { url: string; detail?: "low" | "high" | "auto" }
}

export type ContentBlock = TextContent | ImageContent

export interface ToolCall {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

export interface Message {
  role: MessageRole
  content: string | ContentBlock[]
  name?: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface ToolDefinition {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface CompletionRequest {
  messages: Message[]
  model?: string
  provider?: string
  stream?: boolean
  temperature?: number
  maxTokens?: number
  topP?: number
  stop?: string | string[]
  tools?: ToolDefinition[]
  tool_choice?: "auto" | "required" | "none" | { type: "function"; function: { name: string } }
  response_format?: { type: "json_object" | "json_schema"; json_schema?: Record<string, unknown> }
}

export interface Usage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface CompletionResult {
  message: Message
  finish_reason: string
  usage: Usage
  model: string
  provider: string
}

export interface CompletionChunk {
  delta: { role?: MessageRole; content?: string; tool_calls?: ToolCall[] }
  finish_reason?: string
  usage?: Usage
  model: string
  provider: string
}

export interface StreamCallbacks {
  onChunk?: (chunk: CompletionChunk) => void
  onDone?: (result: CompletionResult) => void
  onError?: (error: Error) => void
}

export interface ProviderFacade {
  id: string
  baseUrl: string
  complete(req: CompletionRequest): Promise<CompletionResult>
  stream(req: CompletionRequest, callbacks: StreamCallbacks): Promise<CompletionResult>
}

export type ProviderFactory = (apiKey?: string, baseUrl?: string) => ProviderFacade
