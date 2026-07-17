import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure } from "../middleware/trpc"

const AGENT_RUNTIME_URL = process.env.AGENT_RUNTIME_URL || "http://localhost:8001"
const AGENT_API_KEY = process.env.AGENT_API_KEY || ""

async function callAgentRuntime(path: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${AGENT_RUNTIME_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(AGENT_API_KEY ? { Authorization: `Bearer ${AGENT_API_KEY}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Agent runtime returned ${res.status}`)
  return res.json()
}

function serialize(v: unknown): unknown {
  if (typeof v === "bigint") return Number(v)
  if (Array.isArray(v)) return v.map(serialize)
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) {
      out[k] = serialize(val)
    }
    return out
  }
  return v
}

export const knowledgeRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const res = await ctx.prisma.knowledgeBase.findMany({
        where: { userId: ctx.userId },
        orderBy: { updatedAt: "desc" },
      })
      return serialize(res) as typeof res
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const kb = await ctx.prisma.knowledgeBase.findUnique({
        where: { id: input.id },
        include: { documents: { orderBy: { createdAt: "desc" } } },
      })
      if (!kb || kb.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      return serialize(kb) as typeof kb
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      model: z.string().default("nomic-embed-text"),
    }))
    .mutation(async ({ input, ctx }) => {
      const res = await ctx.prisma.knowledgeBase.create({
        data: { ...input, userId: ctx.userId },
      })
      return serialize(res) as typeof res
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.knowledgeBase.deleteMany({
        where: { id: input.id, userId: ctx.userId },
      })
      return { success: true }
    }),

  uploadDocument: protectedProcedure
    .input(z.object({
      kbId: z.string(),
      name: z.string(),
      type: z.enum(["PDF", "TXT", "MD", "CSV", "JSON"]),
      content: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const kb = await ctx.prisma.knowledgeBase.findUnique({
        where: { id: input.kbId },
      })
      if (!kb || kb.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }

      const size = Buffer.byteLength(input.content || "", "utf8")

      const doc = await ctx.prisma.knowledgeDocument.create({
        data: {
          kbId: input.kbId,
          name: input.name,
          type: input.type,
          size,
          content: input.content,
          status: "INDEXING",
        },
      })

      await ctx.prisma.knowledgeBase.update({
        where: { id: input.kbId },
        data: {
          totalDocs: { increment: 1 },
          totalSize: { increment: size },
          status: "INDEXING",
        },
      })

      if (input.content) {
        callAgentRuntime("/knowledge/index", {
          user_id: ctx.userId,
          doc_id: doc.id,
          content: input.content,
          metadata: { name: input.name, type: input.type, kbId: input.kbId },
        }).then(() => {
          ctx.prisma.knowledgeDocument.update({
            where: { id: doc.id },
            data: { status: "INDEXED" },
          })
          ctx.prisma.knowledgeBase.update({
            where: { id: input.kbId },
            data: { status: "READY" },
          })
        }).catch((err) => {
          ctx.req.log.error({ err }, "Embedding indexing failed")
          ctx.prisma.knowledgeDocument.update({
            where: { id: doc.id },
            data: { status: "ERROR" },
          })
        })
      }

      return serialize(doc) as typeof doc
    }),

  deleteDocument: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const doc = await ctx.prisma.knowledgeDocument.findUnique({
        where: { id: input.id },
        include: { kb: true },
      })
      if (!doc || doc.kb.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }

      await ctx.prisma.knowledgeDocument.delete({ where: { id: input.id } })

      callAgentRuntime("/knowledge/delete", {
        user_id: ctx.userId,
        doc_id: input.id,
        content: "",
      }).catch((err) => {
        ctx.req.log.warn({ err, docId: input.id }, "Failed to delete knowledge from agent runtime");
      })

      const remaining = await ctx.prisma.knowledgeDocument.count({
        where: { kbId: doc.kbId },
      })

      await ctx.prisma.knowledgeBase.update({
        where: { id: doc.kbId },
        data: {
          totalDocs: remaining,
          totalSize: { decrement: doc.size },
          status: remaining === 0 ? "READY" : undefined,
        },
      })

      return { success: true }
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string(), topK: z.number().min(1).max(20).default(5) }))
    .query(async ({ input, ctx }) => {
      try {
        const vectorResult = await callAgentRuntime("/knowledge/search", {
          user_id: ctx.userId,
          query: input.query,
          top_k: input.topK,
        })

        return vectorResult.map((r: any) => ({
          id: r.id,
          content: r.content,
          kb: r.metadata?.kbId ?? "",
          score: r.score,
          doc: r.metadata?.name ?? "",
        }))
      } catch {
        const kbs = await ctx.prisma.knowledgeBase.findMany({
          where: { userId: ctx.userId },
          include: {
            documents: {
              where: {
                OR: [
                  { name: { contains: input.query, mode: "insensitive" } },
                  { content: { contains: input.query, mode: "insensitive" } },
                ],
              },
              take: 10,
            },
          },
        })

        const results: {
          id: string
          content: string
          kb: string
          score: number
          doc: string
        }[] = []

        for (const kb of kbs) {
          for (const doc of kb.documents) {
            const snippet = doc.content
              ? extractSnippet(doc.content, input.query)
              : doc.name
            results.push({
              id: doc.id,
              content: snippet,
              kb: kb.name,
              score: doc.content?.toLowerCase().includes(input.query.toLowerCase()) ? 0.9 : 0.7,
              doc: doc.name,
            })
          }
        }

        return results
      }
    }),
})

function extractSnippet(content: string, query: string, contextChars = 80): string {
  const idx = content.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return content.slice(0, 200)
  const start = Math.max(0, idx - contextChars)
  const end = Math.min(content.length, idx + query.length + contextChars)
  const prefix = start > 0 ? "..." : ""
  const suffix = end < content.length ? "..." : ""
  return `${prefix}${content.slice(start, end)}${suffix}`
}
