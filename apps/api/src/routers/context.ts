import { z } from "zod";
import { router, protectedProcedure } from "../middleware/trpc";

export const contextRouter = router({
  getSessions: protectedProcedure
    .query(async ({ ctx }) => {
      const sessions = await ctx.prisma.session.findMany({
        where: { userId: ctx.userId },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: {
          _count: { select: { messages: true, memories: true } },
        },
      });

      return sessions.map((s) => ({
        id: s.id,
        name: s.title || "Untitled Session",
        agentName: "AI Assistant",
        tokens: 0,
        memoryCount: s._count.memories,
        messageCount: s._count.messages,
        lastActive: s.updatedAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
        status: s._count.messages > 0 ? ("active" as const) : ("idle" as const),
      }));
    }),

  getSkills: protectedProcedure
    .query(async ({ ctx }) => {
      const skills = await ctx.prisma.skill.findMany({
        where: { userId: ctx.userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return skills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.triggerPattern ? "Pattern" : "Utility",
        version: `1.${s.version}.0`,
        enabled: s.isActive,
        usageCount: s.useCount,
      }));
    }),

  getMemories: protectedProcedure
    .query(async ({ ctx }) => {
      const memories = await ctx.prisma.memory.findMany({
        where: { userId: ctx.userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return memories.map((m) => ({
        id: m.id,
        type: (m.type === "episodic" || m.type === "semantic" || m.type === "procedural" ? m.type : "semantic") as "episodic" | "semantic" | "procedural",
        content: m.content,
        summary: m.summary,
        agentName: "AI",
        timestamp: m.createdAt.toISOString(),
        relevance: m.relevanceScore ?? 0.5,
      }));
    }),

  deleteMemory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.memory.deleteMany({
        where: { id: input.id, userId: ctx.userId },
      });
      return { success: true };
    }),

  deleteSession: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.session.deleteMany({
        where: { id: input.id, userId: ctx.userId },
      });
      return { success: true };
    }),

  enableSkill: protectedProcedure
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.skill.updateMany({
        where: { id: input.id, userId: ctx.userId },
        data: { isActive: input.enabled },
      });
      return { success: true };
    }),
});
