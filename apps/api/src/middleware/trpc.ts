import { z } from "zod";
import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "../middleware/context";
import { prisma } from "@flowmind/db";
import { getTierConfig } from "@flowmind/billing/tiers";
import { Tier } from "@flowmind/shared";

const t = initTRPC.context<Context>().create();

const requestCounts = new Map<string, { count: number; resetAt: number }>();

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

const enforceRateLimit = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) return next({ ctx });

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { tier: true },
  });

  if (!user) return next({ ctx });

  const tierConfig = getTierConfig(user.tier as unknown as Tier);
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests = user.tier === Tier.FREE ? 60 : user.tier === Tier.PRO ? 200 : 500;

  const key = `${ctx.userId}`;
  const entry = requestCounts.get(key);

  if (!entry || entry.resetAt < now) {
    requestCounts.set(key, { count: 1, resetAt: now + windowMs });
    return next({ ctx });
  }

  entry.count++;
  if (entry.count > maxRequests) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. ${tierConfig.name} tier allows ${maxRequests} requests/minute.`,
    });
  }

  return next({ ctx });
});

const enforceUsageLimits = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) return next({ ctx });

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { tier: true },
  });

  if (!user) return next({ ctx });

  const tierConfig = getTierConfig(user.tier as unknown as Tier);

  if (tierConfig.features.chatsPerMonth !== "unlimited") {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sessionCount = await prisma.session.count({
      where: { userId: ctx.userId, createdAt: { gte: thirtyDaysAgo } },
    });

    if (sessionCount >= tierConfig.features.chatsPerMonth) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Chat limit reached for ${tierConfig.name} tier (${tierConfig.features.chatsPerMonth}/month). Upgrade your plan.`,
      });
    }
  }

  if (tierConfig.features.pipelineNodes !== "unlimited") {
    const pipelineCount = await prisma.pipeline.count({ where: { userId: ctx.userId } });
    if (pipelineCount >= 100) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Pipeline limit reached. Upgrade for more.`,
      });
    }
  }

  return next({ ctx });
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed).use(enforceRateLimit).use(enforceUsageLimits);
