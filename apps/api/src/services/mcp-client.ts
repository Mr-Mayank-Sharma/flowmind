import type { AgentTool } from "@flowmind/llm-router";
import { McpConnectionPool, McpServerRegistry, McpToolRouter } from "@flowmind/mcp-executor";
import type { McpServerConfig } from "@flowmind/mcp-executor";
import { prisma, type McpServer, type McpServerTransport } from "@flowmind/db";

export const mcpRegistry = new McpServerRegistry();
export const mcpConnectionPool = new McpConnectionPool();
export const mcpToolRouter = new McpToolRouter();

const TRANSPORT_MAP: Record<McpServerTransport, McpServerConfig["transport"]> = {
  STDIO: "stdio",
  STREAMABLE_HTTP: "streamable-http",
  SSE: "sse",
};

export function rowToMcpServerConfig(row: McpServer): McpServerConfig {
  return {
    id: row.id,
    name: row.name,
    transport: TRANSPORT_MAP[row.transport],
    command: row.command ?? undefined,
    args: Array.isArray(row.args) ? (row.args as string[]) : undefined,
    baseUrl: row.baseUrl ?? undefined,
    headers: row.headers && typeof row.headers === "object" ? (row.headers as Record<string, string>) : undefined,
    enabled: row.enabled,
    lastError: row.lastError ?? undefined,
  };
}

export async function listUserMcpServers(userId: string): Promise<McpServer[]> {
  return prisma.mcpServer.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getUserMcpServer(userId: string, id: string): Promise<McpServer | null> {
  return prisma.mcpServer.findFirst({ where: { id, userId } });
}

function serializeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function mcpServerConfigOf(row: McpServer): McpServerConfig {
  const config = rowToMcpServerConfig(row);
  mcpRegistry.register(config);
  return config;
}

async function recordServerOutcome(
  row: McpServer,
  outcome: { ok: true; toolCount?: number } | { ok: false; error: string },
): Promise<void> {
  await prisma.mcpServer.update({
    where: { id: row.id },
    data:
      outcome.ok
        ? { lastError: null, lastConnectedAt: new Date(), lastToolCount: outcome.toolCount ?? null }
        : { lastError: outcome.error },
  });
}

async function syncServerTools(row: McpServer): Promise<{ tools: string[]; error?: string }> {
  const config = mcpServerConfigOf(row);
  if (!config.enabled) {
    mcpToolRouter.unregisterServer(config.id);
    return { tools: [], error: "server is disabled" };
  }

  try {
    const tools = await mcpConnectionPool.listTools(config);
    mcpToolRouter.unregisterServer(config.id);
    for (const tool of tools) {
      mcpToolRouter.register(tool.name, config.id);
    }
    await recordServerOutcome(row, { ok: true, toolCount: tools.length });
    return { tools: tools.map((t) => t.name) };
  } catch (err) {
    const error = serializeError(err);
    await recordServerOutcome(row, { ok: false, error });
    return { tools: [], error };
  }
}

/**
 * Discover the MCP tools a user can invoke from the agent loop: every enabled,
 * reachable MCP server contributes one AgentTool. A failing server is skipped
 * (never faked) and its lastError is persisted; built-in local tools are
 * unaffected in the caller.
 */
export async function listMcpAgentToolsForUser(userId: string): Promise<AgentTool[]> {
  const rows = await listUserMcpServers(userId);
  const agentTools: AgentTool[] = [];

  for (const row of rows) {
    const config = mcpServerConfigOf(row);
    if (!config.enabled) {
      mcpToolRouter.unregisterServer(config.id);
      continue;
    }

    let tools;
    try {
      tools = await mcpConnectionPool.listTools(config);
    } catch (err) {
      const error = serializeError(err);
      await recordServerOutcome(row, { ok: false, error });
      continue;
    }

    mcpToolRouter.unregisterServer(config.id);
    for (const tool of tools) {
      mcpToolRouter.register(tool.name, config.id);
      agentTools.push({
        name: tool.name,
        description: tool.description ?? `MCP tool from ${row.name}`,
        parameters: tool.inputSchema,
        async execute(args: Record<string, unknown>): Promise<string> {
          const result = await mcpConnectionPool.callTool(config, tool.name, args);
          if (!result.success) {
            throw new Error(result.content || `MCP tool '${tool.name}' reported an error`);
          }
          return result.content;
        },
      });
    }
    await recordServerOutcome(row, { ok: true, toolCount: tools.length });
  }

  return agentTools;
}