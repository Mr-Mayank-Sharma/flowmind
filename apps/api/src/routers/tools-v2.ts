import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../middleware/trpc";
import { toolRegistry } from "@flowmind/tool-system";
import { fromConfig, evaluate, type Action } from "@flowmind/permission";
import { lspManager } from "@flowmind/lsp";
import { SnapshotManager } from "@flowmind/snapshot";
import { SessionEngine } from "@flowmind/session-engine";
import { providerRegistry } from "@flowmind/provider-registry";
import { pluginEngine } from "@flowmind/plugin-engine";
import { createReadTool, createWriteTool, createEditTool, createGrepTool, createGlobTool, createBashTool, createWebFetchTool, createWebSearchTool, createApplyPatchTool, createTodoWriteTool } from "@flowmind/tool-system";

const sessionEngines = new Map<string, SessionEngine>();
const snapshotManagers = new Map<string, SnapshotManager>();

function getSessionEngine(sessionId: string): SessionEngine {
  if (!sessionEngines.has(sessionId)) {
    sessionEngines.set(sessionId, new SessionEngine());
  }
  return sessionEngines.get(sessionId)!;
}

function getSnapshotManager(userId: string): SnapshotManager {
  if (!snapshotManagers.has(userId)) {
    snapshotManagers.set(userId, new SnapshotManager(process.cwd()));
  }
  return snapshotManagers.get(userId)!;
}

export const toolsV2Router = router({

  // --- Tool Registry ---
  listTools: protectedProcedure
    .query(async () => {
      return toolRegistry.all().map((t) => ({
        id: t.id,
        description: t.description,
        parameters: t.parameters,
        jsonSchema: t.jsonSchema,
      }));
    }),

  getTool: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const tool = toolRegistry.get(input.id);
      if (!tool) throw new TRPCError({ code: "NOT_FOUND", message: "Tool not found" });
      return {
        id: tool.id,
        description: tool.description,
        parameters: tool.parameters,
        jsonSchema: tool.jsonSchema,
      };
    }),

  executeTool: protectedProcedure
    .input(z.object({
      toolId: z.string(),
      args: z.record(z.unknown()),
      sessionId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const tool = toolRegistry.get(input.toolId);
      if (!tool) throw new TRPCError({ code: "NOT_FOUND", message: `Tool ${input.toolId} not found` });

      const sessionId = input.sessionId ?? `session_${ctx.userId}_${Date.now()}`;
      const sessionEngine = getSessionEngine(sessionId);

      const result = await tool.execute(input.args, {
        sessionId,
        messageId: `msg_${Date.now()}`,
        agent: "user",
        async ask(permInput) {
          // In auto mode, allow all tools
          return;
        },
        metadata(m) {},
      });

      sessionEngine.addMessage({
        role: "assistant",
        content: result.output,
        toolCalls: [{ name: input.toolId, args: input.args, result: result.output }],
      });

      return result;
    }),

  // --- Permission System ---
  getPermissionRules: protectedProcedure
    .query(async () => {
      return {
        rules: [],
        evaluated: fromConfig({}),
      };
    }),

  updatePermissionRules: protectedProcedure
    .input(z.object({
      rules: z.array(z.object({
        permission: z.string(),
        pattern: z.string(),
        action: z.enum(["allow", "deny", "ask"]),
      })),
    }))
    .mutation(async ({ input }) => {
      return { success: true, rules: input.rules };
    }),

  evaluatePermission: protectedProcedure
    .input(z.object({
      permission: z.string(),
      pattern: z.string(),
    }))
    .query(async ({ input }) => {
      return evaluate(input.permission, input.pattern);
    }),

  // --- LSP Integration ---
  lspOpenFile: protectedProcedure
    .input(z.object({ filePath: z.string() }))
    .mutation(async ({ input }) => {
      await lspManager.openFile(input.filePath);
      return { success: true };
    }),

  lspGoToDefinition: protectedProcedure
    .input(z.object({ filePath: z.string(), line: z.number(), column: z.number() }))
    .query(async ({ input }) => {
      return lspManager.goToDefinition(input.filePath, input.line, input.column);
    }),

  lspFindReferences: protectedProcedure
    .input(z.object({ filePath: z.string(), line: z.number(), column: z.number() }))
    .query(async ({ input }) => {
      return lspManager.findReferences(input.filePath, input.line, input.column);
    }),

  lspGetHover: protectedProcedure
    .input(z.object({ filePath: z.string(), line: z.number(), column: z.number() }))
    .query(async ({ input }) => {
      return lspManager.getHover(input.filePath, input.line, input.column);
    }),

  // --- Snapshot System ---
  snapshotCreate: protectedProcedure
    .input(z.object({ filePath: z.string(), description: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const sm = getSnapshotManager(ctx.userId!);
      const id = await sm.track(input.filePath, input.description);
      return { id };
    }),

  snapshotRevert: protectedProcedure
    .mutation(async ({ ctx }) => {
      const sm = getSnapshotManager(ctx.userId!);
      await sm.revert();
      return { success: true };
    }),

  snapshotRestore: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const sm = getSnapshotManager(ctx.userId!);
      await sm.restore(input.id);
      return { success: true };
    }),

  snapshotDiff: protectedProcedure
    .input(z.object({ filePath: z.string() }))
    .query(async ({ input, ctx }) => {
      const sm = getSnapshotManager(ctx.userId!);
      return sm.diff(input.filePath);
    }),

  snapshotHistory: protectedProcedure
    .input(z.object({ filePath: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const sm = getSnapshotManager(ctx.userId!);
      return sm.getHistory(input.filePath);
    }),

  // --- Session Engine ---
  sessionCompact: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      const engine = getSessionEngine(input.sessionId);
      const result = await engine.compact();
      return result;
    }),

  sessionGetMessages: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const engine = getSessionEngine(input.sessionId);
      return engine.getMessages();
    }),

  sessionEstimateTokens: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const engine = getSessionEngine(input.sessionId);
      return { tokens: engine.estimateTokens() };
    }),

  sessionClear: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      const engine = getSessionEngine(input.sessionId);
      engine.clear();
      return { success: true };
    }),

  // --- Provider Registry ---
  listProviders: protectedProcedure
    .query(async () => {
      return providerRegistry.getProviders().map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        authType: p.authType,
        website: p.website,
        modelCount: p.models.length,
      }));
    }),

  listModels: protectedProcedure
    .input(z.object({ providerId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return providerRegistry.getModels(input?.providerId);
    }),

  searchModels: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      return providerRegistry.searchModels(input.query);
    }),

  getModel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const model = providerRegistry.getModel(input.id);
      if (!model) throw new TRPCError({ code: "NOT_FOUND" });
      return model;
    }),

  setProviderKey: protectedProcedure
    .input(z.object({ providerId: z.string(), apiKey: z.string() }))
    .mutation(async ({ input }) => {
      providerRegistry.setApiKey(input.providerId, input.apiKey);
      return { success: true };
    }),

  // --- Plugin Engine ---
  listPlugins: protectedProcedure
    .query(async () => {
      return pluginEngine.getPlugins().map((p) => ({
        name: p.name,
        description: p.description,
        toolCount: Object.keys(p.tool ?? {}).length,
      }));
    }),

  loadPluginDir: protectedProcedure
    .input(z.object({ dir: z.string() }))
    .mutation(async ({ input }) => {
      await pluginEngine.loadFromDir(input.dir);
      return { success: true };
    }),

  // --- Todo System ---
  updateTodos: protectedProcedure
    .input(z.object({
      todos: z.array(z.object({
        content: z.string(),
        status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
        priority: z.enum(["high", "medium", "low"]),
      })),
    }))
    .mutation(async ({ input }) => {
      const todoTool = createTodoWriteTool();
      const toolDef = todoTool.init();
      const result = await toolDef.execute({ todos: input.todos }, {
        sessionId: "api",
        messageId: `msg_${Date.now()}`,
        agent: "user",
        async ask() {},
        metadata() {},
      });
      return result;
    }),
});

export type ToolsV2Router = typeof toolsV2Router;
