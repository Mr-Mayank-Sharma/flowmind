export interface Event<T extends string = string, D extends Record<string, unknown> = Record<string, unknown>> {
  id: string
  type: T
  data: D
  timestamp: number
  parentId?: string
}

export function define<T extends string, D extends Record<string, unknown>>(type: T, data: D): Event<T, D> {
  return { id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, type, data, timestamp: Date.now() }
}

export function inventory<E extends Event>(events: E[]): { [T in E["type"]]: Extract<E, { type: T }>[] } {
  const inv: Record<string, Event[]> = {}
  for (const event of events) {
    if (!inv[event.type]) inv[event.type] = []
    inv[event.type]!.push(event)
  }
  return inv as any
}

export class DurableEventLog {
  private events: Event[] = []

  append<T extends string, D extends Record<string, unknown>>(type: T, data: D): Event<T, D> {
    const event: Event<T, D> = { id: `evt_${Date.now()}_${this.events.length}`, type, data, timestamp: Date.now(), parentId: this.events[this.events.length - 1]?.id }
    this.events.push(event as Event)
    if (this.events.length > 10_000) this.compact()
    return event
  }

  replay(events: Event[]): void {
    this.events = [...events]
  }

  getAll(): Event[] {
    return [...this.events]
  }

  getByType<T extends string>(type: T): Event<T, Record<string, unknown>>[] {
    return this.events.filter((e): e is Event<T, Record<string, unknown>> => e.type === type)
  }

  fork(): DurableEventLog {
    const fork = new DurableEventLog()
    fork.replay(this.events)
    return fork
  }

  private compact(): void {
    this.events.splice(0, Math.floor(this.events.length * 0.3))
  }
}

export type SessionEventType = "message_added" | "tool_call_started" | "tool_call_completed" | "tool_call_failed" | "session_summarized" | "session_cleared" | "session_forked"
export type LSPEventType = "lsp.definition" | "lsp.references" | "lsp.hover" | "lsp.completion" | "lsp.diagnostic"
export type MCPEventType = "mcp.resource.list" | "mcp.resource.read" | "mcp.tool.call" | "mcp.tool.result"
export type VCEventType = "vcs.commit" | "vcs.diff" | "vcs.status" | "vcs.branch.change"
export type WorktreeEventType = "worktree.create" | "worktree.remove" | "worktree.switch"

export type TypedEvent =
  | Event<SessionEventType, { role?: string; content?: string; toolId?: string; name?: string; args?: Record<string, unknown>; result?: unknown; error?: string; summary?: string }>
  | Event<LSPEventType, { filePath: string; line?: number; column?: number; result?: unknown }>
  | Event<MCPEventType, { serverId?: string; resource?: string; tool?: string; args?: Record<string, unknown> }>
  | Event<VCEventType, { path?: string; message?: string; branch?: string; status?: unknown }>
  | Event<WorktreeEventType, { path?: string; branch?: string }>
