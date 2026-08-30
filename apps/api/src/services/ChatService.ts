import { CircuitBreaker, withRetry, logger } from "../infrastructure"
import { MessageRole } from "@flowmind/shared"
import { ContextEngine, type ContextChunk } from "@flowmind/context-engine"
import { LLMEngine, runAgentLoop, resolveDefaultOllamaModel, type AgentTool, type AgentLoopStep } from "@flowmind/llm-router"
import { toolRegistry } from "@flowmind/tool-system"
import { listMcpAgentToolsForUser } from "./mcp-client"
import { config } from "../lib/config"
import { buildLLMConfig } from "../lib/llm-keys"

let _contextEngine: ContextEngine | null = null
function getContextEngine(): ContextEngine {
  if (!_contextEngine) _contextEngine = new ContextEngine()
  return _contextEngine
}

const AGENT_RUNTIME_URL = config.agentRuntimeUrl

const CLOUD_DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  google: "gemini-2.0-flash",
  groq: "llama-3.1-8b-instant",
  deepseek: "deepseek-chat",
  openrouter: "openai/gpt-4o-mini",
  together: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  mistral: "mistral-small-latest",
}

function buildLLMEngine(): LLMEngine {
  return new LLMEngine(buildLLMConfig(config))
}

const NON_DESTRUCTIVE_TOOLS = new Set(["read", "grep", "glob", "webfetch", "websearch", "http_request", "todowrite"])

async function buildChatTools(sessionId: string, userId: string): Promise<AgentTool[]> {
  const defs = toolRegistry.all().filter((def) => NON_DESTRUCTIVE_TOOLS.has(def.id))
  const noopCtx = {
    sessionId,
    messageId: `chat_${Date.now()}`,
    agent: "chat",
    async ask() {},
    metadata() {},
  }

  const localTools = defs.map((def) => ({
    name: def.id,
    description: def.description,
    parameters: def.parameters,
    async execute(args: Record<string, unknown>): Promise<string> {
      const result = await def.execute(args, noopCtx)
      return result.output
    },
  }))

  let mcpTools: AgentTool[] = []
  try {
    mcpTools = await listMcpAgentToolsForUser(userId)
  } catch (err) {
    logger.warn({ userId, err }, "MCP tool discovery failed, continuing with local tools only")
  }

  return [...localTools, ...mcpTools]
}

const CHAT_SYSTEM_PROMPT = `You are FlowMind, an AI assistant that can use tools to help users accomplish tasks.

You have access to various tools including file operations, web search, code execution, and more.
Use tools when they would help you provide a better answer. Be concise and helpful.

When you need to use a tool, respond with EXACTLY:
CALL_TOOL: toolName(arguments)

After receiving the tool result, continue reasoning and provide your final answer with:
FINAL_ANSWER: your response here

Always aim to be helpful, accurate, and concise.`

const agentRuntimeCircuitBreaker = new CircuitBreaker(3, 30_000)

export interface SendMessageInput {
  sessionId: string
  content: string
  files?: { url: string; type: string }[]
  model?: string
  tools?: string[]
  userId: string
}

export interface SendMessageResult {
  reply: string
  steps?: AgentLoopStep[]
  iterations?: number
  error?: boolean
}

export interface StreamingCallbacks {
  onStep: (step: AgentLoopStep) => void
  onDone: (result: SendMessageResult) => void
  onError: (error: Error) => void
}

export type SaveMessageFn = (role: MessageRole, content: string, options?: { error?: boolean }) => Promise<any>

async function callAgentRuntime(input: SendMessageInput): Promise<{ reply: string; generated: boolean }> {
  const res = await fetch(`${AGENT_RUNTIME_URL}/chat/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.AGENT_API_KEY ? { Authorization: `Bearer ${process.env.AGENT_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      session_id: input.sessionId,
      message: input.content,
      user_id: input.userId,
      model: input.model,
      tools: input.tools,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    throw new Error(`Agent runtime returned ${res.status}: ${res.statusText}`)
  }

  const data = await res.json()
  const rawReply = typeof data?.reply === "string" ? data.reply : ""
  return { reply: rawReply || "I processed your request.", generated: rawReply.trim().length > 0 }
}

async function callAgentRuntimeWithRetry(input: SendMessageInput): Promise<{ reply: string; isFallback: boolean; generated: boolean }> {
  return agentRuntimeCircuitBreaker.call(
    () =>
      withRetry(() => callAgentRuntime(input), {
        maxRetries: 2,
        baseDelayMs: 500,
        retryOn: (err) => {
          const status = (err as any)?.status
          return !status || status >= 500 || status === 429
        },
      }).then((result) => ({ ...result, isFallback: false })),
    async () => {
      logger.warn("Circuit breaker open for agent runtime, using fallback")
      return { reply: "The agent runtime is temporarily unavailable. Your message has been saved.", isFallback: true, generated: false }
    },
  )
}

export class ChatService {
  async sendMessage(input: SendMessageInput, saveMessage: SaveMessageFn): Promise<{ message: any; reply: string; error: boolean }> {
    const startTime = Date.now()

    await saveMessage(MessageRole.USER, input.content)

    let reply: string
    let isError: boolean
    try {
      let enhancedInput = input
      try {
        const chunks = await getContextEngine().search({ text: input.content, userId: input.userId, topK: 3 })
        if (chunks.length > 0) {
          const contextStr = chunks.map((c: ContextChunk) => c.content).join("\n\n")
          enhancedInput = { ...input, content: `Context:\n${contextStr}\n\nUser: ${input.content}` }
        }
      } catch {
        logger.debug({ userId: input.userId, sessionId: input.sessionId }, "Context engine search failed, proceeding without context");
      }
      const result = await callAgentRuntimeWithRetry(enhancedInput)
      reply = result.reply
      isError = result.isFallback || !result.generated
    } catch (err) {
      logger.error({ err, sessionId: input.sessionId, durationMs: Date.now() - startTime }, "Agent runtime call failed after all retries")
      reply = "I encountered an error processing your request. Please try again."
      isError = true
    }

    const assistantMessage = await saveMessage(MessageRole.ASSISTANT, reply, { error: isError })

    logger.info({ sessionId: input.sessionId, durationMs: Date.now() - startTime, userId: input.userId }, "Message processed")

    return { message: assistantMessage, reply, error: isError }
  }

  async sendMessageWithAgentLoop(
    input: SendMessageInput,
    saveMessage: SaveMessageFn,
    callbacks?: StreamingCallbacks,
  ): Promise<{ message: any; reply: string; steps: AgentLoopStep[]; iterations: number; error: boolean }> {
    const startTime = Date.now()
    const requestedModel = input.model?.trim() || ""

    await saveMessage(MessageRole.USER, input.content)

    let enrichedContent = input.content
    try {
      const chunks = await getContextEngine().search({ text: input.content, userId: input.userId, topK: 3 })
      if (chunks.length > 0) {
        const contextStr = chunks.map((c: ContextChunk) => c.content).join("\n\n")
        enrichedContent = `Context:\n${contextStr}\n\nUser: ${input.content}`
      }
    } catch {
      logger.debug({ userId: input.userId, sessionId: input.sessionId }, "Context engine search failed, proceeding without context")
    }

    const engine = buildLLMEngine()
    let provider
    try {
      provider = engine.getProvider("openai") || engine.getProvider("anthropic") || engine.getProvider("ollama")
    } catch {}
    if (!provider) {
      const providers = engine.getProviders()
      provider = providers[0]
    }

    if (!provider) {
      const reply = "No LLM provider is configured. Please add an API key in Settings."
      const assistantMessage = await saveMessage(MessageRole.ASSISTANT, reply, { error: true })
      callbacks?.onError(new Error(reply))
      return { message: assistantMessage, reply, steps: [], iterations: 0, error: true }
    }

    let model: string
    if (requestedModel) {
      const local = await resolveDefaultOllamaModel(requestedModel)
      model = local || requestedModel
    } else if (provider.id === "ollama" || provider.id === "local") {
      model = (await resolveDefaultOllamaModel()) || "tinyllama"
    } else {
      model = CLOUD_DEFAULT_MODELS[provider.id] ?? "tinyllama"
    }

    const tools = await buildChatTools(input.sessionId, input.userId)

    try {
      const result = await runAgentLoop({
        provider,
        model,
        systemPrompt: CHAT_SYSTEM_PROMPT,
        userMessage: enrichedContent,
        tools,
        maxIterations: 25,
        maxTokens: 4096,
        onStep: (step) => callbacks?.onStep(step),
      })

      const rawReply = typeof result.response === "string" ? result.response : ""
      const reply = rawReply || "I processed your request."
      const isError = rawReply.trim().length === 0
      const assistantMessage = await saveMessage(MessageRole.ASSISTANT, reply, { error: isError })

      logger.info({
        sessionId: input.sessionId,
        durationMs: Date.now() - startTime,
        userId: input.userId,
        iterations: result.iterations,
        error: isError,
        toolCalls: result.steps.filter((s) => s.type === "tool_call").length,
      }, "Agent loop completed")

      callbacks?.onDone({ reply, steps: result.steps, iterations: result.iterations, error: isError })

      return { message: assistantMessage, reply, steps: result.steps, iterations: result.iterations, error: isError }
    } catch (err) {
      logger.error({ err, sessionId: input.sessionId, durationMs: Date.now() - startTime }, "Agent loop failed, falling back to runtime")

      try {
        let enhancedInput = input
        try {
          const chunks = await getContextEngine().search({ text: input.content, userId: input.userId, topK: 3 })
          if (chunks.length > 0) {
            const contextStr = chunks.map((c: ContextChunk) => c.content).join("\n\n")
            enhancedInput = { ...input, content: `Context:\n${contextStr}\n\nUser: ${input.content}` }
          }
        } catch {}

        const result = await callAgentRuntimeWithRetry(enhancedInput)
        const reply = result.reply
        const isError = result.isFallback || !result.generated
        const assistantMessage = await saveMessage(MessageRole.ASSISTANT, reply, { error: isError })
        callbacks?.onDone({ reply, steps: [], iterations: 0, error: isError })
        return { message: assistantMessage, reply, steps: [], iterations: 0, error: isError }
      } catch (innerErr) {
        const reply = "I encountered an error processing your request. Please try again."
        const assistantMessage = await saveMessage(MessageRole.ASSISTANT, reply, { error: true })
        callbacks?.onError(innerErr instanceof Error ? innerErr : new Error(String(innerErr)))
        return { message: assistantMessage, reply, steps: [], iterations: 0, error: true }
      }
    }
  }
}

export const chatService = new ChatService()
