export interface CommandTemplate {
  id: string
  name: string
  description?: string
  prompt: string
  modelRef?: string
  agentRef?: string
  parameters?: Record<string, { type: string; description: string; required?: boolean }>
}

export interface CommandInvocation {
  templateId: string
  args: Record<string, string>
  sessionId?: string
  model?: string
}
