import type { Permission } from "@flowmind/permission"

export interface ToolContext {
  sessionId: string
  messageId: string
  agent: string
  callId?: string
  extra?: Record<string, unknown>
  ask(input: Omit<Permission.Request, "id" | "sessionId" | "tool">): Promise<void>
  metadata(input: { title?: string; metadata?: Record<string, unknown> }): void
}

export interface ExecuteResult {
  title: string
  output: string
  metadata: Record<string, unknown>
  attachments?: Array<{ type: string; mime: string; data: string; filename: string }>
}

export interface ToolDef {
  id: string
  description: string
  parameters: Record<string, unknown>
  jsonSchema?: Record<string, unknown>
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ExecuteResult>
}

export interface ToolInfo {
  id: string
  init: () => ToolDef
}
