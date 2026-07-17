import "dotenv/config";
import * as Sentry from "@sentry/node";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
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
import type { AgentLoopStep } from "@flowmind/llm-router";
import { getSessionEmitter } from "./services/session-emitters";
import { getRunEmitter } from "./services/run-emitters";

const SENTRY_DSN = process.env.SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    integrations: [Sentry.fastifyIntegration()],
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
  });
}

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

  await server.register(helmet, {
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", process.env.APP_URL || "http://localhost:4000"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    } : false,
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

  server.setErrorHandler((err, _req, reply) => {
    if (SENTRY_DSN) {
      Sentry.captureException(err);
    }
    server.log.error({ err }, err.message || "Unhandled error");
    const statusCode = err.statusCode ?? 500;
    reply.status(statusCode).send({
      error: statusCode >= 500 ? "Internal server error" : err.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
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

  server.get("/health", async (_req, reply) => {
    const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    const runtimeOk = await fetch(`${process.env.AGENT_RUNTIME_URL || "http://localhost:8001"}/health`)
      .then(r => r.ok).catch(() => false);
    const status = dbOk ? "ok" : "degraded";
    reply.code(dbOk ? 200 : 503);
    return {
      status,
      version: "0.1.0",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: { database: dbOk, agentRuntime: runtimeOk },
    };
  });

  server.get("/metrics", async (_req, reply) => {
    reply.header("content-type", register.contentType);
    return register.metrics();
  });

  server.get<{ Params: { sessionId: string } }>("/api/chat/stream/:sessionId", async (req, reply) => {
    const { sessionId } = req.params
    const token = (req.query as any)?.token || req.headers.authorization?.replace("Bearer ", "")

    if (!token) {
      return reply.status(401).send({ error: "Authentication required" })
    }

    let userId: string | null = null
    try {
      const jwt = await import("jsonwebtoken")
      const payload = jwt.default.verify(token, process.env.JWT_SECRET || "dev-secret-change-in-production") as { userId: string }
      userId = payload.userId
    } catch {
      return reply.status(401).send({ error: "Invalid token" })
    }

    const session = await prisma.session.findUnique({ where: { id: sessionId } })
    if (!session || session.userId !== userId) {
      return reply.status(404).send({ error: "Session not found" })
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    })

    const emitter = getSessionEmitter(sessionId)
    const heartbeat = setInterval(() => {
      reply.raw.write(": heartbeat\n\n")
    }, 15000)

    const onStep = (step: AgentLoopStep) => {
      const data = JSON.stringify(step)
      reply.raw.write(`data: ${data}\n\n`)
    }

    const onDone = (result: { reply: string; steps: AgentLoopStep[]; iterations: number }) => {
      const data = JSON.stringify({ type: "done", ...result })
      reply.raw.write(`data: ${data}\n\n`)
      reply.raw.write("data: [DONE]\n\n")
      cleanup()
    }

    const onError = (error: Error) => {
      const data = JSON.stringify({ type: "error", message: error.message })
      reply.raw.write(`data: ${data}\n\n`)
      reply.raw.write("data: [DONE]\n\n")
      cleanup()
    }

    function cleanup() {
      clearInterval(heartbeat)
      emitter.off("step", onStep)
      emitter.off("done", onDone)
      emitter.off("error", onError)
      emitter.off("close", cleanup)
      reply.raw.end()
    }

    emitter.on("step", onStep)
    emitter.on("done", onDone)
    emitter.on("error", onError)
    emitter.on("close", cleanup)

    req.raw.on("close", cleanup)
  })

  server.get<{ Params: { runId: string } }>("/api/pipeline/stream/:runId", async (req, reply) => {
    const { runId } = req.params
    const token = (req.query as any)?.token || req.headers.authorization?.replace("Bearer ", "")

    if (!token) {
      return reply.status(401).send({ error: "Authentication required" })
    }

    let userId: string | null = null
    try {
      const jwt = await import("jsonwebtoken")
      const payload = jwt.default.verify(token, process.env.JWT_SECRET || "dev-secret-change-in-production") as { userId: string }
      userId = payload.userId
    } catch {
      return reply.status(401).send({ error: "Invalid token" })
    }

    const run = await prisma.pipelineRun.findUnique({ where: { id: runId }, include: { pipeline: true } })
    if (!run || run.pipeline.userId !== userId) {
      return reply.status(404).send({ error: "Run not found" })
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    })

    const emitter = getRunEmitter(runId)
    const heartbeat = setInterval(() => {
      reply.raw.write(": heartbeat\n\n")
    }, 15000)

    const onNode = (data: Record<string, unknown>) => {
      reply.raw.write(`data: ${JSON.stringify({ type: "node", ...data })}\n\n`)
    }

    const onDone = (data: Record<string, unknown>) => {
      reply.raw.write(`data: ${JSON.stringify({ type: "done", ...data })}\n\n`)
      reply.raw.write("data: [DONE]\n\n")
      cleanup()
    }

    const onError = (data: unknown) => {
      const msg = data && typeof data === "object" && "message" in data ? (data as { message: string }).message : "Unknown error"
      reply.raw.write(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`)
      reply.raw.write("data: [DONE]\n\n")
      cleanup()
    }

    function cleanup() {
      clearInterval(heartbeat)
      emitter.off("node", onNode)
      emitter.off("done", onDone)
      emitter.off("error", onError)
      reply.raw.end()
    }

    emitter.on("node", onNode)
    emitter.on("done", onDone)
    emitter.on("error", onError)

    req.raw.on("close", cleanup)
  })

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
