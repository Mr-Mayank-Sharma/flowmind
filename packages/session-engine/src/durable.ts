export type SessionEventType =
  | "message_added"
  | "tool_call_started"
  | "tool_call_completed"
  | "tool_call_failed"
  | "session_summarized"
  | "session_cleared"
  | "session_forked"

export interface SessionEvent {
  id: string
  sessionId: string
  type: SessionEventType
  timestamp: number
  data: Record<string, unknown>
  parentId?: string
}

export interface DurableSessionConfig {
  maxEvents: number
  drainTimeoutMs: number
  autoSummarize: boolean
}

const DEFAULT_DURABLE_CONFIG: DurableSessionConfig = {
  maxEvents: 10000,
  drainTimeoutMs: 30000,
  autoSummarize: true,
}

export class DurableSessionEngine {
  private events: SessionEvent[] = []
  private pendingToolCalls: Map<string, { toolId: string; name: string; args: Record<string, unknown>; startedAt: number }> = new Map()
  private config: DurableSessionConfig
  private summary: string | null = null
  private sessionId: string

  constructor(sessionId: string, config?: Partial<DurableSessionConfig>) {
    this.sessionId = sessionId
    this.config = { ...DEFAULT_DURABLE_CONFIG, ...config }
  }

  getEvents(): SessionEvent[] {
    return [...this.events]
  }

  getSessionId(): string {
    return this.sessionId
  }

  getSummary(): string | null {
    return this.summary
  }

  // --- Event Recording ---

  recordEvent(type: SessionEventType, data: Record<string, unknown>): SessionEvent {
    const event: SessionEvent = {
      id: `evt_${Date.now()}_${this.events.length}`,
      sessionId: this.sessionId,
      type,
      timestamp: Date.now(),
      data,
      parentId: this.events[this.events.length - 1]?.id,
    }
    this.events.push(event)

    if (this.events.length > this.config.maxEvents) {
      this.compact()
    }

    return event
  }

  addMessage(role: string, content: string, metadata?: Record<string, unknown>): SessionEvent {
    return this.recordEvent("message_added", { role, content, ...metadata })
  }

  startToolCall(toolName: string, args: Record<string, unknown>, toolId?: string): SessionEvent {
    const id = toolId ?? `tc_${Date.now()}`
    const event = this.recordEvent("tool_call_started", { toolId: id, name: toolName, args })
    this.pendingToolCalls.set(id, { toolId: id, name: toolName, args, startedAt: Date.now() })
    return event
  }

  completeToolCall(toolId: string, result: unknown): SessionEvent {
    this.pendingToolCalls.delete(toolId)
    return this.recordEvent("tool_call_completed", { toolId, result })
  }

  failToolCall(toolId: string, error: string): SessionEvent {
    this.pendingToolCalls.delete(toolId)
    return this.recordEvent("tool_call_failed", { toolId, error })
  }

  // --- Drain Model ---

  getPendingToolCalls(): Array<{ toolId: string; name: string; args: Record<string, unknown>; startedAt: number }> {
    return Array.from(this.pendingToolCalls.values())
  }

  hasPendingToolCalls(): boolean {
    return this.pendingToolCalls.size > 0
  }

  async drain(timeoutMs?: number): Promise<{ drained: number; failed: number; timedOut: boolean }> {
    const timeout = timeoutMs ?? this.config.drainTimeoutMs
    const startTime = Date.now()
    let drained = 0
    let failed = 0
    let timedOut = false

    while (this.pendingToolCalls.size > 0) {
      if (Date.now() - startTime > timeout) {
        timedOut = true
        for (const [id, call] of this.pendingToolCalls) {
          this.failToolCall(id, "Drain timeout")
          failed++
        }
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    drained = this.pendingToolCalls.size

    return { drained, failed, timedOut }
  }

  // --- Event Replay ---

  replay(events: SessionEvent[]): DurableSessionEngine {
    const replayed = new DurableSessionEngine(this.sessionId, this.config)
    for (const event of events) {
      replayed.events.push(event)
      if (event.type === "tool_call_started") {
        const data = event.data as { toolId: string; name: string; args: Record<string, unknown> }
        replayed.pendingToolCalls.set(event.data.toolId as string, {
          toolId: data.toolId,
          name: data.name,
          args: data.args,
          startedAt: event.timestamp,
        })
      }
      if (event.type === "tool_call_completed" || event.type === "tool_call_failed") {
        replayed.pendingToolCalls.delete(event.data.toolId as string)
      }
    }
    return replayed
  }

  // --- Forking ---

  fork(newSessionId: string): DurableSessionEngine {
    const fork = this.replay(this.events)
    fork.sessionId = newSessionId
    fork.recordEvent("session_forked", { parentSessionId: this.sessionId, parentEventCount: this.events.length })
    return fork
  }

  // --- Compaction ---

  private compact(): void {
    const oldest = Math.floor(this.events.length * 0.3)
    const removed = this.events.splice(0, oldest)

    const textEvents = removed
      .filter((e) => e.type === "message_added")
      .map((e) => (e.data as { role?: string; content?: string }).content ?? "")
      .join("\n")

    const topicSummary = textEvents.length > 0 ? textEvents.slice(0, 500) + "..." : ""
    this.recordEvent("session_summarized", { summary: topicSummary, eventsCompacted: oldest })
  }

  clear(): void {
    this.events = []
    this.pendingToolCalls.clear()
    this.summary = null
  }

  toJSON(): { sessionId: string; events: SessionEvent[]; summary: string | null } {
    return {
      sessionId: this.sessionId,
      events: this.events,
      summary: this.summary,
    }
  }

  static fromJSON(json: { sessionId: string; events: SessionEvent[]; summary?: string | null }): DurableSessionEngine {
    const engine = new DurableSessionEngine(json.sessionId)
    for (const event of json.events) {
      engine.events.push(event)
      if (event.type === "tool_call_started") {
        const data = event.data as { toolId: string; name: string; args: Record<string, unknown> }
        engine.pendingToolCalls.set(event.data.toolId as string, {
          toolId: data.toolId,
          name: data.name,
          args: data.args,
          startedAt: event.timestamp,
        })
      }
      if (event.type === "tool_call_completed" || event.type === "tool_call_failed") {
        engine.pendingToolCalls.delete(event.data.toolId as string)
      }
    }
    if (json.summary) engine.summary = json.summary
    return engine
  }
}
