import { inferAsyncReturnType } from "@trpc/server";
import { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { prisma } from "@flowmind/db";
import jwt from "jsonwebtoken";
import { verifyHostClientToken } from "../services/host-auth";
import { JWT_SECRET } from "../lib/jwt-secret";

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  const authHeader = req.headers.authorization;
  let userId: string | null = null;
  let hostClient: { clientId: string; groupId: string; email: string } | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);

    const hostPayload = verifyHostClientToken(token);
    if (hostPayload) {
      hostClient = {
        clientId: hostPayload.clientId,
        groupId: hostPayload.groupId,
        email: hostPayload.email,
      };
    } else {
      try {
        const payload = jwt.verify(token, JWT_SECRET) as unknown as { userId: string };
        userId = payload.userId;
        (req as any).userId = payload.userId;
      } catch {
      }
    }
  }

  return {
    prisma,
    userId,
    hostClient,
    req,
    res,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
