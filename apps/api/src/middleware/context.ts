import { inferAsyncReturnType } from "@trpc/server";
import { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { prisma } from "@flowmind/db";
import jwt from "jsonwebtoken";
import { verifyHostClientToken } from "../services/host-auth";
import { JWT_SECRET } from "../lib/jwt-secret";
import { logger } from "../infrastructure";

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
      } catch (err) {
        // A token that is neither a host token nor a valid JWT means an unauthenticated
        // request, which is a routine outcome rather than a fault. Debug level only:
        // logging rejected tokens at warn would let an unauthenticated client flood
        // the log, and the token itself is never included.
        logger.debug({ err, requestId: req.id }, "bearer token rejected; treating request as unauthenticated")
      }
    }
  }

  return {
    prisma,
    userId,
    hostClient,
    requestId: req.id,
    req,
    res,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
