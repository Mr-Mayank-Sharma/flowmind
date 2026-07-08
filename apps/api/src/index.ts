import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter } from "./routers";
import { createContext } from "./middleware/context";

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

  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`FlowMind API running on http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
