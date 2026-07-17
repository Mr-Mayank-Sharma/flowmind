import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../middleware/trpc";
import { PipelineEngine } from "@flowmind/pipeline-engine";
import type { PipelineGraph, WorkflowSettings, PipelineNode, LLMProvider } from "@flowmind/pipeline-engine";
import { LLMEngine } from "@flowmind/llm-router";
import { getRunEmitter } from "../services/run-emitters";

function buildLLMProvider(): LLMProvider | undefined {
  const openaiKey = process.env.OPENAI_KEY;
  const anthropicKey = process.env.ANTHROPIC_KEY;
  const groqKey = process.env.GROQ_KEY;
  const ollamaUrl = process.env.OLLAMA_BASE_URL;
  if (!openaiKey && !anthropicKey && !groqKey && !ollamaUrl) return undefined;
  const llmEngine = new LLMEngine({
    openaiKey: openaiKey ?? undefined,
    anthropicKey: anthropicKey ?? undefined,
    groqKey: groqKey ?? undefined,
    deepseekKey: process.env.DEEPSEEK_KEY,
    openrouterKey: process.env.OPENROUTER_KEY,
    togetherKey: process.env.TOGETHER_KEY,
    mistralKey: process.env.MISTRAL_KEY,
    perplexityKey: process.env.PERPLEXITY_KEY,
    deepinfraKey: process.env.DEEPINFRA_KEY,
    cerebrasKey: process.env.CEREBRAS_KEY,
    xaiKey: process.env.XAI_KEY,
    cohereKey: process.env.COHERE_KEY,
    cloudflareKey: process.env.CLOUDFLARE_KEY,
    veniceAIKey: process.env.VENICE_AI_KEY,
    alibabaKey: process.env.ALIBABA_KEY,
    googleKey: process.env.GOOGLE_KEY,
    ollamaBaseUrl: ollamaUrl ?? undefined,
  });
  return {
    complete: async (req) => {
      const result = await llmEngine.complete({
        messages: req.messages as any,
        model: req.model ?? "tinyllama",
        maxTokens: req.maxTokens ?? 500,
        temperature: req.temperature,
      });
      return { content: result.message.content as string, model: result.model };
    },
  };
}

function normalizeGraph(graph: any): PipelineGraph {
  if (!graph || !graph.nodes) return { nodes: [], edges: [] }
  return {
    nodes: (graph.nodes as any[]).map((n: any) => ({
      id: n.id,
      type: n.engineType ?? n.type,
      label: n.label ?? "",
      position: n.position ?? { x: 0, y: 0 },
      config: n.config ?? {},
      continueOnFail: n.continueOnFail,
      retryOnFail: n.retryOnFail,
      maxRetries: n.maxRetries,
      disabled: n.disabled,
    } as PipelineNode)),
    edges: (graph.edges || []).map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    })),
  }
}

const llm = buildLLMProvider();
const engine = new PipelineEngine({ llm });

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

      const logBuffer: Array<{ runId: string; nodeId: string; nodeType: string; input: any; output: any; error?: string; duration: number }> = [];

      const engineWithStatus = new PipelineEngine({
        llm,
        onNodeStatus: async (event) => {
          const emitter = getRunEmitter(run.id);
          emitter.emit("node", {
            nodeId: event.nodeId,
            nodeType: event.nodeType,
            status: event.status,
            error: event.error,
            durationMs: event.durationMs,
          });

          if (event.status === "running") {
            logBuffer.push({
              runId: run.id, nodeId: event.nodeId, nodeType: event.nodeType,
              input: {}, output: {}, duration: 0,
            });
          } else if (event.status === "completed" || event.status === "failed") {
            const idx = logBuffer.findIndex((l) => l.nodeId === event.nodeId);
            if (idx >= 0) {
              const existing = logBuffer[idx]!;
              logBuffer[idx] = {
                runId: existing.runId,
                nodeId: existing.nodeId,
                nodeType: existing.nodeType,
                input: existing.input,
                output: event.error ? { error: event.error } : {},
                error: event.error,
                duration: event.durationMs ?? 0,
              };
            }
            const last = logBuffer[logBuffer.length - 1];
            if (last) {
              await ctx.prisma.runLog.createMany({ data: [last] });
            }
          }
        },
      });

      try {
        const rawGraph = pipeline.graph as any;
        const graph = normalizeGraph(rawGraph);
        const result = await engineWithStatus.execute(run.id, input.id, graph, input.input ?? {}, input.settings);

        // Flush any remaining buffered logs
        if (logBuffer.length > 0) {
          await ctx.prisma.runLog.createMany({ data: logBuffer });
        }

        // Check if run was cancelled mid-execution
        const afterRun = await ctx.prisma.pipelineRun.findUnique({ where: { id: run.id }, select: { status: true } });
        if (afterRun?.status === "CANCELLED") {
          return { runId: run.id, status: "CANCELLED" as const, outputs: result.outputs, durationMs: result.durationMs };
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

        const runEmitter = getRunEmitter(run.id);
        runEmitter.emit("done", { status: finalStatus, outputs: result.outputs, durationMs: result.durationMs });
        setTimeout(() => runEmitter.removeAllListeners(), 5000);

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
        const runEmitter = getRunEmitter(run.id);
        runEmitter.emit("error", { message: err.message });
        setTimeout(() => runEmitter.removeAllListeners(), 5000);
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

      const graph = normalizeGraph(pipeline.graph);
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
      return { errors: validateGraph(normalizeGraph(input.graph)) };
    }),

  simulate: protectedProcedure
    .input(z.object({ graph: graphSchema }))
    .query(async ({ input }) => {
      const result = engine.simulate(normalizeGraph(input.graph));
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

  cancelRun: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const run = await ctx.prisma.pipelineRun.findUnique({
        where: { id: input.runId },
      });
      if (!run) throw new TRPCError({ code: "NOT_FOUND" });
      if (run.status !== "RUNNING" && run.status !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Run is not active" });
      }
      await ctx.prisma.pipelineRun.update({
        where: { id: input.runId },
        data: { status: "CANCELLED", completedAt: new Date() },
      });
      return { success: true };
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
