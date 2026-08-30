import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../middleware/trpc";
import { McpExecutor, OAUTH_PROVIDERS, getClientId, getClientSecret, assertCommandAllowed, assertMcpRemoteUrl, McpSecurityError } from "@flowmind/mcp-executor";
import { mcpRegistry, mcpConnectionPool, mcpToolRouter, rowToMcpServerConfig, getUserMcpServer } from "../services/mcp-client";

const tokenStore = {
  getToken: async (userId: string, provider: string) => {
    const { prisma } = await import("@flowmind/db");
    const rec = await prisma.mcpToken.findFirst({ where: { userId, provider, isActive: true } });
    if (!rec) return null;
    return {
      accessToken: rec.accessToken,
      refreshToken: rec.refreshToken ?? undefined,
      expiresAt: rec.expiresAt ?? new Date(0),
      scopes: rec.scope.split(" ").filter(Boolean),
    };
  },
  setToken: async (userId: string, provider: string, token: { accessToken: string; refreshToken?: string; expiresAt: Date; scopes: string[] }) => {
    const { prisma } = await import("@flowmind/db");
    await prisma.mcpToken.upsert({
      where: { id: `${userId}_${provider}` },
      update: { accessToken: token.accessToken, refreshToken: token.refreshToken ?? null, scope: token.scopes.join(" "), expiresAt: token.expiresAt },
      create: { id: `${userId}_${provider}`, userId, provider, accessToken: token.accessToken, refreshToken: token.refreshToken ?? null, scope: token.scopes.join(" "), expiresAt: token.expiresAt },
    });
  },
  refreshToken: async (userId: string, provider: string) => {
    const token = await tokenStore.getToken(userId, provider);
    if (!token) throw new TRPCError({ code: "NOT_FOUND", message: `No stored token for ${provider}` });
    if (!token.refreshToken) throw new TRPCError({ code: "BAD_REQUEST", message: `No refresh token available for ${provider}` });

    const config = OAUTH_PROVIDERS[provider];
    if (!config) throw new Error(`Unknown OAuth provider: ${provider}`);

    const clientId = getClientId(provider);
    const clientSecret = getClientSecret(provider);
    if (!clientId || !clientSecret) throw new Error(`OAuth credentials not configured for ${provider}`);

    const body: Record<string, string> = {
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    };

    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Token refresh failed: ${res.status} ${errBody}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const accessToken = (data.access_token ?? data.accessToken) as string;
    const refreshToken = (data.refresh_token ?? data.refreshToken) as string | undefined;
    const expiresIn = (data.expires_in ?? data.expiresIn ?? 3600) as number;
    const scopes = ((data.scope ?? data.scopes) as string ?? "").split(" ").filter(Boolean);

    if (!accessToken) throw new Error("No access token in refresh response");

    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const newToken = { accessToken, refreshToken, expiresAt, scopes };
    await tokenStore.setToken(userId, provider, newToken);
    return newToken;
  },
};

const executor = new McpExecutor(mcpRegistry, mcpConnectionPool, mcpToolRouter, tokenStore);

const transportEnum = z.enum(["stdio", "streamable-http", "sse"]);

const serverInputBase = z.object({
  name: z.string().min(1).max(120),
  transport: transportEnum,
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  baseUrl: z.string().url().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().optional(),
});

const serverInputSchema = serverInputBase.superRefine((val, ctx) => {
  if (val.transport === "stdio") {
    if (!val.command) ctx.addIssue({ code: "custom", path: ["command"], message: "command is required for stdio servers" });
  } else if (!val.baseUrl) {
    ctx.addIssue({ code: "custom", path: ["baseUrl"], message: "baseUrl is required for remote servers" });
  }
});

async function validateServerInput(input: {
  transport: "stdio" | "streamable-http" | "sse";
  command?: string;
  baseUrl?: string;
}): Promise<void> {
  if (input.transport === "stdio") {
    if (!input.command) throw new McpSecurityError("command is required for stdio servers");
    assertCommandAllowed(input.command);
  } else {
    if (!input.baseUrl) throw new McpSecurityError("baseUrl is required for remote servers");
    await assertMcpRemoteUrl(input.baseUrl);
  }
}

function serverTransportToEnum(transport: "stdio" | "streamable-http" | "sse") {
  if (transport === "stdio") return "STDIO" as const;
  if (transport === "streamable-http") return "STREAMABLE_HTTP" as const;
  return "SSE" as const;
}

export const mcpRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const tokens = await ctx.prisma.mcpToken.findMany({
        where: { userId: ctx.userId },
        orderBy: { createdAt: "desc" },
      });
      return tokens.map((t) => ({
        id: t.id,
        orgId: t.orgId,
        provider: t.provider,
        scope: t.scope,
        expiresAt: t.expiresAt,
        isActive: t.isActive,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }));
    }),

  create: protectedProcedure
    .input(z.object({
      provider: z.string(),
      accessToken: z.string(),
      refreshToken: z.string().optional(),
      scope: z.string().default("read"),
      expiresAt: z.string().datetime().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.prisma.mcpToken.create({
        data: {
          userId: ctx.userId!,
          provider: input.provider,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken ?? null,
          scope: input.scope,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.mcpToken.deleteMany({
        where: { id: input.id, userId: ctx.userId },
      });
      return { success: true };
    }),

  toggle: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const token = await ctx.prisma.mcpToken.findUnique({ where: { id: input.id } });
      if (!token || token.userId !== ctx.userId) throw new TRPCError({ code: "NOT_FOUND" });
      const updated = await ctx.prisma.mcpToken.update({
        where: { id: input.id },
        data: { isActive: !token.isActive },
      });
      return { success: true, isActive: updated.isActive };
    }),

  providers: publicProcedure
    .query(async () => {
      const providers: Array<{ id: string; name: string; authUrl: string; scopes: string[]; supportsPkce: boolean }> = [];
      for (const id of Object.keys(OAUTH_PROVIDERS)) {
        const cfg = OAUTH_PROVIDERS[id]!;
        providers.push({ id, name: id.charAt(0).toUpperCase() + id.slice(1), authUrl: cfg.authUrl, scopes: cfg.scopes, supportsPkce: cfg.pkce });
      }
      return providers;
    }),

  tools: protectedProcedure
    .query(async () => {
      return mcpRegistry.listBuiltInTools().map((t) => ({
        name: t.name,
        category: t.category,
        description: t.description,
        status: t.implemented ? "available" : "unavailable",
      }));
    }),

  oauthInitiate: protectedProcedure
    .input(z.object({ provider: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const redirectUri = `${process.env.APP_URL ?? "http://localhost:3000"}/mcp/oauth/callback`;
      return executor.initiateOAuthFlow(input.provider, redirectUri, ctx.userId!);
    }),

  oauthCallback: publicProcedure
    .input(z.object({ code: z.string(), state: z.string() }))
    .mutation(async ({ input }) => {
      const token = await executor.handleOAuthCallback(input.code, input.state);
      return { success: true, provider: token.scopes.join(",") };
    }),

  execute: protectedProcedure
    .input(z.object({ toolName: z.string(), args: z.any() }))
    .mutation(async ({ input, ctx }) => {
      return executor.execute(input.toolName, input.args, ctx.userId!);
    }),

  servers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const rows = await ctx.prisma.mcpServer.findMany({
        where: { userId: ctx.userId! },
        orderBy: { createdAt: "asc" },
      });
      return rows.map((row) => ({
        ...row,
        connectionState: mcpConnectionPool.getConnectionState(row.id) ?? null,
      }));
    }),

    create: protectedProcedure
      .input(serverInputSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          await validateServerInput(input);
        } catch (err) {
          if (err instanceof McpSecurityError) throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
          throw err;
        }
        const row = await ctx.prisma.mcpServer.create({
          data: {
            userId: ctx.userId!,
            name: input.name,
            transport: serverTransportToEnum(input.transport),
            command: input.command ?? null,
            args: input.args ?? undefined,
            baseUrl: input.baseUrl ?? null,
            headers: input.headers ?? undefined,
            enabled: input.enabled ?? true,
          },
        });
        mcpRegistry.register(rowToMcpServerConfig(row));
        return row;
      }),

    update: protectedProcedure
      .input(z.object({ id: z.string(), patch: serverInputBase.partial() }))
      .mutation(async ({ input, ctx }) => {
        const owned = await getUserMcpServer(ctx.userId!, input.id);
        if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "MCP server not found" });

        const merged = { ...owned, ...input.patch } as Parameters<typeof validateServerInput>[0];
        try {
          if (input.patch.command || input.patch.transport || input.patch.baseUrl) {
            await validateServerInput(merged);
          }
        } catch (err) {
          if (err instanceof McpSecurityError) throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
          throw err;
        }

        const row = await ctx.prisma.mcpServer.update({
          where: { id: input.id },
          data: {
            name: input.patch.name,
            transport: input.patch.transport ? serverTransportToEnum(input.patch.transport) : undefined,
            command: input.patch.command,
            args: input.patch.args,
            baseUrl: input.patch.baseUrl,
            headers: input.patch.headers,
            enabled: input.patch.enabled,
          },
        });
        const config = rowToMcpServerConfig(row);
        mcpRegistry.unregister(row.id);
        mcpRegistry.register(config);
        mcpToolRouter.unregisterServer(row.id);
        await mcpConnectionPool.disconnect(row.id);
        return row;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const owned = await getUserMcpServer(ctx.userId!, input.id);
        if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "MCP server not found" });
        await ctx.prisma.mcpServer.delete({ where: { id: input.id } });
        mcpRegistry.unregister(input.id);
        mcpToolRouter.unregisterServer(input.id);
        await mcpConnectionPool.disconnect(input.id);
        return { success: true };
      }),

    test: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const owned = await getUserMcpServer(ctx.userId!, input.id);
        if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "MCP server not found" });
        const config = rowToMcpServerConfig(owned);
        mcpRegistry.register(config);
        try {
          const tools = await mcpConnectionPool.listTools(config);
          mcpToolRouter.unregisterServer(config.id);
          for (const tool of tools) mcpToolRouter.register(tool.name, config.id);
          await ctx.prisma.mcpServer.update({
            where: { id: input.id },
            data: { lastError: null, lastConnectedAt: new Date(), lastToolCount: tools.length },
          });
          return { success: true, tools: tools.map((t) => t.name) };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await ctx.prisma.mcpServer.update({
            where: { id: input.id },
            data: { lastError: message },
          });
          return { success: false, error: message };
        }
      }),

    tools: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const owned = await getUserMcpServer(ctx.userId!, input.id);
        if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "MCP server not found" });
        const config = rowToMcpServerConfig(owned);
        mcpRegistry.register(config);
        try {
          const tools = await mcpConnectionPool.listTools(config);
          return { success: true, tools };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { success: false, error: message };
        }
      }),

    callTool: protectedProcedure
      .input(z.object({ id: z.string(), toolName: z.string(), args: z.record(z.string(), z.unknown()).optional() }))
      .mutation(async ({ input, ctx }) => {
        const owned = await getUserMcpServer(ctx.userId!, input.id);
        if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "MCP server not found" });
        const config = rowToMcpServerConfig(owned);
        mcpRegistry.register(config);
        try {
          return await mcpConnectionPool.callTool(config, input.toolName, input.args ?? {});
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err instanceof Error ? err.message : String(err) });
        }
      }),
  }),
});
