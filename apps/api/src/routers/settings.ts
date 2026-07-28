import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../middleware/trpc";

export const settingsRouter = router({
  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().optional(), timezone: z.string().optional(), language: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.userId! },
        data: input,
      });
    }),

  getApiKeys: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.apiKey.findMany({
        where: { userId: ctx.userId ?? undefined },
        select: { id: true, name: true, provider: true, lastFour: true, lastUsedAt: true, createdAt: true, isActive: true },
      });
    }),

  createApiKey: protectedProcedure
    .input(z.object({ name: z.string(), provider: z.string(), key: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { createHash } = await import("crypto");
      const keyHash = createHash("sha256").update(input.key).digest("hex");
      const lastFour = input.key.slice(-4);

      return ctx.prisma.apiKey.create({
        data: {
          userId: ctx.userId!,
          name: input.name,
          provider: input.provider,
          keyHash,
          lastFour,
        },
      });
    }),

  deleteApiKey: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.apiKey.deleteMany({
        where: { id: input.id, userId: ctx.userId ?? undefined },
      });
      return { success: true };
    }),

  getNotifications: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.notification.findMany({
        where: { userId: ctx.userId ?? undefined },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }),

  updateNotification: protectedProcedure
    .input(z.object({ id: z.string(), read: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.prisma.notification.updateMany({
        where: { id: input.id, userId: ctx.userId ?? undefined },
        data: { read: input.read },
      });
    }),

  updateAppearance: protectedProcedure
    .input(z.object({ theme: z.string().optional(), fontSize: z.string().optional(), chatDensity: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.userId! },
        data: input as any,
      });
    }),

  getOrg: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId! },
        include: { org: true },
      });
      if (!user?.org) return null;
      return user.org;
    }),

  updateOrg: protectedProcedure
    .input(z.object({ name: z.string().optional(), slug: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId! },
        select: { orgId: true },
      });
      if (!user?.orgId) throw new TRPCError({ code: "NOT_FOUND", message: "No organization" });
      return ctx.prisma.org.update({
        where: { id: user.orgId },
        data: input,
      });
    }),

  getOrgMembers: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId! },
        select: { orgId: true },
      });
      if (!user?.orgId) return [];
      return ctx.prisma.orgMember.findMany({
        where: { orgId: user.orgId },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });
    }),

  getConnections: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.account.findMany({
        where: { userId: ctx.userId ?? undefined },
        select: { id: true, provider: true, scope: true },
      });
    }),

  deleteConnection: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.account.deleteMany({
        where: { id: input.id, userId: ctx.userId ?? undefined },
      });
      return { success: true };
    }),

  getApiTokens: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.apiKey.findMany({
        where: { userId: ctx.userId ?? undefined, provider: "api_token" },
        select: { id: true, name: true, lastFour: true, lastUsedAt: true, createdAt: true, isActive: true },
      });
    }),

  createApiToken: protectedProcedure
    .input(z.object({ name: z.string(), scopes: z.array(z.string()).default([]) }))
    .mutation(async ({ input, ctx }) => {
      const { createHash, randomBytes } = await import("crypto");
      const raw = `fm_${input.name.toLowerCase().replace(/\s+/g, "_")}_${randomBytes(12).toString("hex")}`;
      const keyHash = createHash("sha256").update(raw).digest("hex");
      const lastFour = raw.slice(-4);

      await ctx.prisma.apiKey.create({
        data: {
          userId: ctx.userId!,
          name: input.name,
          provider: "api_token",
          keyHash,
          lastFour,
        },
      });

      return { token: raw, lastFour };
    }),

  deleteApiToken: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.apiKey.deleteMany({
        where: { id: input.id, userId: ctx.userId ?? undefined, provider: "api_token" },
      });
      return { success: true };
    }),

  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.user.findUnique({
        where: { id: ctx.userId! },
        select: {
          id: true, name: true, email: true, avatarUrl: true, role: true, tier: true,
          timezone: true, language: true, defaultModel: true, createdAt: true,
        },
      });
    }),

  getMemories: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.memory.findMany({
        where: { userId: ctx.userId ?? undefined },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }),

  deleteMemory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.memory.deleteMany({
        where: { id: input.id, userId: ctx.userId ?? undefined },
      });
      return { success: true };
    }),

  getAuditLog: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId! },
        select: { orgId: true },
      });
      if (!user?.orgId) return [];
      const logs = await ctx.prisma.auditLog.findMany({
        where: { orgId: user.orgId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      const userIds = [...new Set(logs.map((l) => l.userId))];
      const users = await ctx.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));
      return logs.map((log) => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        userName: userMap.get(log.userId)?.name ?? "Unknown",
        userEmail: userMap.get(log.userId)?.email ?? "",
        ip: log.ipAddress ?? "",
        timestamp: log.createdAt.toISOString(),
        status: (log.details as any)?.status ?? "success",
        details: typeof log.details === "string" ? log.details : JSON.stringify(log.details ?? {}),
      }));
    }),

  getSubscription: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.subscription.findUnique({
        where: { userId: ctx.userId ?? undefined },
      });
    }),

  exportData: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId!
      const [pipelines, sessions, memories, apiKeys] = await Promise.all([
        ctx.prisma.pipeline.findMany({ where: { userId } }),
        ctx.prisma.session.findMany({ where: { userId }, include: { messages: true } }),
        ctx.prisma.memory.findMany({ where: { userId } }),
        ctx.prisma.apiKey.findMany({ where: { userId }, select: { id: true, name: true, provider: true, lastFour: true, createdAt: true } }),
      ])
      return {
        exportedAt: new Date().toISOString(),
        pipelines: pipelines.map(p => ({ name: p.name, description: p.description, graph: p.graph, tags: p.tags })),
        sessions: sessions.map(s => ({ title: s.title, messageCount: s.messages?.length ?? 0, updatedAt: s.updatedAt })),
        memories: memories.map(m => ({ content: m.content, type: m.type, summary: m.summary, createdAt: m.createdAt })),
        apiKeys: apiKeys.map(k => ({ name: k.name, provider: k.provider, lastFour: k.lastFour, createdAt: k.createdAt })),
      }
    }),

  deleteAccount: protectedProcedure
    .input(z.object({ password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.prisma.user.findUnique({ where: { id: ctx.userId! } })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })
      const bcrypt = await import("bcryptjs")
      const valid = await bcrypt.compare(input.password, user.passwordHash!)
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid password" })
      await Promise.all([
        ctx.prisma.pipeline.deleteMany({ where: { userId: ctx.userId! } }),
        ctx.prisma.session.deleteMany({ where: { userId: ctx.userId! } }),
        ctx.prisma.memory.deleteMany({ where: { userId: ctx.userId! } }),
        ctx.prisma.apiKey.deleteMany({ where: { userId: ctx.userId! } }),
        ctx.prisma.notification.deleteMany({ where: { userId: ctx.userId! } }),
        ctx.prisma.mcpToken.deleteMany({ where: { userId: ctx.userId! } }),
      ])
      await ctx.prisma.user.delete({ where: { id: ctx.userId! } })
      return { success: true }
    }),

  getSessions: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.session.findMany({
        where: { userId: ctx.userId ?? undefined },
        orderBy: { updatedAt: "desc" },
        take: 20,
        include: {
          _count: { select: { messages: true } },
        },
      });
    }),
});
