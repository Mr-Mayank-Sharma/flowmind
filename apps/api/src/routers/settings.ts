import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../middleware/trpc";

export const settingsRouter = router({
  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().optional(), timezone: z.string().optional(), language: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: input,
      });
    }),

  getApiKeys: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.apiKey.findMany({
        where: { userId: ctx.userId },
        select: { id: true, name: true, provider: true, lastFour: true, lastUsedAt: true, createdAt: true, isActive: true },
      });
    }),

  createApiKey: protectedProcedure
    .input(z.object({ name: z.string(), provider: z.string(), key: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { createHash, randomBytes } = await import("crypto");
      const keyHash = createHash("sha256").update(input.key).digest("hex");
      const lastFour = input.key.slice(-4);

      return ctx.prisma.apiKey.create({
        data: {
          userId: ctx.userId,
          name: input.name,
          provider: input.provider,
          keyHash,
          lastFour,
        },
      });
    }),

  deleteApiKey: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.apiKey.deleteMany({
        where: { id: input.id, userId: ctx.userId },
      });
      return { success: true };
    }),
});
