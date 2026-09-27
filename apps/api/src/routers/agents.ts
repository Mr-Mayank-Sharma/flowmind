import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure } from "../middleware/trpc"

const RUNTIME_URL = process.env.AGENT_RUNTIME_URL || "http://localhost:8001"

/**
 * An agent is a persisted configuration record, not a deployed process. There is
 * no deploy step, so status is only ever derived from two real facts: what the
 * user last asked for (RUNNING / STOPPED) and whether the agent runtime was
 * reachable at the moment of the last start attempt.
 */
type RuntimeHealth = {
  reachable: boolean
  checkedAt: Date
  error?: string
}

async function checkRuntime(): Promise<RuntimeHealth> {
  try {
    const res = await fetch(`${RUNTIME_URL}/health`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) return { reachable: true, checkedAt: new Date() }
    return { reachable: false, checkedAt: new Date(), error: `Runtime health returned ${res.status}` }
  } catch (err) {
    return {
      reachable: false,
      checkedAt: new Date(),
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export const agentsRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.agent.findMany({
        where: { userId: ctx.userId ?? undefined },
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
        // STOPPED, not "DEPLOYING": nothing is deployed until the user starts it.
        data: { ...input, userId: ctx.userId!, status: "STOPPED" },
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
        where: { id: input.id, userId: ctx.userId ?? undefined },
      })
      return { success: true }
    }),

  /**
   * Start/stop is the whole lifecycle. Starting probes the agent runtime: the
   * agent is only marked RUNNING when the runtime actually answered, otherwise
   * it lands in ERROR so the UI shows the real reason instead of a fake success.
   */
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

      const health = await checkRuntime()
      return ctx.prisma.agent.update({
        where: { id: input.id },
        data: { status: health.reachable ? "RUNNING" : "ERROR" },
      })
    }),

  /**
   * Live runtime reachability plus a status breakdown for the caller. The stored
   * per-agent status is last-known (from the last toggle), so the UI shows this
   * separately instead of pretending a stale RUNNING means the runtime is up.
   */
  health: protectedProcedure
    .query(async ({ ctx }) => {
      const runtime = await checkRuntime()
      const agents = await ctx.prisma.agent.findMany({
        where: { userId: ctx.userId ?? undefined },
        select: { id: true, status: true },
      })
      const counts: Record<string, number> = { RUNNING: 0, STOPPED: 0, ERROR: 0 }
      for (const agent of agents) {
        counts[agent.status] = (counts[agent.status] ?? 0) + 1
      }
      return { runtime, total: agents.length, counts }
    }),
})
