import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../middleware/trpc";

export const chatRouter = router({
  sendMessage: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      content: z.string(),
      files: z.array(z.object({ url: z.string(), type: z.string() })).optional(),
      model: z.string().optional(),
      tools: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const session = await ctx.prisma.session.findUnique({
        where: { id: input.sessionId },
      });
      if (!session || session.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      const message = await ctx.prisma.message.create({
        data: {
          sessionId: input.sessionId,
          role: "USER",
          content: input.content,
        },
      });

      return { message, streamUrl: `/api/chat/stream/${input.sessionId}` };
    }),

  getSessions: protectedProcedure
    .input(z.object({ cursor: z.string().optional(), limit: z.number().default(20) }))
    .query(async ({ input, ctx }) => {
      const sessions = await ctx.prisma.session.findMany({
        where: { userId: ctx.userId },
        orderBy: { updatedAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        select: { id: true, title: true, createdAt: true, updatedAt: true },
      });

      let nextCursor: string | undefined;
      if (sessions.length > input.limit) {
        sessions.pop();
        nextCursor = sessions[sessions.length - 1]?.id;
      }

      return { sessions, nextCursor };
    }),

  getSession: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const session = await ctx.prisma.session.findUnique({
        where: { id: input.id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      if (!session || session.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return session;
    }),

  createSession: protectedProcedure
    .input(z.object({ title: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.prisma.session.create({
        data: { userId: ctx.userId, title: input.title || "New Chat" },
      });
    }),

  deleteSession: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.session.deleteMany({
        where: { id: input.id, userId: ctx.userId },
      });
      return { success: true };
    }),

  searchSessions: protectedProcedure
    .input(z.object({ query: z.string(), limit: z.number().default(10) }))
    .query(async ({ input, ctx }) => {
      return ctx.prisma.session.findMany({
        where: {
          userId: ctx.userId,
          title: { contains: input.query, mode: "insensitive" },
        },
        take: input.limit,
        orderBy: { updatedAt: "desc" },
      });
    }),
});
