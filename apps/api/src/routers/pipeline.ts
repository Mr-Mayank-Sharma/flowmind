import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../middleware/trpc";
import { prisma } from "@flowmind/db";
import { PipelineEngine } from "@flowmind/pipeline-engine";
import type { LLMProvider, PipelineGraph, WorkflowSettings, ApprovalDecision } from "@flowmind/pipeline-engine";
import { buildLLMProvider, normalizeGraph } from "../lib/llm-factory";
import { getRunEmitter, cleanupRunEmitter } from "../services/run-emitters";
import { getContextEngine } from "../services/context-engine";
import { userGroupRoles } from "../services/group-access";
import { registerActiveRun, unregisterActiveRun, getActiveRunController } from "../services/active-runs";

function getLLM(): LLMProvider | undefined {
  return buildLLMProvider();
}

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

interface ExecuteRunParams {
  runId: string;
  pipelineId: string;
  groupId: string | null;
  userId: string;
  graph: PipelineGraph;
  input: Record<string, unknown>;
  settings?: WorkflowSettings;
  controller: AbortController;
  approvalOverrides?: Record<string, ApprovalDecision>;
}

type PendingLog = { runId: string; nodeId: string; nodeType: string; input: any; output: any; error?: string; duration: number };

async function executeRunBackground(params: ExecuteRunParams): Promise<void> {
  const runEmitter = getRunEmitter(params.runId);
  const pendingLogs = new Map<string, PendingLog>();
  const flushedLogs = new Set<string>();

  const flushLog = async (entry: PendingLog) => {
    if (flushedLogs.has(entry.nodeId)) return;
    flushedLogs.add(entry.nodeId);
    try {
      await prisma.runLog.createMany({ data: [entry] });
    } catch (err) {
      console.error("Failed to persist run log:", err);
    }
  };

  const ragSearch = async (q: { text: string; topK?: number; filters?: Record<string, unknown> }) => {
    if (params.groupId) {
      return getContextEngine().search({
        text: q.text,
        userId: `group:${params.groupId}`,
        groupId: params.groupId,
        topK: q.topK ?? 5,
        filters: q.filters,
      });
    }
    return getContextEngine().search({ text: q.text, userId: params.userId, topK: q.topK ?? 5, filters: q.filters });
  };

  const engineWithStatus = new PipelineEngine({
    llm: getLLM(),
    ragSearch,
    requestApproval: async () => {
      // No interactive approval channel wired to the run yet: pause the run.
      return { approved: false, note: "Run paused awaiting manual approval" };
    },
    onNodeStatus: async (event) => {
      const emitter = getRunEmitter(params.runId);
      emitter.emit("node", {
        nodeId: event.nodeId,
        nodeType: event.nodeType,
        status: event.status,
        error: event.error,
        durationMs: event.durationMs,
      });

      if (event.status === "running") {
        pendingLogs.set(event.nodeId, {
          runId: params.runId, nodeId: event.nodeId, nodeType: event.nodeType,
          input: {}, output: {}, duration: 0,
        });
      } else if (event.status === "completed" || event.status === "failed") {
        const existing = pendingLogs.get(event.nodeId);
        const entry: PendingLog = {
          runId: params.runId,
          nodeId: event.nodeId,
          nodeType: event.nodeType,
          input: existing?.input ?? {},
          output: event.error ? { error: event.error } : (event.output ?? {}),
          error: event.error,
          duration: event.durationMs ?? 0,
        };
        pendingLogs.set(event.nodeId, entry);
        await flushLog(entry);
      }
    },
  });

  try {
    const result = await engineWithStatus.execute(
      params.runId,
      params.pipelineId,
      params.graph,
      params.input,
      params.settings,
      params.controller.signal,
    );

    // Flush any logs for nodes that never reached a terminal event
    for (const entry of pendingLogs.values()) {
      await flushLog(entry);
    }
    pendingLogs.clear();

    // Check if run was cancelled mid-execution
    const afterRun = await prisma.pipelineRun.findUnique({ where: { id: params.runId }, select: { status: true } });
    if (afterRun?.status === "CANCELLED" || result.status === "cancelled") {
      await prisma.pipelineRun.update({
        where: { id: params.runId },
        data: { status: "CANCELLED", completedAt: new Date() },
      });
      return;
    }

    const finalStatus = result.status === "success" ? "SUCCESS" as const : result.status === "awaiting_approval" ? "AWAITING_APPROVAL" as const : "FAILED" as const;

    await prisma.pipelineRun.update({
      where: { id: params.runId },
      data: {
        status: finalStatus,
        output: result as any,
        completedAt: new Date(),
      },
    });

    runEmitter.emit("done", { status: finalStatus, outputs: result.outputs, durationMs: result.durationMs });

    await prisma.pipeline.update({
      where: { id: params.pipelineId },
      data: {
        runCount: { increment: 1 },
        lastRunAt: new Date(),
        avgDurationMs: result.durationMs,
      },
    });
  } catch (err: any) {
    for (const entry of pendingLogs.values()) {
      await flushLog({ ...entry, error: entry.error ?? "Node did not complete" });
    }
    pendingLogs.clear();
    await prisma.pipelineRun.update({
      where: { id: params.runId },
      data: { status: "FAILED", output: { error: err.message }, completedAt: new Date() },
    });
    runEmitter.emit("error", { message: err.message });
    console.error(`Pipeline run ${params.runId} failed:`, err);
  } finally {
    unregisterActiveRun(params.runId);
    setTimeout(() => cleanupRunEmitter(params.runId), 60_000).unref?.();
  }
}

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
          userId: ctx.userId!,
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

      const updateData: Record<string, unknown> = {};
      if (input.name) updateData.name = input.name;
      if (input.description) updateData.description = input.description;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      if (input.graph) {
        const currentVersion = pipeline.version;
        const versionHistory = (pipeline.versionHistory as any[]) ?? [];

        versionHistory.push({
          version: currentVersion,
          graph: pipeline.graph,
          name: pipeline.name,
          description: pipeline.description,
          savedAt: pipeline.updatedAt.toISOString(),
          savedBy: ctx.userId,
        });

        if (versionHistory.length > 50) {
          versionHistory.splice(0, versionHistory.length - 50);
        }

        updateData.graph = input.graph;
        updateData.version = { increment: 1 };
        updateData.versionHistory = versionHistory;
      }

      return ctx.prisma.pipeline.update({
        where: { id: input.id },
        data: updateData,
      });
    }),

  getVersionHistory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const pipeline = await ctx.prisma.pipeline.findUnique({
        where: { id: input.id },
        select: { userId: true, version: true, versionHistory: true },
      });
      if (!pipeline || pipeline.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const history = (pipeline.versionHistory as any[]) ?? [];
      return {
        currentVersion: pipeline.version,
        versions: history.map((v: any) => ({
          version: v.version,
          name: v.name,
          description: v.description,
          savedAt: v.savedAt,
          savedBy: v.savedBy,
        })),
      };
    }),

  restoreVersion: protectedProcedure
    .input(z.object({ id: z.string(), version: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const pipeline = await ctx.prisma.pipeline.findUnique({
        where: { id: input.id },
      });
      if (!pipeline || pipeline.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const history = (pipeline.versionHistory as any[]) ?? [];
      const targetVersion = history.find((v: any) => v.version === input.version);
      if (!targetVersion) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
      }

      const currentVersion = pipeline.version;
      const currentHistory = history.filter((v: any) => v.version !== input.version);

      currentHistory.push({
        version: currentVersion,
        graph: pipeline.graph,
        name: pipeline.name,
        description: pipeline.description,
        savedAt: pipeline.updatedAt.toISOString(),
        savedBy: ctx.userId,
      });

      return ctx.prisma.pipeline.update({
        where: { id: input.id },
        data: {
          graph: targetVersion.graph,
          name: targetVersion.name ?? pipeline.name,
          description: targetVersion.description ?? pipeline.description,
          version: { increment: 1 },
          versionHistory: currentHistory,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const pipeline = await ctx.prisma.pipeline.findUnique({
        where: { id: input.id },
        select: { id: true, userId: true },
      });
      if (!pipeline || pipeline.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.prisma.$transaction(async (tx) => {
        const flows = await tx.marketplaceFlow.findMany({
          where: { pipelineId: input.id },
          select: { id: true },
        });
        const flowIds = flows.map((f) => f.id);

        if (flowIds.length > 0) {
          await tx.flowClone.deleteMany({ where: { sourceFlowId: { in: flowIds } } });
          await tx.flowExecution.deleteMany({ where: { flowId: { in: flowIds } } });
          await tx.marketplaceFlow.deleteMany({ where: { pipelineId: input.id } });
        }

        await tx.pipelineRun.deleteMany({ where: { pipelineId: input.id } });
        await tx.pipeline.delete({ where: { id: input.id } });
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
      const memberOf = pipeline?.groupId ? (await userGroupRoles(ctx.userId!)).has(pipeline.groupId) : false;
      if (!pipeline || (pipeline.userId !== ctx.userId && !memberOf)) {
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

      const runEmitter = getRunEmitter(run.id);
      runEmitter.clearBuffer();

      const abortController = new AbortController();
      registerActiveRun(run.id, abortController);

      void executeRunBackground({
        runId: run.id,
        pipelineId: input.id,
        groupId: pipeline.groupId,
        userId: ctx.userId!,
        graph: normalizeGraph(pipeline.graph),
        input: input.input ?? {},
        settings: input.settings,
        controller: abortController,
      });

      return { runId: run.id, status: "RUNNING" as const, outputs: [], durationMs: 0 };
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
      const nodeOutput = await new PipelineEngine({ llm: getLLM() }).executeSingleNode(
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
      const result = new PipelineEngine({ llm: getLLM() }).simulate(normalizeGraph(input.graph));
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
      return new PipelineEngine({ llm: getLLM() }).loadOptions(input.nodeType, input.field, input.config ?? {}, input.filter);
    }),

  getRuns: protectedProcedure
    .input(z.object({ pipelineId: z.string(), cursor: z.string().optional(), limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ input, ctx }) => {
      const pipeline = await ctx.prisma.pipeline.findFirst({
        where: { id: input.pipelineId, userId: ctx.userId },
        select: { id: true },
      });
      if (!pipeline) throw new TRPCError({ code: "NOT_FOUND" });
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
        include: { pipeline: { select: { userId: true } } },
      });
      if (!run || run.pipeline.userId !== ctx.userId) throw new TRPCError({ code: "NOT_FOUND" });
      if (run.status !== "RUNNING" && run.status !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Run is not active" });
      }
      await ctx.prisma.pipelineRun.update({
        where: { id: input.runId },
        data: { status: "CANCELLED", completedAt: new Date() },
      });
      const controller = getActiveRunController(input.runId);
      if (controller) {
        controller.abort();
        unregisterActiveRun(input.runId);
      }
      const emitter = getRunEmitter(input.runId);
      emitter.emit("done", { status: "CANCELLED" });
      return { success: true, runId: input.runId, status: "CANCELLED" as const };
    }),

  resume: protectedProcedure
    .input(z.object({
      runId: z.string(),
      decisions: z.array(z.object({
        nodeId: z.string(),
        approved: z.boolean(),
        note: z.string().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const paused = await ctx.prisma.pipelineRun.findUnique({
        where: { id: input.runId },
        include: { pipeline: true },
      });
      if (!paused || paused.pipeline.userId !== ctx.userId) throw new TRPCError({ code: "NOT_FOUND" });
      if (paused.status !== "AWAITING_APPROVAL") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Run is not awaiting approval" });
      }

      const approvalOverrides: Record<string, { approved: boolean; note?: string }> = {};
      for (const d of input.decisions) approvalOverrides[d.nodeId] = { approved: d.approved, note: d.note };

      const resumeRun = await ctx.prisma.pipelineRun.create({
        data: {
          pipelineId: paused.pipelineId,
          status: "RUNNING",
          input: (paused.input ?? {}) as any,
          startedAt: new Date(),
        },
      });
      const runEmitter = getRunEmitter(resumeRun.id);
      runEmitter.clearBuffer();

      const abortController = new AbortController();
      registerActiveRun(resumeRun.id, abortController);

      try {
        const graph = normalizeGraph(paused.pipeline.graph);
        const engineWithStatus = new PipelineEngine({ llm: getLLM(), approvalOverrides });
        const result = await engineWithStatus.execute(resumeRun.id, paused.pipelineId, graph, paused.input ?? {}, undefined, abortController.signal);

        const finalStatus = result.status === "success" ? "SUCCESS" as const : result.status === "awaiting_approval" ? "AWAITING_APPROVAL" as const : "FAILED" as const;
        await ctx.prisma.pipelineRun.update({
          where: { id: resumeRun.id },
          data: { status: finalStatus, output: result as any, completedAt: new Date() },
        });
        runEmitter.emit("done", { status: finalStatus, outputs: result.outputs, durationMs: result.durationMs });
        setTimeout(() => cleanupRunEmitter(resumeRun.id), 60_000).unref?.();
        return { runId: resumeRun.id, status: finalStatus, outputs: result.outputs, durationMs: result.durationMs };
      } catch (err: any) {
        await ctx.prisma.pipelineRun.update({
          where: { id: resumeRun.id },
          data: { status: "FAILED", output: { error: err.message }, completedAt: new Date() },
        });
        runEmitter.emit("error", { message: err.message });
        setTimeout(() => cleanupRunEmitter(resumeRun.id), 60_000).unref?.();
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message ?? "Pipeline resume failed" });
      } finally {
        unregisterActiveRun(resumeRun.id);
      }
    }),

  getRunLogs: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ input, ctx }) => {
      const run = await ctx.prisma.pipelineRun.findUnique({
        where: { id: input.runId },
        include: { pipeline: { select: { userId: true } } },
      });
      if (!run || run.pipeline.userId !== ctx.userId) throw new TRPCError({ code: "NOT_FOUND" });
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
          creatorId: ctx.userId!,
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
          userId: ctx.userId!,
          name: `${marketFlow.title} (clone)`,
          description: marketFlow.description,
          graph: marketFlow.pipeline.graph as any,
        },
      });

      await ctx.prisma.flowClone.create({
        data: {
          sourceFlowId: input.marketplaceId,
          clonePipelineId: clonedPipeline.id,
          userId: ctx.userId!,
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

  exportPipeline: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const pipeline = await ctx.prisma.pipeline.findUnique({
        where: { id: input.id },
      });
      if (!pipeline || pipeline.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const exportData = {
        format: "flowmind",
        version: "1.0",
        exportedAt: new Date().toISOString(),
        pipeline: {
          name: pipeline.name,
          description: pipeline.description,
          graph: pipeline.graph,
          tags: pipeline.tags,
          category: pipeline.category,
        },
      };

      return {
        data: JSON.stringify(exportData, null, 2),
        filename: `${pipeline.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-export.json`,
      };
    }),

  importPipeline: protectedProcedure
    .input(z.object({
      data: z.string(),
      name: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      let parsed: any;
      try {
        parsed = JSON.parse(input.data);
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid JSON data" });
      }

      if (parsed.format === "flowmind") {
        const pipelineData = parsed.pipeline;
        if (!pipelineData?.graph?.nodes) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid FlowMind export format" });
        }

        return ctx.prisma.pipeline.create({
          data: {
            userId: ctx.userId!,
            name: input.name ?? pipelineData.name ?? "Imported Pipeline",
            description: pipelineData.description,
            graph: pipelineData.graph,
            tags: pipelineData.tags ?? [],
            category: pipelineData.category,
          },
        });
      }

      if (parsed.nodes && parsed.edges) {
        return ctx.prisma.pipeline.create({
          data: {
            userId: ctx.userId!,
            name: input.name ?? "Imported Pipeline",
            graph: { nodes: parsed.nodes, edges: parsed.edges },
          },
        });
      }

      if (parsed.name && (parsed.graph || parsed.nodes)) {
        return ctx.prisma.pipeline.create({
          data: {
            userId: ctx.userId!,
            name: input.name ?? parsed.name,
            description: parsed.description,
            graph: parsed.graph ?? { nodes: parsed.nodes ?? [], edges: parsed.edges ?? [] },
            tags: parsed.tags ?? [],
          },
        });
      }

      throw new TRPCError({ code: "BAD_REQUEST", message: "Unrecognized pipeline format" });
    }),

  batchTrigger: protectedProcedure
    .input(z.object({
      id: z.string(),
      inputs: z.array(z.record(z.unknown())).max(100),
      settings: workflowSettingsSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const pipeline = await ctx.prisma.pipeline.findUnique({
        where: { id: input.id },
      });
      if (!pipeline || pipeline.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const results: Array<{ index: number; runId: string; status: string }> = [];
      const MAX_CONCURRENT = 4;
      let nextIndex = 0;

      const worker = async (): Promise<void> => {
        while (nextIndex < input.inputs.length) {
          const i = nextIndex++;
          const batchInput = input.inputs[i];
          const run = await ctx.prisma.pipelineRun.create({
            data: {
              pipelineId: input.id,
              status: "RUNNING",
              input: batchInput as any,
              startedAt: new Date(),
            },
          });

          results.push({ index: i, runId: run.id, status: "RUNNING" });
          const emitter = getRunEmitter(run.id);
          emitter.clearBuffer();
          const abortController = new AbortController();
          registerActiveRun(run.id, abortController);

          try {
            const rawGraph = pipeline.graph as any;
            const graph = normalizeGraph(rawGraph);
            const batchEngine = new PipelineEngine({ llm: getLLM() });
            const result = await batchEngine.execute(run.id, input.id, graph, batchInput, input.settings, abortController.signal);

            await ctx.prisma.pipelineRun.update({
              where: { id: run.id },
              data: {
                status: result.status === "success" ? "SUCCESS" : "FAILED",
                output: result as any,
                completedAt: new Date(),
              },
            });
            emitter.emit("done", { status: result.status === "success" ? "SUCCESS" : "FAILED", outputs: result.outputs, durationMs: result.durationMs });
          } catch (err: any) {
            try {
              await ctx.prisma.pipelineRun.update({
                where: { id: run.id },
                data: { status: "FAILED", output: { error: err.message }, completedAt: new Date() },
              });
            } catch (updateErr) {
              console.error("Failed to mark batch run failed:", updateErr);
            }
            emitter.emit("error", { message: err.message });
          } finally {
            unregisterActiveRun(run.id);
            setTimeout(() => cleanupRunEmitter(run.id), 60_000).unref?.();
          }
        }
      };

      const workers = Array.from({ length: Math.min(MAX_CONCURRENT, input.inputs.length) }, () => worker());
      await Promise.allSettled(workers);

      return {
        batchId: `batch-${Date.now()}`,
        totalInputs: input.inputs.length,
        runs: results,
      };
    }),

  getBatchStatus: protectedProcedure
    .input(z.object({ runIds: z.array(z.string()) }))
    .query(async ({ input, ctx }) => {
      const runs = await ctx.prisma.pipelineRun.findMany({
        where: {
          id: { in: input.runIds },
          pipeline: { userId: ctx.userId },
        },
        select: { id: true, status: true, input: true, output: true, startedAt: true, completedAt: true },
      });

      const total = runs.length;
      const completed = runs.filter(r => r.status === "SUCCESS" || r.status === "FAILED").length;
      const succeeded = runs.filter(r => r.status === "SUCCESS").length;
      const failed = runs.filter(r => r.status === "FAILED").length;

      return {
        total,
        completed,
        succeeded,
        failed,
        progress: total > 0 ? completed / total : 1,
        runs,
      };
    }),
});
