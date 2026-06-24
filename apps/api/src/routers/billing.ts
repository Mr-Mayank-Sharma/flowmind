import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../middleware/trpc";

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
      const user = await ctx.prisma.user.findUnique({ where: { id: ctx.userId } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      if (!process.env.STRIPE_SECRET_KEY) {
        await ctx.prisma.subscription.upsert({
          where: { userId: ctx.userId },
          update: { tier: input.tier },
          create: { userId: ctx.userId, tier: input.tier },
        });
        return { url: "/settings/billing?success=1", mock: true };
      }

      throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Stripe not configured" });
    }),

  getInvoices: protectedProcedure
    .query(async () => {
      return [];
    }),
});
