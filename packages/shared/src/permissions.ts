export type PermissionAction = "allow" | "deny" | "ask"
export type Reply = "once" | "always" | "reject"

export interface PermissionRule {
  permission: string
  pattern: string
  action: PermissionAction
}

export interface PermissionRequest {
  id: string
  sessionId: string
  permission: string
  patterns: string[]
  metadata: Record<string, unknown>
  always: string[]
  tool?: { messageId: string; callId: string }
}

export interface PermissionReply {
  requestId: string
  reply: Reply
  message?: string
}

export interface PermissionState {
  rules: PermissionRule[]
  pending: PermissionRequest[]
  history: Array<{ request: PermissionRequest; reply: PermissionReply; timestamp: number }>
}

export interface AccessControlEntry {
  toolId: string
  action: PermissionAction
  reason?: string
}
