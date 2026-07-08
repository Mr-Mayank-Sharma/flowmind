export type AuthMethod = "api_key" | "oauth2" | "basic" | "env" | "none"

export interface ConnectionConfig {
  type: string
  auth: AuthMethod
  baseUrl?: string
  scopes?: string[]
  envVars?: string[]
}

export interface Connection {
  id: string
  name: string
  provider: string
  config: ConnectionConfig
  status: "active" | "expired" | "error"
  lastUsedAt?: string
  createdAt: string
}

export interface Credential {
  id: string
  connectionId: string
  type: AuthMethod
  label: string
  expiresAt?: string
  isExpired: boolean
}

export interface Integration {
  id: string
  name: string
  description: string
  category: "llm" | "storage" | "communication" | "version_control" | "monitoring" | "custom"
  connectionConfigs: ConnectionConfig[]
  prompts?: Array<{ id: string; template: string }>
}
