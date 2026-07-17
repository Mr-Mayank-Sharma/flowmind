import { inferAsyncReturnType } from "@trpc/server";
import { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { prisma } from "@flowmind/db";
import jwt from "jsonwebtoken";

const JWT_SECRET: string = ((): string => {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  console.warn("WARNING: JWT_SECRET not set, using insecure fallback for development only");
  return "dev-secret-change-in-production";
})();

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  const authHeader = req.headers.authorization;
  let userId: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, JWT_SECRET) as unknown as { userId: string };
      userId = payload.userId;
    } catch {
    }
  }

  return {
    prisma,
    userId,
    req,
    res,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
