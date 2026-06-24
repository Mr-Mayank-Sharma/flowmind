import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../middleware/trpc";

export const pipelineRouter = router({
  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      graph: z.object({
        nodes: z.array(z.any()),
        edges: z.array(z.any()),
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.prisma.pipeline.create({
        data: {
          userId: ctx.userId,
          name: input.name,
          description: input.description,
          graph: JSON.parse(JSON.stringify(input.graph)),
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      graph: z.any().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pipeline = await ctx.prisma.pipeline.findUnique({
        where: { id: input.id },
      });
      if (!pipeline || (pipeline.userId !== ctx.userId)) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return ctx.prisma.pipeline.update({
        where: { id: input.id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.description && { description: input.description }),
          ...(input.graph && { graph: input.graph, version: { increment: 1 } }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.pipeline.deleteMany({
        where: { id: input.id, userId: ctx.userId },
      });
      return { success: true };
    }),

  list: protectedProcedure
    .input(z.object({ cursor: z.string().optional(), limit: z.number().default(20) }))
    .query(async ({ input, ctx }) => {
      const pipelines = await ctx.prisma.pipeline.findMany({
        where: { userId: ctx.userId },
        orderBy: { updatedAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (pipelines.length > input.limit) {
        pipelines.pop();
        nextCursor = pipelines[pipelines.length - 1]?.id;
      }

      return { pipelines, nextCursor };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const pipeline = await ctx.prisma.pipeline.findUnique({
        where: { id: input.id },
        include: { runs: { take: 10, orderBy: { createdAt: "desc" } } },
      });
      if (!pipeline || (pipeline.userId !== ctx.userId)) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return pipeline;
    }),

  trigger: protectedProcedure
    .input(z.object({ id: z.string(), input: z.record(z.unknown()).optional() }))
    .mutation(async ({ input, ctx }) => {
      const pipeline = await ctx.prisma.pipeline.findUnique({
        where: { id: input.id },
      });
      if (!pipeline || (pipeline.userId !== ctx.userId)) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const run = await ctx.prisma.pipelineRun.create({
        data: {
          pipelineId: input.id,
          status: "PENDING",
          input: (input.input || {}) as any,
        },
      });

      return run;
    }),

  getRuns: protectedProcedure
    .input(z.object({ pipelineId: z.string(), cursor: z.string().optional(), limit: z.number().default(20) }))
    .query(async ({ input, ctx }) => {
      return ctx.prisma.pipelineRun.findMany({
        where: { pipelineId: input.pipelineId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });
    }),
});
