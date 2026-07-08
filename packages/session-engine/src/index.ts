interface SessionMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result?: string }>
  timestamp: number
  tokenCount?: number
}

interface SessionConfig {
  maxTokens: number
  preserveRecentTokens: number
}

const DEFAULT_CONFIG: SessionConfig = {
  maxTokens: 128000,
  preserveRecentTokens: 16000,
}

export class SessionEngine {
  private messages: SessionMessage[] = []
  private config: SessionConfig
  private summary: string | null = null

  constructor(config?: Partial<SessionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  addMessage(msg: Omit<SessionMessage, "id" | "timestamp">): SessionMessage {
    const full: SessionMessage = {
      ...msg,
      id: `msg_${Date.now()}_${this.messages.length}`,
      timestamp: Date.now(),
    }
    this.messages.push(full)
    return full
  }

  getMessages(): SessionMessage[] {
    return [...this.messages]
  }

  estimateTokens(): number {
    return this.messages.reduce((sum, m) => {
      const content = m.content ?? ""
      const toolContent = m.toolCalls?.map((t) => JSON.stringify(t)).join("") ?? ""
      return sum + Math.ceil((content.length + toolContent.length) / 4)
    }, 0)
  }

  async compact(): Promise<{ summary: string; pruned: number }> {
    const totalTokens = this.estimateTokens()
    if (totalTokens <= this.config.maxTokens) {
      return { summary: this.summary ?? "", pruned: 0 }
    }

    const recentTokens = this.config.preserveRecentTokens
    let recentCount = 0
    let accumulated = 0

    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msg = this.messages[i]
      if (!msg) continue
      const tokens = Math.ceil((msg.content?.length ?? 0) / 4)
      accumulated += tokens
      recentCount++
      if (accumulated >= recentTokens) break
    }

    const pruned = this.messages.length - recentCount
    if (pruned <= 0) return { summary: this.summary ?? "", pruned: 0 }

    const prunedMessages = this.messages.slice(0, pruned)
    const summaryText = this.summarizeMessages(prunedMessages)
    this.summary = summaryText

    const summaryMsg: SessionMessage = {
      id: `msg_summary_${Date.now()}`,
      role: "system",
      content: `[Previous conversation summary: ${summaryText}]`,
      timestamp: Date.now(),
    }

    this.messages = [summaryMsg, ...this.messages.slice(prunedCount(pruned))]

    return { summary: summaryText, pruned }
  }

  getSummary(): string | null {
    return this.summary
  }

  clear(): void {
    this.messages = []
    this.summary = null
  }

  private summarizeMessages(msgs: SessionMessage[]): string {
    const userMsgs = msgs.filter((m) => m.role === "user").length
    const assistantMsgs = msgs.filter((m) => m.role === "assistant").length
    const toolCalls = msgs.reduce((sum, m) => sum + (m.toolCalls?.length ?? 0), 0)
    const topics = this.extractTopics(msgs)

    return `Conversation with ${userMsgs} user messages, ${assistantMsgs} assistant responses, ${toolCalls} tool calls. Topics: ${topics.join(", ")}.`
  }

  private extractTopics(msgs: SessionMessage[]): string[] {
    const words = msgs
      .flatMap((m) => (m.content ?? "").split(/\s+/))
      .filter((w) => w.length > 4)
      .map((w) => w.toLowerCase())

    const freq = new Map<string, number>()
    for (const word of words) {
      freq.set(word, (freq.get(word) ?? 0) + 1)
    }

    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word)
  }
}

function prunedCount(pruned: number): number {
  return pruned
}

export interface SessionStore {
  createSession(userId: string, title?: string): Promise<string>
  getSession(sessionId: string): Promise<any>
  listSessions(userId: string): Promise<any[]>
  deleteSession(sessionId: string): Promise<void>
  addMessage(sessionId: string, message: SessionMessage): Promise<void>
  getMessages(sessionId: string): Promise<SessionMessage[]>
}
