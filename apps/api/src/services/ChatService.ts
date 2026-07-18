import { CircuitBreaker, withRetry, logger } from "../infrastructure"
import { MessageRole } from "@flowmind/shared"
import { ContextEngine, type ContextChunk } from "@flowmind/context-engine"
import { LLMEngine, runAgentLoop, type AgentTool, type AgentLoopStep } from "@flowmind/llm-router"
import { toolRegistry } from "@flowmind/tool-system"

let _contextEngine: ContextEngine | null = null
function getContextEngine(): ContextEngine {
  if (!_contextEngine) _contextEngine = new ContextEngine()
  return _contextEngine
}

const AGENT_RUNTIME_URL = process.env.AGENT_RUNTIME_URL || "http://localhost:8001"

function buildLLMEngine(): LLMEngine {
  return new LLMEngine({
    openaiKey: process.env.OPENAI_API_KEY,
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    googleKey: process.env.GOOGLE_API_KEY,
    groqKey: process.env.GROQ_API_KEY,
    deepseekKey: process.env.DEEPSEEK_API_KEY,
    openrouterKey: process.env.OPENROUTER_API_KEY,
    togetherKey: process.env.TOGETHER_API_KEY,
    mistralKey: process.env.MISTRAL_API_KEY,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
  })
}

function buildChatTools(sessionId: string, userId: string): AgentTool[] {
  const defs = toolRegistry.all()
  const noopCtx = {
    sessionId,
    messageId: `chat_${Date.now()}`,
    agent: "chat",
    async ask() {},
    metadata() {},
  }

  return defs.map((def) => ({
    name: def.id,
    description: def.description,
    parameters: def.parameters,
    async execute(args: Record<string, unknown>): Promise<string> {
      const result = await def.execute(args, noopCtx)
      return result.output
    },
  }))
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
}

export interface StreamingCallbacks {
  onStep: (step: AgentLoopStep) => void
  onDone: (result: SendMessageResult) => void
  onError: (error: Error) => void
}

async function callAgentRuntime(input: SendMessageInput): Promise<string> {
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
  return data.reply || "I processed your request."
}

async function callAgentRuntimeWithRetry(input: SendMessageInput): Promise<string> {
  return agentRuntimeCircuitBreaker.call(
    () => withRetry(() => callAgentRuntime(input), {
      maxRetries: 2,
      baseDelayMs: 500,
      retryOn: (err) => {
        const status = (err as any)?.status
        return !status || status >= 500 || status === 429
      },
    }),
    async () => {
      logger.warn("Circuit breaker open for agent runtime, using fallback")
      return "The agent runtime is temporarily unavailable. Your message has been saved."
    },
  )
}

export class ChatService {
  async sendMessage(input: SendMessageInput, saveMessage: (role: MessageRole, content: string) => Promise<any>): Promise<{ message: any; reply: string }> {
    const startTime = Date.now()

    await saveMessage(MessageRole.USER, input.content)

    let reply: string
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
      reply = await callAgentRuntimeWithRetry(enhancedInput)
    } catch (err) {
      logger.error({ err, sessionId: input.sessionId, durationMs: Date.now() - startTime }, "Agent runtime call failed after all retries")
      reply = "I encountered an error processing your request. Please try again."
    }

    const assistantMessage = await saveMessage(MessageRole.ASSISTANT, reply)

    logger.info({ sessionId: input.sessionId, durationMs: Date.now() - startTime, userId: input.userId }, "Message processed")

    return { message: assistantMessage, reply }
  }

  async sendMessageWithAgentLoop(
    input: SendMessageInput,
    saveMessage: (role: MessageRole, content: string) => Promise<any>,
    callbacks?: StreamingCallbacks,
  ): Promise<{ message: any; reply: string; steps: AgentLoopStep[]; iterations: number }> {
    const startTime = Date.now()
    const model = input.model || "tinyllama"

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
      const assistantMessage = await saveMessage(MessageRole.ASSISTANT, reply)
      return { message: assistantMessage, reply, steps: [], iterations: 0 }
    }

    const tools = buildChatTools(input.sessionId, input.userId)

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

      const reply = result.response || "I processed your request."
      const assistantMessage = await saveMessage(MessageRole.ASSISTANT, reply)

      logger.info({
        sessionId: input.sessionId,
        durationMs: Date.now() - startTime,
        userId: input.userId,
        iterations: result.iterations,
        toolCalls: result.steps.filter((s) => s.type === "tool_call").length,
      }, "Agent loop completed")

      callbacks?.onDone({ reply, steps: result.steps, iterations: result.iterations })

      return { message: assistantMessage, reply, steps: result.steps, iterations: result.iterations }
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

        const reply = await callAgentRuntimeWithRetry(enhancedInput)
        const assistantMessage = await saveMessage(MessageRole.ASSISTANT, reply)
        callbacks?.onDone({ reply, steps: [], iterations: 0 })
        return { message: assistantMessage, reply, steps: [], iterations: 0 }
      } catch {
        const reply = "I encountered an error processing your request. Please try again."
        const assistantMessage = await saveMessage(MessageRole.ASSISTANT, reply)
        callbacks?.onError(err instanceof Error ? err : new Error(String(err)))
        return { message: assistantMessage, reply, steps: [], iterations: 0 }
      }
    }
  }
}

export const chatService = new ChatService()
