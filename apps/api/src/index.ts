import "dotenv/config";
import * as Sentry from "@sentry/node";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { collectDefaultMetrics, register } from "prom-client";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter } from "./routers";
import { createContext } from "./middleware/context";
import { prisma } from "@flowmind/db";
import { BillingService } from "@flowmind/billing";
import {
  toolRegistry,
  createReadTool,
  createWriteTool,
  createEditTool,
  createGrepTool,
  createGlobTool,
  createBashTool,
  createWebFetchTool,
  createWebSearchTool,
  createApplyPatchTool,
  createTodoWriteTool,
} from "@flowmind/tool-system";

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  environment: process.env.NODE_ENV || "development",
  integrations: [Sentry.fastifyIntegration()],
  tracesSampleRate: 1.0,
});

const PORT = parseInt(process.env.API_PORT || "3001", 10);
const HOST = process.env.API_HOST || "0.0.0.0";

async function main() {
  const server = Fastify({
    maxParamLength: 5000,
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport: {
        target: "pino-pretty",
        options: { colorize: true },
      },
    },
  });

  await server.register(cors, {
    origin: (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
      const allowed = [process.env.APP_URL, "http://localhost:3000", "http://localhost:4000"].filter(Boolean) as string[]
      if (!origin || allowed.some((a) => origin.startsWith(a))) {
        cb(null, true)
      } else {
        cb(null, false)
      }
    },
    credentials: true,
  });

  await server.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || "200", 10),
    timeWindow: process.env.RATE_LIMIT_WINDOW || "1 minute",
    keyGenerator: (req) => {
      const userId = (req as any).userId;
      if (userId) return `user:${userId}`;
      return req.ip;
    },
  });

  await server.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: { router: appRouter, createContext },
  });

  collectDefaultMetrics();

  server.get("/health", async () => {
    const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    return { status: dbOk ? "ok" : "degraded", version: "0.1.0", uptime: process.uptime(), db: dbOk };
  });

  server.get("/metrics", async (_req, reply) => {
    reply.header("content-type", register.contentType);
    return register.metrics();
  });

  server.post<{ Body: { name: string; description: string; userId: string } }>("/api/internal/create-pipeline", async (req, reply) => {
    const { name, description, userId } = req.body;
    if (!name || !userId) return reply.status(400).send({ error: "name and userId required" });

    const graph = {
      nodes: [
        { id: "trigger-1", type: "manualTrigger", label: "Manual Trigger", position: { x: 250, y: 0 }, config: {} },
        { id: "ai-1", type: "aiAgent", label: name, position: { x: 250, y: 200 }, config: { prompt: description } },
      ],
      edges: [{ id: "e-trigger-ai", source: "trigger-1", target: "ai-1", sourceHandle: null, targetHandle: null, label: null }],
    };

    const pipeline = await prisma.pipeline.create({
      data: { userId, name, description, graph: graph as any, isActive: false, status: "DRAFT" },
    });
    return reply.send(pipeline);
  });

  // Register built-in tools
  const toolInfos = [
    createReadTool(),
    createWriteTool(),
    createEditTool(),
    createGrepTool(),
    createGlobTool(),
    createBashTool(),
    createWebFetchTool(),
    createWebSearchTool(),
    createApplyPatchTool(),
    createTodoWriteTool(),
  ];
  for (const t of toolInfos) {
    toolRegistry.register(t);
  }
  server.log.info(`Registered ${toolInfos.length} built-in tools for agent execution`);

  // Internal endpoint for Python agent runtime to execute tools
  server.post<{ Body: { toolId: string; args: Record<string, unknown> } }>(
    "/api/internal/execute-tool",
    async (req, reply) => {
      const { toolId, args } = req.body;
      if (!toolId) return reply.status(400).send({ error: "toolId required" });
      const tool = toolRegistry.get(toolId);
      if (!tool) return reply.status(404).send({ error: `Tool '${toolId}' not found` });
      try {
        const result = await tool.execute(args, {
          sessionId: `internal_${Date.now()}`,
          messageId: `msg_${Date.now()}`,
          agent: "system",
          async ask() {},
          metadata() {},
        });
        return reply.send(result);
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    },
  );

  await server.register(async (scoped) => {
    scoped.addContentTypeParser("application/json", { parseAs: "buffer", bodyLimit: 65536 }, (_req, body, done) => {
      done(null, body);
    });
    scoped.post("/api/stripe/webhook", async (req, reply) => {
      const signature = req.headers["stripe-signature"] as string;
      const rawBody = (req.body as Buffer).toString();

      if (!signature || !rawBody) {
        return reply.status(400).send({ error: "Missing stripe-signature header or body" });
      }

      try {
        await BillingService.handleStripeWebhook(rawBody, signature);
        return reply.send({ received: true });
      } catch (err) {
        req.log.error(err, "Stripe webhook handling failed");
        return reply.status(400).send({ error: "Webhook signature verification failed" });
      }
    });
  });

  try {
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`FlowMind API running on http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
