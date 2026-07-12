import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter } from "./routers";
import { createContext } from "./middleware/context";
import { prisma } from "@flowmind/db";

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
    max: 100,
    timeWindow: "1 minute",
  });

  await server.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: { router: appRouter, createContext },
  });

  server.get("/health", async () => ({ status: "ok", version: "0.1.0" }));

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

  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`FlowMind API running on http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
