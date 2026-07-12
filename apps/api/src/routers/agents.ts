import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure } from "../middleware/trpc"

const RUNTIME_URL = process.env.AGENT_RUNTIME_URL || "http://localhost:8001"

async function runtimeHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${RUNTIME_URL}/health`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

export const agentsRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.agent.findMany({
        where: { userId: ctx.userId },
        orderBy: { createdAt: "desc" },
      })
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const agent = await ctx.prisma.agent.findUnique({ where: { id: input.id } })
      if (!agent || agent.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      return agent
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      model: z.string().default("mistral:7b"),
      temperature: z.number().min(0).max(2).default(0.3),
      maxTokens: z.number().min(256).max(32768).default(2048),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.prisma.agent.create({
        data: { ...input, userId: ctx.userId, status: "DEPLOYING" },
      })
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      model: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().min(256).max(32768).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input
      const agent = await ctx.prisma.agent.findUnique({ where: { id } })
      if (!agent || agent.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      return ctx.prisma.agent.update({ where: { id }, data })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.agent.deleteMany({
        where: { id: input.id, userId: ctx.userId },
      })
      return { success: true }
    }),

  toggle: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const agent = await ctx.prisma.agent.findUnique({ where: { id: input.id } })
      if (!agent || agent.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }

      if (agent.status === "RUNNING") {
        return ctx.prisma.agent.update({
          where: { id: input.id },
          data: { status: "STOPPED" },
        })
      }

      const alive = await runtimeHealth()
      const newStatus = alive ? "RUNNING" : "ERROR"
      return ctx.prisma.agent.update({
        where: { id: input.id },
        data: { status: newStatus },
      })
    }),
})
