import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../middleware/trpc";
import { BillingService } from "@flowmind/billing";
import { Tier } from "@flowmind/shared";

export const billingRouter = router({
  getSubscription: protectedProcedure
    .query(async ({ ctx }) => {
      const sub = await ctx.prisma.subscription.findUnique({
        where: { userId: ctx.userId },
      });
      if (!sub) {
        return { tier: "FREE", status: "active", currentPeriodEnd: null };
      }
      return sub;
    }),

  createCheckout: protectedProcedure
    .input(z.object({ tier: z.enum(["PRO", "TEAM"]) }))
    .mutation(async ({ input, ctx }) => {
      if (!process.env.STRIPE_SECRET_KEY) {
        await ctx.prisma.subscription.upsert({
          where: { userId: ctx.userId },
          update: { tier: input.tier },
          create: { userId: ctx.userId, tier: input.tier },
        });
        return { url: "/settings/billing?success=1", mock: true };
      }

      const url = await BillingService.createCheckoutSession({
        userId: ctx.userId,
        tier: input.tier as Tier,
      });
      return { url, mock: false };
    }),

  createPortalSession: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (!process.env.STRIPE_SECRET_KEY) {
        return { url: "/settings/billing" };
      }

      const url = await BillingService.createPortalSession(ctx.userId);
      return { url };
    }),

  getUsage: protectedProcedure
    .query(async ({ ctx }) => {
      return BillingService.getUsageMetrics(ctx.userId);
    }),

  getInvoices: protectedProcedure
    .query(async ({ ctx }) => {
      return BillingService.getInvoices(ctx.userId);
    }),
});
