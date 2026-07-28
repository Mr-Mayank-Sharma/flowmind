import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../middleware/trpc";
import { BillingService } from "@flowmind/billing";
import { Tier } from "@flowmind/shared";

export const billingRouter = router({
  getSubscription: protectedProcedure
    .query(async ({ ctx }) => {
      const sub = await ctx.prisma.subscription.findUnique({
        where: { userId: ctx.userId ?? undefined },
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
          where: { userId: ctx.userId ?? undefined },
          update: { tier: input.tier },
          create: { userId: ctx.userId!, tier: input.tier },
        });
        return { url: "/settings/billing?success=1", mock: true };
      }

      const url = await BillingService.createCheckoutSession({
        userId: ctx.userId!,
        tier: input.tier as Tier,
      });
      return { url, mock: false };
    }),

  createPortalSession: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (!process.env.STRIPE_SECRET_KEY) {
        return { url: "/settings/billing" };
      }

      const url = await BillingService.createPortalSession(ctx.userId!);
      return { url };
    }),

  getUsage: protectedProcedure
    .query(async ({ ctx }) => {
      return BillingService.getUsageMetrics(ctx.userId!);
    }),

  getInvoices: protectedProcedure
    .query(async ({ ctx }) => {
      return BillingService.getInvoices(ctx.userId!);
    }),

  getOrgSubscription: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ input, ctx }) => {
      const sub = await ctx.prisma.orgSubscription.findUnique({
        where: { orgId: input.orgId },
      });
      if (!sub) {
        return { orgId: input.orgId, tier: "FREE", status: "active", memberLimit: 5, membersUsed: 0 };
      }
      return sub;
    }),

  createOrgCheckout: protectedProcedure
    .input(z.object({ orgId: z.string(), tier: z.enum(["TEAM", "ENTERPRISE"]) }))
    .mutation(async ({ input, ctx }) => {
      const membership = await ctx.prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId: input.orgId, userId: ctx.userId! } },
      });
      if (!membership || membership.role !== "OWNER") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only org owners can manage billing" });
      }

      const memberCount = await ctx.prisma.orgMember.count({ where: { orgId: input.orgId } });

      if (!process.env.STRIPE_SECRET_KEY) {
        await ctx.prisma.orgSubscription.upsert({
          where: { orgId: input.orgId },
          update: { tier: input.tier, memberLimit: input.tier === "TEAM" ? 10 : 100, membersUsed: memberCount },
          create: { orgId: input.orgId, tier: input.tier, memberLimit: input.tier === "TEAM" ? 10 : 100, membersUsed: memberCount },
        });
        return { url: "/settings/billing?success=1", mock: true };
      }

      const url = await BillingService.createCheckoutSession({
        userId: ctx.userId!,
        tier: input.tier as Tier,
        orgId: input.orgId,
        quantity: memberCount,
      });
      return { url, mock: false };
    }),

  updateOrgMemberLimit: protectedProcedure
    .input(z.object({ orgId: z.string(), memberLimit: z.number().int().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const membership = await ctx.prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId: input.orgId, userId: ctx.userId! } },
      });
      if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only org admins can manage members" });
      }

      const sub = await ctx.prisma.orgSubscription.findUnique({ where: { orgId: input.orgId } });
      if (!sub) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Org has no subscription" });
      }

      const tierConfig = (await import("@flowmind/billing/tiers")).getTierConfig(sub.tier as unknown as Tier);
      const maxSeats = tierConfig.features.maxTeamSeats;
      if (maxSeats !== null && input.memberLimit > maxSeats) {
        throw new TRPCError({ code: "FORBIDDEN", message: `Maximum ${maxSeats} seats for ${sub.tier} tier` });
      }

      return ctx.prisma.orgSubscription.update({
        where: { orgId: input.orgId },
        data: { memberLimit: input.memberLimit },
      });
    }),
});
