import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../middleware/trpc";

export const marketplaceRouter = router({
  list: publicProcedure
    .input(z.object({
      category: z.string().optional(),
      search: z.string().optional(),
      sort: z.enum(["popular", "newest", "rating"]).default("popular"),
      cursor: z.string().optional(),
      limit: z.number().default(20),
    }))
    .query(async ({ input, ctx }) => {
      const where: any = {};
      if (input.category) where.category = input.category;
      if (input.search) {
        where.OR = [
          { title: { contains: input.search, mode: "insensitive" } },
          { description: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const orderBy: any =
        input.sort === "newest" ? { publishedAt: "desc" } :
        input.sort === "rating" ? { ratingAvg: "desc" } :
        { downloads: "desc" };

      const flows = await ctx.prisma.marketplaceFlow.findMany({
        where,
        orderBy,
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (flows.length > input.limit) {
        flows.pop();
        nextCursor = flows[flows.length - 1]?.id;
      }

      return { flows, nextCursor };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const flow = await ctx.prisma.marketplaceFlow.findUnique({
        where: { id: input.id },
        include: {
          pipeline: true,
          reviews: { include: { reviewer: { select: { name: true, avatarUrl: true } } } },
        },
      });
      if (!flow) throw new TRPCError({ code: "NOT_FOUND" });
      return flow;
    }),

  clone: protectedProcedure
    .input(z.object({ flowId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const sourceFlow = await ctx.prisma.marketplaceFlow.findUnique({
        where: { id: input.flowId },
        include: { pipeline: true },
      });
      if (!sourceFlow) throw new TRPCError({ code: "NOT_FOUND" });

      const clonedPipeline = await ctx.prisma.pipeline.create({
        data: {
          userId: ctx.userId,
          name: `${sourceFlow.title} (clone)`,
          description: sourceFlow.description,
          graph: sourceFlow.pipeline.graph as any,
          tags: sourceFlow.tags,
          category: sourceFlow.category,
        },
      });

      await ctx.prisma.flowClone.create({
        data: {
          sourceFlowId: input.flowId,
          clonePipelineId: clonedPipeline.id,
          userId: ctx.userId,
        },
      });

      await ctx.prisma.marketplaceFlow.update({
        where: { id: input.flowId },
        data: { downloads: { increment: 1 } },
      });

      return clonedPipeline;
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string(), limit: z.number().default(10) }))
    .query(async ({ input, ctx }) => {
      return ctx.prisma.marketplaceFlow.findMany({
        where: {
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
            { description: { contains: input.query, mode: "insensitive" } },
            { tags: { has: input.query.toLowerCase() } },
          ],
        },
        take: input.limit,
        orderBy: { downloads: "desc" },
      });
    }),

  publish: protectedProcedure
    .input(z.object({
      pipelineId: z.string(),
      category: z.string(),
      title: z.string(),
      description: z.string(),
      tags: z.array(z.string()).optional(),
      price: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pipeline = await ctx.prisma.pipeline.findUnique({
        where: { id: input.pipelineId },
      });
      if (!pipeline || pipeline.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return ctx.prisma.marketplaceFlow.create({
        data: {
          pipelineId: input.pipelineId,
          creatorId: ctx.userId,
          category: input.category,
          title: input.title,
          description: input.description,
          tags: input.tags || [],
          price: input.price,
        },
      });
    }),

  rate: protectedProcedure
    .input(z.object({ flowId: z.string(), stars: z.number().min(1).max(5), body: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const review = await ctx.prisma.flowReview.upsert({
        where: { flowId_reviewerId: { flowId: input.flowId, reviewerId: ctx.userId } },
        update: { stars: input.stars, body: input.body },
        create: {
          flowId: input.flowId,
          reviewerId: ctx.userId,
          stars: input.stars,
          body: input.body,
        },
      });

      const aggregate = await ctx.prisma.flowReview.aggregate({
        where: { flowId: input.flowId },
        _avg: { stars: true },
        _count: true,
      });

      await ctx.prisma.marketplaceFlow.update({
        where: { id: input.flowId },
        data: {
          ratingAvg: aggregate._avg.stars || 0,
          ratingCount: aggregate._count,
        },
      });

      return review;
    }),
});
