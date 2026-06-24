export interface Agent {
  id: string
  name: string
  role: "Researcher" | "Developer" | "Analyst" | "Operator" | "Creator" | "Support"
  model: string
  provider: string
  status: "active" | "idle" | "error" | "paused"
  memoryEnabled: boolean
  costCap: number
  costSpent: number
  tools: number
  createdAt: string
}

export interface ModelProvider {
  id: string
  name: string
  icon: string
  models: ModelSpec[]
  apiKeyConfigured: boolean
  baseUrl?: string
}

export interface ModelSpec {
  name: string
  contextWindow: number
  inputPrice: number
  outputPrice: number
  capabilities: string[]
  isLocal: boolean
}

export interface MCPServer {
  id: string
  name: string
  description: string
  type: "stdio" | "sse" | "built-in"
  status: "connected" | "disconnected" | "error"
  tools: string[]
  lastActive: string
  command?: string
  url?: string
}

export interface Session {
  id: string
  name: string
  agentName: string
  tokens: number
  memoryCount: number
  lastActive: string
  status: "active" | "idle" | "archived"
}

export interface Pipeline {
  id: string
  name: string
  description: string
  status: "DRAFT" | "ACTIVE" | "ARCHIVED"
  lastRunAt: string | null
  nodeCount: number
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: string
}

export interface ChatSession {
  id: string
  name: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}
