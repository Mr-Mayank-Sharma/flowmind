export type McpTransportType = "stdio" | "streamable-http" | "sse"

export interface McpServerConfig {
  id: string
  name: string
  transport: McpTransportType
  command?: string
  args?: string[]
  baseUrl?: string
  headers?: Record<string, string>
  enabled: boolean
  lastError?: string
}

/** Legacy alias kept for callers of the in-memory registry. */
export type McpServer = McpServerConfig

export interface McpToolInfo {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
}

export interface McpCallResult {
  success: boolean
  content: string
  structuredContent?: unknown
  isError: boolean
}

export interface McpConnectionState {
  connected: boolean
  checkedAt: number
  error?: string
  serverInfo?: { name?: string; version?: string }
  toolCount?: number
}