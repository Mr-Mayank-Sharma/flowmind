import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { McpError } from "@modelcontextprotocol/sdk/types.js"
import { assertCommandAllowed, assertMcpRemoteUrl } from "./security"
import type { McpCallResult, McpConnectionState, McpServerConfig, McpToolInfo } from "./types"

const CONNECT_TIMEOUT_MS = 10_000
const LIST_TOOLS_TIMEOUT_MS = 10_000
const CALL_TOOL_TIMEOUT_MS = 30_000

export function mcpErrorMessage(err: unknown): string {
  if (err instanceof McpError) {
    return `MCP JSON-RPC error (code ${err.code}): ${err.message}`
  }
  if (err instanceof Error) {
    if (err.name === "AbortError" || err.name === "TimeoutError") return `timed out: ${err.message}`
    return err.message
  }
  return String(err)
}

function extractContentText(content: Array<{ type: string; text?: string }> | undefined): string {
  if (!Array.isArray(content)) return ""
  const parts = content.map((block) => {
    if (block.type === "text") return typeof block.text === "string" ? block.text : ""
    return JSON.stringify(block)
  })
  return parts.filter((part) => part.length > 0).join("\n")
}

interface McpLiveConnection {
  client: Client
  transport: Transport
  connectedAt: number
}

function toRequestInit(headers?: Record<string, string>): RequestInit | undefined {
  if (!headers || Object.keys(headers).length === 0) return undefined
  return { headers: { ...headers } }
}

/**
 * A real MCP client pool. Each server config maps to a client + transport; tools are
 * discovered over tools/list and invoked over tools/call. Failures are surfaced as
 * errors — a dropped server, JSON-RPC error, or isError tool result never becomes
 * a fake success.
 */
export class McpConnectionPool {
  private clients = new Map<string, McpLiveConnection>()
  private states = new Map<string, McpConnectionState>()

  async connect(config: McpServerConfig): Promise<McpConnectionState> {
    const now = Date.now()
    if (!config.enabled) {
      const state: McpConnectionState = { connected: false, checkedAt: now, error: "server is disabled" }
      this.states.set(config.id, state)
      throw new Error(mcpErrorMessage(new Error(`MCP server '${config.name}' is disabled`)))
    }

    const existing = this.clients.get(config.id)
    if (existing) {
      return this.states.get(config.id) ?? { connected: true, checkedAt: now }
    }

    let transport: Transport
    try {
      transport = await this.buildTransport(config)
    } catch (err) {
      this.recordFailure(config, err)
      throw new Error(mcpErrorMessage(err))
    }

    const client = new Client({ name: "flowmind", version: "0.1.0" }, { capabilities: {} })
    try {
      await client.connect(transport, { signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS) })
      const serverInfo = client.getServerVersion()
      const state: McpConnectionState = {
        connected: true,
        checkedAt: now,
        serverInfo: serverInfo ? { name: serverInfo.name, version: serverInfo.version } : undefined,
      }
      this.clients.set(config.id, { client, transport, connectedAt: now })
      this.states.set(config.id, state)
      return state
    } catch (err) {
      await this.safeCloseTransport(transport)
      this.recordFailure(config, err)
      throw new Error(`MCP server '${config.name}' failed to initialize: ${mcpErrorMessage(err)}`)
    }
  }

  async listTools(config: McpServerConfig): Promise<McpToolInfo[]> {
    const live = await this.getOrConnect(config)
    try {
      const result = await live.client.listTools(undefined, {
        signal: AbortSignal.timeout(LIST_TOOLS_TIMEOUT_MS),
      })
      const tools: McpToolInfo[] = (result.tools ?? []).map((tool) => ({
        name: tool.name,
        description: tool.description ?? undefined,
        inputSchema: (tool.inputSchema ?? {}) as Record<string, unknown>,
      }))
      this.states.set(config.id, {
        connected: true,
        checkedAt: Date.now(),
        serverInfo: this.states.get(config.id)?.serverInfo,
        toolCount: tools.length,
      })
      return tools
    } catch (err) {
      this.recordFailure(config, err)
      throw new Error(`MCP server '${config.name}' failed to list tools: ${mcpErrorMessage(err)}`)
    }
  }

  async callTool(
    config: McpServerConfig,
    name: string,
    args: Record<string, unknown> | undefined,
  ): Promise<McpCallResult> {
    const live = await this.getOrConnect(config)
    let result
    try {
      result = await live.client.callTool(
        { name, arguments: args ?? {} },
        undefined,
        { signal: AbortSignal.timeout(CALL_TOOL_TIMEOUT_MS) },
      )
    } catch (err) {
      this.recordFailure(config, err)
      throw new Error(`MCP tool '${name}' on server '${config.name}' failed: ${mcpErrorMessage(err)}`)
    }

    const content = extractContentText(result.content as Array<{ type: string; text?: string }> | undefined)
    if (result.isError === true) {
      return {
        success: false,
        content: content || `MCP tool '${name}' reported an error without a message`,
        structuredContent: result.structuredContent,
        isError: true,
      }
    }
    return { success: true, content, structuredContent: result.structuredContent, isError: false }
  }

  async disconnect(serverId: string): Promise<void> {
    const live = this.clients.get(serverId)
    if (!live) {
      this.states.set(serverId, { connected: false, checkedAt: Date.now() })
      return
    }
    try {
      await live.client.close()
    } catch {
      // closing an already-broken transport must not mask the requested teardown
    }
    await this.safeCloseTransport(live.transport)
    this.clients.delete(serverId)
    this.states.set(serverId, { connected: false, checkedAt: Date.now() })
  }

  isConnected(serverId: string): boolean {
    return this.clients.has(serverId) && this.states.get(serverId)?.connected === true
  }

  getConnectionState(serverId: string): McpConnectionState | undefined {
    return this.states.get(serverId)
  }

  listConnections(): string[] {
    return Array.from(this.clients.keys())
  }

  private async getOrConnect(config: McpServerConfig): Promise<McpLiveConnection> {
    const existing = this.clients.get(config.id)
    if (existing) return existing
    await this.connect(config)
    const live = this.clients.get(config.id)
    if (!live) {
      throw new Error(`MCP server '${config.name}' is not connected`)
    }
    return live
  }

  private recordFailure(config: McpServerConfig, err: unknown): void {
    this.states.set(config.id, {
      connected: false,
      checkedAt: Date.now(),
      error: mcpErrorMessage(err),
    })
  }

  private async safeCloseTransport(transport: Transport): Promise<void> {
    try {
      await transport.close()
    } catch {
      // teardown best-effort; the process may already have exited
    }
  }

  private async buildTransport(config: McpServerConfig): Promise<Transport> {
    switch (config.transport) {
      case "stdio": {
        assertCommandAllowed(config.command ?? "")
        return new StdioClientTransport({
          command: config.command!,
          args: config.args ?? [],
          stderr: "inherit",
        })
      }
      case "streamable-http": {
        const url = await assertMcpRemoteUrl(config.baseUrl ?? "")
        const requestInit = toRequestInit(config.headers)
        return new StreamableHTTPClientTransport(url, requestInit ? { requestInit } : {})
      }
      case "sse": {
        const url = await assertMcpRemoteUrl(config.baseUrl ?? "")
        const requestInit = toRequestInit(config.headers)
        if (requestInit) {
          const headers = { ...config.headers! }
          return new SSEClientTransport(url, {
            requestInit,
            eventSourceInit: {
              fetch: (input, init) =>
                fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string> | undefined), ...headers } }),
            },
          })
        }
        return new SSEClientTransport(url, {})
      }
    }
  }
}