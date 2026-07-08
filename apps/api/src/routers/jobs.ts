import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../middleware/trpc";

export const jobsRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.cronJob.findMany({
        where: { userId: ctx.userId },
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
      name: z.string(),
      expression: z.string(),
      pipelineId: z.string(),
      channel: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.prisma.cronJob.create({
        data: {
          userId: ctx.userId,
          name: input.name,
          expression: input.expression,
          pipelineId: input.pipelineId,
          channel: input.channel,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      expression: z.string().optional(),
      isActive: z.boolean().optional(),
      channel: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const job = await ctx.prisma.cronJob.findUnique({ where: { id: input.id } });
      if (!job || job.userId !== ctx.userId) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.cronJob.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.expression !== undefined && { expression: input.expression }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          ...(input.channel !== undefined && { channel: input.channel }),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.cronJob.deleteMany({
        where: { id: input.id, userId: ctx.userId },
      });
      return { success: true };
    }),

  toggle: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const job = await ctx.prisma.cronJob.findUnique({ where: { id: input.id } });
      if (!job || job.userId !== ctx.userId) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.cronJob.update({
        where: { id: input.id },
        data: { isActive: !job.isActive },
      });
    }),
});
