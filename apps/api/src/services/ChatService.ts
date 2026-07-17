import { CircuitBreaker, withRetry, logger } from "../infrastructure"
import { MessageRole } from "@flowmind/shared"
import { ContextEngine, type ContextChunk } from "@flowmind/context-engine"

const contextEngine = new ContextEngine()

const AGENT_RUNTIME_URL = process.env.AGENT_RUNTIME_URL || "http://localhost:8001"
const AGENT_API_KEY = process.env.AGENT_API_KEY || ""

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
}

async function callAgentRuntime(input: SendMessageInput): Promise<string> {
  const res = await fetch(`${AGENT_RUNTIME_URL}/chat/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(AGENT_API_KEY ? { Authorization: `Bearer ${AGENT_API_KEY}` } : {}),
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
        const chunks = await contextEngine.search({ text: input.content, userId: input.userId, topK: 3 })
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
}

export const chatService = new ChatService()
