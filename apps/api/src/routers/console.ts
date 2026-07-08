import { z } from "zod"
import crypto from "crypto"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure } from "../middleware/trpc"
import { BillingService } from "@flowmind/billing"
import { Tier, OrgRole } from "@flowmind/shared"

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex")
}

export const consoleRouter = router({
  // --- Workspaces ---
  listWorkspaces: protectedProcedure
    .query(async ({ ctx }) => {
      const memberships = await ctx.prisma.orgMember.findMany({
        where: { userId: ctx.userId },
        include: { org: true },
      })
      return memberships.map((m) => ({ ...m.org, role: m.role }))
    }),

  getWorkspace: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const org = await ctx.prisma.org.findUnique({ where: { id: input.id } })
      if (!org) throw new TRPCError({ code: "NOT_FOUND" })
      const membership = await ctx.prisma.orgMember.findFirst({
        where: { orgId: input.id, userId: ctx.userId },
      })
      if (!membership) throw new TRPCError({ code: "FORBIDDEN" })
      return { ...org, role: membership.role }
    }),

  createWorkspace: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
      tier: z.nativeEnum(Tier).default(Tier.FREE),
    }))
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.prisma.org.findUnique({ where: { slug: input.slug } })
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Slug already taken" })
      const org = await ctx.prisma.org.create({
        data: { name: input.name, slug: input.slug, tier: input.tier },
      })
      await ctx.prisma.orgMember.create({
        data: { orgId: org.id, userId: ctx.userId, role: OrgRole.OWNER },
      })
      return org
    }),

  updateWorkspace: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      slug: z.string().min(1).max(50).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const membership = await ctx.prisma.orgMember.findFirst({
        where: { orgId: input.id, userId: ctx.userId, role: OrgRole.OWNER },
      })
      if (!membership) throw new TRPCError({ code: "FORBIDDEN" })
      return ctx.prisma.org.update({ where: { id: input.id }, data: input })
    }),

  deleteWorkspace: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const membership = await ctx.prisma.orgMember.findFirst({
        where: { orgId: input.id, userId: ctx.userId, role: OrgRole.OWNER },
      })
      if (!membership) throw new TRPCError({ code: "FORBIDDEN" })
      await ctx.prisma.org.delete({ where: { id: input.id } })
      return { success: true }
    }),

  // --- Members ---
  listMembers: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ input, ctx }) => {
      const membership = await ctx.prisma.orgMember.findFirst({
        where: { orgId: input.orgId, userId: ctx.userId },
      })
      if (!membership) throw new TRPCError({ code: "FORBIDDEN" })
      return ctx.prisma.orgMember.findMany({
        where: { orgId: input.orgId },
        include: { user: { select: { id: true, email: true, name: true } } },
      })
    }),

  inviteMember: protectedProcedure
    .input(z.object({ orgId: z.string(), email: z.string().email(), role: z.nativeEnum(OrgRole) }))
    .mutation(async ({ input, ctx }) => {
      const membership = await ctx.prisma.orgMember.findFirst({
        where: { orgId: input.orgId, userId: ctx.userId, role: OrgRole.OWNER },
      })
      if (!membership) throw new TRPCError({ code: "FORBIDDEN" })
      const user = await ctx.prisma.user.findUnique({ where: { email: input.email } })
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" })
      const existing = await ctx.prisma.orgMember.findFirst({
        where: { orgId: input.orgId, userId: user.id },
      })
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Already a member" })
      return ctx.prisma.orgMember.create({
        data: { orgId: input.orgId, userId: user.id, role: input.role },
      })
    }),

  removeMember: protectedProcedure
    .input(z.object({ orgId: z.string(), userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const membership = await ctx.prisma.orgMember.findFirst({
        where: { orgId: input.orgId, userId: ctx.userId, role: OrgRole.OWNER },
      })
      if (!membership) throw new TRPCError({ code: "FORBIDDEN" })
      await ctx.prisma.orgMember.delete({
        where: { orgId_userId: { orgId: input.orgId, userId: input.userId } },
      })
      return { success: true }
    }),

  // --- API Keys ---
  listApiKeys: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.apiKey.findMany({
        where: { userId: ctx.userId },
        select: { id: true, name: true, provider: true, lastFour: true, createdAt: true, lastUsedAt: true, isActive: true },
      })
    }),

  createApiKey: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100), provider: z.string().default("flowmind") }))
    .mutation(async ({ input, ctx }) => {
      const raw = `fm_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`
      const lastFour = raw.slice(-4)
      return ctx.prisma.apiKey.create({
        data: {
          userId: ctx.userId,
          name: input.name,
          provider: input.provider,
          keyHash: hashKey(raw),
          lastFour,
        },
        select: { id: true, name: true, provider: true, lastFour: true, createdAt: true },
      })
    }),

  deleteApiKey: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const key = await ctx.prisma.apiKey.findFirst({ where: { id: input.id, userId: ctx.userId } })
      if (!key) throw new TRPCError({ code: "NOT_FOUND" })
      await ctx.prisma.apiKey.delete({ where: { id: input.id } })
      return { success: true }
    }),

  // --- Billing ---
  getSubscription: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.subscription.findUnique({ where: { userId: ctx.userId } })
    }),

  createCheckoutSession: protectedProcedure
    .input(z.object({ tier: z.nativeEnum(Tier), orgId: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const url = await BillingService.createCheckoutSession({
          userId: ctx.userId,
          tier: input.tier,
          orgId: input.orgId,
        })
        return { url }
      } catch (e: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: e.message })
      }
    }),

  getUsageMetrics: protectedProcedure
    .query(async ({ ctx }) => {
      return BillingService.getUsageMetrics(ctx.userId)
    }),

  manageTeamSeats: protectedProcedure
    .input(z.object({ orgId: z.string(), quantity: z.number().min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      try {
        await BillingService.manageTeamSeats({ orgId: input.orgId, quantity: input.quantity })
        return { success: true }
      } catch (e: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: e.message })
      }
    }),

  // --- Usage ---
  getUsage: protectedProcedure
    .query(async ({ ctx }) => {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const sessions = await ctx.prisma.session.findMany({
        where: { userId: ctx.userId, createdAt: { gte: startOfMonth } },
        orderBy: { createdAt: "desc" },
      })
      const pipelines = await ctx.prisma.pipeline.count({ where: { userId: ctx.userId } })
      const jobs = await ctx.prisma.cronJob.count({ where: { userId: ctx.userId } })

      const dailyUsage: Record<string, number> = {}
      for (const s of sessions) {
        const day = s.createdAt.toISOString().slice(0, 10)
        dailyUsage[day] = (dailyUsage[day] ?? 0) + 1
      }

      return {
        totalSessions: sessions.length,
        pipelines,
        cronJobs: jobs,
        dailyUsage,
        startOfMonth,
      }
    }),
})
