import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "../middleware/trpc"
import { metricsService } from "../services"

export const systemRouter = router({
  getFrameworks: publicProcedure
    .input(z.object({}).optional())
    .query(async () => metricsService.getFrameworks()),

  getMetrics: protectedProcedure
    .query(async () => metricsService.getMetrics()),

  getRecentActivity: protectedProcedure
    .input(z.object({ limit: z.number().default(8) }))
    .query(async ({ input }) => metricsService.getRecentActivity(input.limit)),

  getGPUMetrics: protectedProcedure
    .query(async () => metricsService.getGPUInfo()),

  startFramework: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => metricsService.startFramework(input.id)),

  stopFramework: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => metricsService.stopFramework(input.id)),

  listProcesses: protectedProcedure
    .input(z.object({}).optional())
    .query(async () => metricsService.listProcesses()),

  killProcess: protectedProcedure
    .input(z.object({ pid: z.number(), signal: z.string().default("SIGTERM") }))
    .mutation(async ({ input }) => metricsService.killProcess(input.pid, input.signal)),
})
