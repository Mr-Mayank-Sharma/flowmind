import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../middleware/trpc";
import { SkillEngine } from "@flowmind/skill-engine";

const skillEngine = new SkillEngine();

const builtinTools = [
  { id: "read-file", name: "Read File", description: "Read contents of a file from the filesystem", category: "filesystem", auth: false },
  { id: "write-file", name: "Write File", description: "Write content to a file on the filesystem", category: "filesystem", auth: false },
  { id: "search-files", name: "Search Files", description: "Search for files matching a pattern", category: "filesystem", auth: false },
  { id: "exec-code", name: "Execute Code", description: "Run code in a sandboxed environment", category: "code", auth: true },
  { id: "lint-format", name: "Lint & Format", description: "Lint and auto-format source code files", category: "code", auth: false },
  { id: "git-diff", name: "Git Diff", description: "Show git diff for staged/unstaged changes", category: "code", auth: false },
  { id: "git-commit", name: "Git Commit", description: "Create a git commit with a message", category: "code", auth: true },
  { id: "web-fetch", name: "Web Fetch", description: "Fetch content from a URL", category: "web", auth: false },
  { id: "web-search", name: "Web Search", description: "Search the web for information", category: "web", auth: true },
  { id: "db-query", name: "Database Query", description: "Execute SQL queries against connected databases", category: "database", auth: true },
  { id: "send-email", name: "Send Email", description: "Send an email via SMTP", category: "communication", auth: true },
  { id: "slack-msg", name: "Slack Message", description: "Send a message to a Slack channel", category: "communication", auth: true },
  { id: "image-gen", name: "Image Generation", description: "Generate images using Stable Diffusion", category: "ai", auth: false },
  { id: "webhook", name: "Webhook", description: "Trigger a webhook URL", category: "integration", auth: true },
];

export const toolsRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const skills = await ctx.prisma.skill.findMany({
        where: { userId: ctx.userId },
        select: { id: true, name: true, isActive: true, useCount: true, updatedAt: true },
      });
      const skillMap = new Map(skills.map((s) => [s.name, s]));

      return builtinTools.map((tool) => {
        const skill = skillMap.get(tool.name);
        return {
          ...tool,
          enabled: skill ? skill.isActive : true,
          usage: skill?.useCount ?? 0,
          lastUsed: skill?.updatedAt ?? null,
          skillId: skill?.id ?? null,
        };
      });
    }),

  execute: protectedProcedure
    .input(z.object({ skillId: z.string(), input: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const result = await skillEngine.execute(input.skillId, {
        userId: ctx.userId,
        input: input.input,
      })
      return result
    }),

  toggle: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const tool = builtinTools.find((t) => t.id === input.id);
      if (!tool) throw new TRPCError({ code: "NOT_FOUND", message: "Tool not found" });

      const existing = await ctx.prisma.skill.findFirst({
        where: { userId: ctx.userId, name: tool.name },
      });

      if (existing) {
        return ctx.prisma.skill.update({
          where: { id: existing.id },
          data: { isActive: !existing.isActive },
        });
      }

      return ctx.prisma.skill.create({
        data: {
          userId: ctx.userId,
          name: tool.name,
          description: tool.description,
          code: tool.id,
          isActive: false,
        },
      });
    }),
});
