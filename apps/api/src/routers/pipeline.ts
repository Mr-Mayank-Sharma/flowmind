import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../middleware/trpc";
import { PipelineEngine } from "@flowmind/pipeline-engine";
import type { PipelineGraph, WorkflowSettings } from "@flowmind/pipeline-engine";

const engine = new PipelineEngine();

const graphSchema = z.object({
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
});

const workflowSettingsSchema = z.object({
  timezone: z.string().optional(),
  executionOrder: z.enum(["sequential", "parallel"]).optional(),
  errorWorkflowId: z.string().optional(),
  saveDataOnError: z.enum(["all", "none"]).optional(),
  saveManualExecutions: z.boolean().optional(),
  retryOnFail: z.boolean().optional(),
  maxRetries: z.number().optional(),
  timeout: z.number().optional(),
}).optional();

export const pipelineRouter = router({
  list: protectedProcedure
    .input(z.object({ cursor: z.string().optional(), limit: z.number().default(20) }).optional())
    .query(async ({ input, ctx }) => {
      const pipelines = await ctx.prisma.pipeline.findMany({
        where: { userId: ctx.userId },
        orderBy: { updatedAt: "desc" },
        take: (input?.limit ?? 20) + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
        select: {
          id: true, name: true, description: true, status: true, isActive: true,
          graph: true, runCount: true, lastRunAt: true, createdAt: true, updatedAt: true,
        },
      });

      const enriched = pipelines.map(({ graph, ...rest }) => ({
        ...rest,
        nodeCount: typeof graph === "object" && graph ? (Array.isArray((graph as any).nodes) ? (graph as any).nodes.length : 0) : 0,
      }));

      let nextCursor: string | undefined;
      if (pipelines.length > (input?.limit ?? 20)) {
        enriched.pop();
        nextCursor = enriched[enriched.length - 1]?.id;
      }

      return { pipelines: enriched, nextCursor };
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      graph: graphSchema,
      settings: workflowSettingsSchema,
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
    .input(z.object({ id: z.string(), input: z.record(z.unknown()).optional(), settings: workflowSettingsSchema }))
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
          status: "RUNNING",
          input: (input.input || {}) as any,
          startedAt: new Date(),
        },
      });

      try {
        const graph = pipeline.graph as unknown as PipelineGraph;
        const result = await engine.execute(run.id, input.id, graph, input.input ?? {}, input.settings);

        const logData = result.outputs.map((o) => ({
          runId: run.id,
          nodeId: o.nodeId,
          nodeType: o.nodeType,
          input: {},
          output: o.output as any,
          error: o.error,
          duration: o.durationMs,
        }));

        if (logData.length > 0) {
          await ctx.prisma.runLog.createMany({ data: logData });
        }

        const finalStatus = result.status === "success" ? "SUCCESS" as const : "FAILED" as const;

        await ctx.prisma.pipelineRun.update({
          where: { id: run.id },
          data: {
            status: finalStatus,
            output: result as any,
            completedAt: new Date(),
          },
        });

        await ctx.prisma.pipeline.update({
          where: { id: input.id },
          data: {
            runCount: { increment: 1 },
            lastRunAt: new Date(),
            avgDurationMs: result.durationMs,
          },
        });

        return { runId: run.id, status: finalStatus, outputs: result.outputs, durationMs: result.durationMs };
      } catch (err: any) {
        await ctx.prisma.pipelineRun.update({
          where: { id: run.id },
          data: { status: "FAILED", output: { error: err.message }, completedAt: new Date() },
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message ?? "Pipeline execution failed" });
      }
    }),

  executeNode: protectedProcedure
    .input(z.object({
      pipelineId: z.string(),
      nodeId: z.string(),
      input: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pipeline = await ctx.prisma.pipeline.findUnique({
        where: { id: input.pipelineId },
      });
      if (!pipeline || (pipeline.userId !== ctx.userId)) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const graph = pipeline.graph as unknown as PipelineGraph;
      const nodeOutput = await engine.executeSingleNode(
        `test-${Date.now()}`,
        input.pipelineId,
        graph,
        input.nodeId,
        input.input ?? {},
      );
      return nodeOutput;
    }),

  validate: protectedProcedure
    .input(z.object({ graph: graphSchema }))
    .query(async ({ input }) => {
      const { validateGraph } = await import("@flowmind/pipeline-engine");
      return { errors: validateGraph(input.graph as PipelineGraph) };
    }),

  simulate: protectedProcedure
    .input(z.object({ graph: graphSchema }))
    .query(async ({ input }) => {
      const result = engine.simulate(input.graph as PipelineGraph);
      return result;
    }),

  loadOptions: protectedProcedure
    .input(z.object({
      nodeType: z.string(),
      field: z.string(),
      config: z.record(z.unknown()).optional(),
      filter: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return engine.loadOptions(input.nodeType, input.field, input.config ?? {}, input.filter);
    }),

  getRuns: protectedProcedure
    .input(z.object({ pipelineId: z.string(), cursor: z.string().optional(), limit: z.number().default(20) }))
    .query(async ({ input, ctx }) => {
      return ctx.prisma.pipelineRun.findMany({
        where: { pipelineId: input.pipelineId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        include: { logs: true },
      });
    }),

  getRunLogs: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.prisma.runLog.findMany({
        where: { runId: input.runId },
        orderBy: { createdAt: "asc" },
      });
    }),

  listMarketplace: publicProcedure
    .input(z.object({ category: z.string().optional(), limit: z.number().default(20) }).optional())
    .query(async ({ input, ctx }) => {
      const where: any = {};
      if (input?.category) where.category = input.category;
      return ctx.prisma.marketplaceFlow.findMany({
        where,
        take: input?.limit ?? 20,
        orderBy: { downloads: "desc" },
        include: {
          pipeline: { select: { name: true, description: true } },
          _count: { select: { clones: true, reviews: true } },
        },
      });
    }),

  getMarketplaceById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const flow = await ctx.prisma.marketplaceFlow.findUnique({
        where: { id: input.id },
        include: {
          pipeline: true,
          reviews: { include: { reviewer: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
        },
      });
      if (!flow) throw new TRPCError({ code: "NOT_FOUND" });
      return flow;
    }),

  publishToMarketplace: protectedProcedure
    .input(z.object({
      pipelineId: z.string(),
      title: z.string(),
      description: z.string(),
      category: z.string(),
      tags: z.array(z.string()).optional(),
      price: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pipeline = await ctx.prisma.pipeline.findUnique({ where: { id: input.pipelineId } });
      if (!pipeline || pipeline.userId !== ctx.userId) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.marketplaceFlow.create({
        data: {
          pipelineId: input.pipelineId,
          creatorId: ctx.userId,
          title: input.title,
          description: input.description,
          category: input.category,
          tags: input.tags ?? [],
          price: input.price,
        },
      });
    }),

  cloneFromMarketplace: protectedProcedure
    .input(z.object({ marketplaceId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const marketFlow = await ctx.prisma.marketplaceFlow.findUnique({
        where: { id: input.marketplaceId },
        include: { pipeline: true },
      });
      if (!marketFlow) throw new TRPCError({ code: "NOT_FOUND" });

      const clonedPipeline = await ctx.prisma.pipeline.create({
        data: {
          userId: ctx.userId,
          name: `${marketFlow.title} (clone)`,
          description: marketFlow.description,
          graph: marketFlow.pipeline.graph as any,
        },
      });

      await ctx.prisma.flowClone.create({
        data: {
          sourceFlowId: input.marketplaceId,
          clonePipelineId: clonedPipeline.id,
          userId: ctx.userId,
        },
      });

      await ctx.prisma.marketplaceFlow.update({
        where: { id: input.marketplaceId },
        data: { downloads: { increment: 1 } },
      });

      return clonedPipeline;
    }),

  marketplaceCategories: publicProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.flowCategory.findMany({
        orderBy: { sortOrder: "asc" },
      });
    }),
});
