import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../middleware/trpc";

export const mcpRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.mcpToken.findMany({
        where: { userId: ctx.userId },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      provider: z.string(),
      accessToken: z.string(),
      scope: z.string().default("read"),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.prisma.mcpToken.create({
        data: {
          userId: ctx.userId,
          provider: input.provider,
          accessToken: input.accessToken,
          scope: input.scope,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.mcpToken.deleteMany({
        where: { id: input.id, userId: ctx.userId },
      });
      return { success: true };
    }),

  toggle: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const token = await ctx.prisma.mcpToken.findUnique({ where: { id: input.id } });
      if (!token || token.userId !== ctx.userId) throw new TRPCError({ code: "NOT_FOUND" });
      return token;
    }),
});
