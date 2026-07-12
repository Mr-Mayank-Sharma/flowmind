import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../middleware/trpc";
import { McpExecutor, McpServerRegistry, McpConnectionPool, McpToolRouter, OAUTH_PROVIDERS } from "@flowmind/mcp-executor";

const registry = new McpServerRegistry();
const connectionPool = new McpConnectionPool();
const toolRouter = new McpToolRouter();

const tokenStore = {
  getToken: async (userId: string, provider: string) => {
    const { prisma } = await import("@flowmind/db");
    const rec = await prisma.mcpToken.findFirst({ where: { userId, provider } });
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
  refreshToken: async (_userId: string, _provider: string) => {
    throw new Error("Token refresh not yet implemented");
  },
};

const executor = new McpExecutor(registry, connectionPool, toolRouter, tokenStore);

export const mcpRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.mcpToken.findMany({
        where: { userId: ctx.userId },
        orderBy: { createdAt: "desc" },
      });
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
          userId: ctx.userId,
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
      return token;
    }),

  providers: publicProcedure
    .query(async () => {
      const providers: Array<{ id: string; authUrl: string; scopes: string[]; supportsPkce: boolean }> = [];
      for (const id of Object.keys(OAUTH_PROVIDERS)) {
        const cfg = OAUTH_PROVIDERS[id]!;
        providers.push({ id, authUrl: cfg.authUrl, scopes: cfg.scopes, supportsPkce: cfg.pkce });
      }
      return providers;
    }),

  oauthInitiate: protectedProcedure
    .input(z.object({ provider: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const redirectUri = `${process.env.APP_URL ?? "http://localhost:3000"}/mcp/oauth/callback`;
      return executor.initiateOAuthFlow(input.provider, redirectUri, ctx.userId);
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
      return executor.execute(input.toolName, input.args, ctx.userId);
    }),
});
