import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure, publicProcedure } from "../middleware/trpc"
import { SkillManifestSchema } from "@flowmind/skill-engine"
import { prisma } from "@flowmind/db"

const SkillManifestInputSchema = SkillManifestSchema

export const skillsRouter = router({
  list: publicProcedure
    .input(z.object({ tag: z.string().optional(), search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const where: Record<string, unknown> = {}
      if (input?.tag) {
        where.tags = { has: input.tag }
      }
      if (input?.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { description: { contains: input.search, mode: "insensitive" } },
        ]
      }
      return prisma.marketplaceSkill.findMany({
        where,
        orderBy: { downloads: "desc" },
        take: 100,
        select: {
          id: true,
          name: true,
          description: true,
          author: true,
          version: true,
          tags: true,
          downloads: true,
          ratingAvg: true,
          ratingCount: true,
          createdAt: true,
        },
      })
    }),

  search: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      return prisma.marketplaceSkill.findMany({
        where: {
          OR: [
            { name: { contains: input.query, mode: "insensitive" } },
            { description: { contains: input.query, mode: "insensitive" } },
            { tags: { has: input.query } },
          ],
        },
        orderBy: { downloads: "desc" },
        take: 50,
        select: {
          id: true,
          name: true,
          description: true,
          author: true,
          version: true,
          tags: true,
          downloads: true,
          ratingAvg: true,
          ratingCount: true,
        },
      })
    }),

  getById: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      const skill = await prisma.marketplaceSkill.findUnique({
        where: { name: input.name },
        include: { versions: { orderBy: { createdAt: "desc" }, take: 10 }, reviews: { take: 20 } },
      })
      if (!skill) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Skill "${input.name}" not found` })
      }
      return skill
    }),

  install: protectedProcedure
    .input(z.object({ skillId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const skill = await prisma.marketplaceSkill.findUnique({ where: { id: input.skillId } })
      if (!skill) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Skill not found" })
      }

      await prisma.marketplaceSkill.update({
        where: { id: input.skillId },
        data: { downloads: { increment: 1 } },
      })

      return { success: true, skill: { name: skill.name, version: skill.version, manifest: skill.manifest, code: skill.code } }
    }),

  publish: protectedProcedure
    .input(z.object({
      manifest: SkillManifestInputSchema,
      code: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const existing = await prisma.marketplaceSkill.findUnique({ where: { name: input.manifest.name } })

      if (existing) {
        if (existing.author !== ctx.userId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You cannot update a skill owned by another user" })
        }

        const updated = await prisma.marketplaceSkill.update({
          where: { name: input.manifest.name },
          data: {
            description: input.manifest.description,
            manifest: input.manifest as any,
            code: input.code,
            version: input.manifest.version,
            tags: input.manifest.tags ?? [],
            updatedAt: new Date(),
          },
        })

        await prisma.skillVersion.create({
          data: {
            skillId: updated.id,
            version: input.manifest.version,
            manifest: input.manifest as any,
            code: input.code,
          },
        })

        return { id: updated.id, action: "updated" }
      }

      const created = await prisma.marketplaceSkill.create({
        data: {
          name: input.manifest.name,
          description: input.manifest.description,
          author: ctx.userId,
          manifest: input.manifest as any,
          code: input.code,
          version: input.manifest.version,
          tags: input.manifest.tags ?? [],
        },
      })

      await prisma.skillVersion.create({
        data: {
          skillId: created.id,
          version: input.manifest.version,
          manifest: input.manifest as any,
          code: input.code,
        },
      })

      return { id: created.id, action: "created" }
    }),

  run: protectedProcedure
    .input(z.object({
      name: z.string(),
      inputs: z.record(z.unknown()).default({}),
    }))
    .mutation(async ({ input, ctx }) => {
      const skill = await prisma.marketplaceSkill.findUnique({ where: { name: input.name } })
      if (!skill) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Skill "${input.name}" not found` })
      }

      const manifest = skill.manifest as Record<string, unknown>
      const runtime = manifest.runtime as string

      if (runtime === "sandboxed-js") {
        const { SkillEngine } = await import("@flowmind/skill-engine")
        const engine = new SkillEngine()
        const inputStr = JSON.stringify(input.inputs)
        const result = await engine.execute(skill.id, { userId: ctx.userId, input: inputStr })
        return result
      }

      return { output: "Native runtime not supported via API", success: false, durationMs: 0 }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const skill = await prisma.marketplaceSkill.findUnique({ where: { id: input.id } })
      if (!skill) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Skill not found" })
      }
      if (skill.author !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot delete a skill owned by another user" })
      }
      await prisma.marketplaceSkill.delete({ where: { id: input.id } })
      return { success: true }
    }),

  versions: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      const skill = await prisma.marketplaceSkill.findUnique({ where: { name: input.name } })
      if (!skill) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Skill "${input.name}" not found` })
      }
      return prisma.skillVersion.findMany({
        where: { skillId: skill.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, version: true, createdAt: true },
      })
    }),
})
