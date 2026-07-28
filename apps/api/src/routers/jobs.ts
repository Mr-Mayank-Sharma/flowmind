import { z } from "zod";
import cron from "node-cron";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../middleware/trpc";
import { unschedule } from "../services/cron-scheduler";

const CRON_SCHEMA_HELP = "Standard 5-field cron: minute hour day-of-month month day-of-week. Examples: '*/5 * * * *' (every 5 min), '0 7 * * *' (daily 7 AM), '0 9 * * 1-5' (weekdays 9 AM)";

export const jobsRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.cronJob.findMany({
        where: { userId: ctx.userId ?? undefined },
        orderBy: { createdAt: "desc" },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const job = await ctx.prisma.cronJob.findUnique({ where: { id: input.id } });
      if (!job || job.userId !== ctx.userId) throw new TRPCError({ code: "NOT_FOUND" });
      return job;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      expression: z.string(),
      pipelineId: z.string(),
      channel: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!cron.validate(input.expression)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Invalid cron expression. ${CRON_SCHEMA_HELP}` });
      }

      const pipeline = await ctx.prisma.pipeline.findUnique({ where: { id: input.pipelineId } });
      if (!pipeline || pipeline.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline not found" });
      }

      const jobCount = await ctx.prisma.cronJob.count({ where: { userId: ctx.userId ?? undefined } });
      if (jobCount >= 20) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cron job limit reached. Upgrade your plan for more scheduled jobs." });
      }

      const nextRunAt = (() => {
        try {
          const parts = input.expression.trim().split(/\s+/)
          if (parts.length !== 5) return null
          const now = new Date()
          const next = new Date(now)
          const min = parts[0] === "*" ? now.getMinutes() + 1 : parseInt(parts[0]!.replace("*/", ""), 10)
          if (parts[0]!.startsWith("*/")) {
            next.setMinutes(Math.ceil((now.getMinutes() + 1) / min) * min)
          } else {
            next.setMinutes(min)
            if (min <= now.getMinutes()) next.setHours(next.getHours() + 1)
          }
          return next > now ? next : null
        } catch {
          return null
        }
      })();

      const job = await ctx.prisma.cronJob.create({
        data: {
          userId: ctx.userId!,
          name: input.name,
          expression: input.expression,
          pipelineId: input.pipelineId,
          channel: input.channel,
          nextRunAt,
        },
      });

      const { reschedule } = await import("../services/cron-scheduler");
      reschedule(job.id, job.expression, job.pipelineId);

      return job;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      expression: z.string().optional(),
      isActive: z.boolean().optional(),
      channel: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const job = await ctx.prisma.cronJob.findUnique({ where: { id: input.id } });
      if (!job || job.userId !== ctx.userId) throw new TRPCError({ code: "NOT_FOUND" });

      if (input.expression && !cron.validate(input.expression)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Invalid cron expression. ${CRON_SCHEMA_HELP}` });
      }

      const nextRunAt = input.expression ? (() => {
        try {
          const parts = input.expression!.trim().split(/\s+/)
          if (parts.length !== 5) return null
          const now = new Date()
          const next = new Date(now)
          const min = parts[0] === "*" ? now.getMinutes() + 1 : parseInt(parts[0]!.replace("*/", ""), 10)
          if (parts[0]!.startsWith("*/")) {
            next.setMinutes(Math.ceil((now.getMinutes() + 1) / min) * min)
          } else {
            next.setMinutes(min)
            if (min <= now.getMinutes()) next.setHours(next.getHours() + 1)
          }
          return next > now ? next : null
        } catch {
          return null
        }
      })() : undefined;

      const updated = await ctx.prisma.cronJob.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.expression !== undefined && { expression: input.expression }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          ...(input.channel !== undefined && { channel: input.channel }),
          ...(nextRunAt !== undefined && { nextRunAt }),
        },
      });

      if (input.expression || input.isActive !== undefined) {
        if (updated.isActive) {
          const { reschedule } = await import("../services/cron-scheduler");
          reschedule(updated.id, updated.expression, updated.pipelineId);
        } else {
          unschedule(updated.id);
        }
      }

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      unschedule(input.id);
      await ctx.prisma.cronJob.deleteMany({
        where: { id: input.id, userId: ctx.userId ?? undefined },
      });
      return { success: true };
    }),

  toggle: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const job = await ctx.prisma.cronJob.findUnique({ where: { id: input.id } });
      if (!job || job.userId !== ctx.userId) throw new TRPCError({ code: "NOT_FOUND" });

      const newActive = !job.isActive;
      const updated = await ctx.prisma.cronJob.update({
        where: { id: input.id },
        data: { isActive: newActive },
      });

      if (newActive) {
        const { reschedule } = await import("../services/cron-scheduler");
        reschedule(updated.id, updated.expression, updated.pipelineId);
      } else {
        unschedule(updated.id);
      }

      return updated;
    }),
});
