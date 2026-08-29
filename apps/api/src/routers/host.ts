import { z } from "zod";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { prisma } from "@flowmind/db";
import { router, t, publicProcedure, protectedProcedure } from "../middleware/trpc";
import { diffGraphs, mergeGraphs, validateGraph } from "@flowmind/pipeline-engine";
import { normalizeGraph } from "../lib/llm-factory";
import { hashConnectToken, signHostClientToken } from "../services/host-auth";
import { getContextEngine } from "../services/context-engine";
import { userGroupRoles } from "../services/group-access";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

async function ollamaModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.models as Array<{ name?: string }>) ?? []).map((m) => m.name ?? "").filter(Boolean);
  } catch {
    return [];
  }
}

async function resolveModel(requested: string): Promise<{ model: string; resolved: boolean }> {
  const installed = await ollamaModels();
  if (installed.length === 0) return { model: requested, resolved: false };
  if (installed.includes(requested)) return { model: requested, resolved: false };
  const local = installed.find((m) => !m.includes(":cloud"));
  return { model: local ?? installed[0]!, resolved: true };
}

async function ollamaGenerate(params: { model: string; prompt: string; system?: string; temperature?: number }): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: params.model || "tinyllama",
      prompt: params.prompt,
      system: params.system ?? undefined,
      stream: false,
      temperature: params.temperature,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: `Host model unavailable: ${res.status}` });
  }
  const data = await res.json();
  return (data.response as string) ?? "";
}

const hostClientProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.hostClient) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx });
});

export const hostRouter = router({
  // ---- Host-side group management ----
  listGroups: protectedProcedure.query(async ({ ctx }) => {
    const roles = await userGroupRoles(ctx.userId!);
    if (roles.size === 0) return { groups: [] };
    const groups = await prisma.hostGroup.findMany({
      where: { id: { in: [...roles.keys()] } },
      include: {
        _count: { select: { members: true, pipelines: true, skills: true, knowledgeBases: true } },
        members: { select: { user: { select: { id: true, name: true, email: true } }, role: true } },
      },
    });
    return {
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        role: roles.get(g.id) ?? "VIEWER",
        memberCount: g._count.members,
        pipelineCount: g._count.pipelines,
        skillCount: g._count.skills,
        knowledgeCount: g._count.knowledgeBases,
        members: g.members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email, role: m.role })),
      })),
    };
  }),

  createGroup: protectedProcedure
    .input(z.object({ name: z.string().min(1), slug: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const user = await prisma.user.findUnique({ where: { id: ctx.userId! }, select: { orgId: true } });
      if (!user?.orgId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Groups require an organization. Create an org first." });
      }
      const slug = input.slug?.trim() || input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const group = await prisma.hostGroup.create({
        data: {
          orgId: user.orgId,
          name: input.name,
          slug,
          members: { create: { userId: ctx.userId!, role: "OWNER" } },
        },
      });
      return group;
    }),

  addGroupMember: protectedProcedure
    .input(z.object({ groupId: z.string(), email: z.string().email(), role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]).default("MEMBER") }))
    .mutation(async ({ input, ctx }) => {
      const roles = await userGroupRoles(ctx.userId!);
      const myRole = roles.get(input.groupId);
      if (myRole !== "OWNER" && myRole !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only group owners/admins can add members" });
      }
      const target = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "No user with that email" });
      return prisma.hostGroupMember.upsert({
        where: { groupId_userId: { groupId: input.groupId, userId: target.id } },
        create: { groupId: input.groupId, userId: target.id, role: input.role },
        update: { role: input.role },
      });
    }),

  removeGroupMember: protectedProcedure
    .input(z.object({ groupId: z.string(), userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const roles = await userGroupRoles(ctx.userId!);
      const myRole = roles.get(input.groupId);
      if (myRole !== "OWNER" && myRole !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only group owners/admins can remove members" });
      }
      await prisma.hostGroupMember.deleteMany({
        where: { groupId: input.groupId, userId: input.userId },
      });
      return { success: true };
    }),

  // ---- Host-side client / connect-token management ----
  createConnectToken: protectedProcedure
    .input(z.object({ groupId: z.string(), clientName: z.string().min(1), expiresInHours: z.number().min(1).max(24 * 30).default(168) }))
    .mutation(async ({ input, ctx }) => {
      const roles = await userGroupRoles(ctx.userId!);
      const myRole = roles.get(input.groupId);
      if (myRole !== "OWNER" && myRole !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only group owners/admins can create connect tokens" });
      }
      const rawToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + input.expiresInHours * 3600 * 1000);
      const group = await prisma.hostGroup.findUnique({ where: { id: input.groupId }, select: { orgId: true } });
      const client = await prisma.hostClient.create({
        data: {
          orgId: group?.orgId ?? null,
          name: input.clientName,
          status: "PENDING",
          connectTokenHash: hashConnectToken(rawToken),
          connectTokenExpiresAt: expiresAt,
          connectTokenGroupId: input.groupId,
        },
      });
      return {
        clientId: client.id,
        clientName: client.name,
        token: rawToken,
        groupId: input.groupId,
        expiresAt: expiresAt.toISOString(),
      };
    }),

  listClients: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({ where: { id: ctx.userId! }, select: { orgId: true } });
    if (!user?.orgId) return { clients: [] };
    return {
      clients: await prisma.hostClient.findMany({
        where: { orgId: user.orgId },
        orderBy: { createdAt: "desc" },
      }),
    };
  }),

  revokeClient: protectedProcedure
    .input(z.object({ clientId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const user = await prisma.user.findUnique({ where: { id: ctx.userId! }, select: { orgId: true } });
      if (!user?.orgId) throw new TRPCError({ code: "FORBIDDEN" });
      await prisma.hostClient.updateMany({
        where: { id: input.clientId, orgId: user.orgId },
        data: { status: "REVOKED" },
      });
      return { success: true };
    }),

  // ---- Host-side group knowledge ----
  createPipeline: protectedProcedure
    .input(z.object({
      groupId: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
      graph: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }),
    }))
    .mutation(async ({ input, ctx }) => {
      const roles = await userGroupRoles(ctx.userId!);
      if (roles.get(input.groupId) !== "OWNER" && roles.get(input.groupId) !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only group owners/admins can publish pipelines" });
      }
      const graph = normalizeGraph(input.graph);
      const errors = validateGraph(graph);
      if (errors.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Invalid graph: ${errors.join("; ")}` });
      }
      return prisma.pipeline.create({
        data: {
          groupId: input.groupId,
          name: input.name,
          description: input.description,
          graph: graph as any,
          isActive: true,
        },
      });
    }),

  upsertKnowledge: protectedProcedure
    .input(z.object({ groupId: z.string(), name: z.string(), content: z.string(), docId: z.string().optional(), description: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const roles = await userGroupRoles(ctx.userId!);
      if (roles.get(input.groupId) !== "OWNER" && roles.get(input.groupId) !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const docId = input.docId ?? `${input.groupId}-${Date.now()}`;
      const kb = await prisma.knowledgeBase.upsert({
        where: { id: docId },
        create: {
          id: docId,
          groupId: input.groupId,
          name: input.name,
          description: input.description,
        },
        update: { name: input.name, description: input.description },
      });
      await getContextEngine().index(`group:${input.groupId}`, docId, input.content, { kbId: kb.id, groupId: input.groupId }, input.groupId);
      await prisma.knowledgeBase.update({
        where: { id: kb.id },
        data: { totalDocs: { increment: 1 } },
      });
      return { docId: kb.id };
    }),

  deleteKnowledge: protectedProcedure
    .input(z.object({ groupId: z.string(), docId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const roles = await userGroupRoles(ctx.userId!);
      if (roles.get(input.groupId) !== "OWNER" && roles.get(input.groupId) !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await prisma.knowledgeBase.deleteMany({ where: { id: input.docId, groupId: input.groupId } });
      await getContextEngine().delete(`group:${input.groupId}`, input.docId, input.groupId);
      return { success: true };
    }),

  // ---- Host-side proposals ----
  listProposals: protectedProcedure
    .input(z.object({ groupId: z.string().optional(), status: z.enum(["PROPOSED", "APPROVED", "REJECTED", "MERGED"]).optional(), cursor: z.string().optional(), limit: z.number().default(20) }))
    .query(async ({ input, ctx }) => {
      const roles = await userGroupRoles(ctx.userId!);
      const allowedIds = [...roles.keys()];
      const where: any = { groupId: { in: allowedIds } };
      if (input.groupId) {
        if (!allowedIds.includes(input.groupId)) throw new TRPCError({ code: "FORBIDDEN" });
        where.groupId = input.groupId;
      }
      if (input.status) where.status = input.status;
      const proposals = await prisma.pipelineProposal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        include: {
          group: { select: { id: true, name: true } },
          _count: { select: { comments: true } },
        },
      });
      let nextCursor: string | undefined;
      if (proposals.length > input.limit) {
        proposals.pop();
        nextCursor = proposals[proposals.length - 1]?.id;
      }
      return { proposals, nextCursor };
    }),

  getProposal: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const roles = await userGroupRoles(ctx.userId!);
      const proposal = await prisma.pipelineProposal.findUnique({
        where: { id: input.id },
        include: { group: true, comments: { orderBy: { createdAt: "asc" } } },
      });
      if (!proposal || !roles.has(proposal.groupId)) throw new TRPCError({ code: "NOT_FOUND" });
      return proposal;
    }),

  addProposalComment: protectedProcedure
    .input(z.object({ proposalId: z.string(), body: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const roles = await userGroupRoles(ctx.userId!);
      const proposal = await prisma.pipelineProposal.findUnique({ where: { id: input.proposalId }, select: { groupId: true } });
      if (!proposal || !roles.has(proposal.groupId)) throw new TRPCError({ code: "NOT_FOUND" });
      return prisma.pipelineProposalComment.create({
        data: {
          proposalId: input.proposalId,
          authorId: ctx.userId!,
          body: input.body,
        },
      });
    }),

  approveProposal: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const proposal = await assertCanReview(ctx.userId!, input.id);
      if (proposal.status !== "PROPOSED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot approve a ${proposal.status} proposal` });
      }
      return prisma.pipelineProposal.update({
        where: { id: input.id },
        data: { status: "APPROVED" },
      });
    }),

  rejectProposal: protectedProcedure
    .input(z.object({ id: z.string(), reason: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const proposal = await assertCanReview(ctx.userId!, input.id);
      if (proposal.status !== "PROPOSED" && proposal.status !== "APPROVED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot reject a ${proposal.status} proposal` });
      }
      return prisma.pipelineProposal.update({
        where: { id: input.id },
        data: { status: "REJECTED", rejectedByUserId: ctx.userId!, rejectedReason: input.reason, rejectedAt: new Date() },
      });
    }),

  mergeProposal: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const proposal = await assertCanReview(ctx.userId!, input.id);
      if (proposal.status !== "APPROVED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only APPROVED proposals can be merged" });
      }
      if (!proposal.basePipelineId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Proposal has no base pipeline" });
      }
      const base = await prisma.pipeline.findUnique({ where: { id: proposal.basePipelineId } });
      if (!base || base.groupId !== proposal.groupId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Base pipeline no longer exists" });
      }
      const baseGraph = normalizeGraph(proposal.baseGraph ?? base.graph);
      const proposedGraph = normalizeGraph(proposal.proposedGraph);
      const diff = diffGraphs(baseGraph, proposedGraph);
      const mergedGraph = mergeGraphs(baseGraph, proposedGraph, diff);

      const versionHistory = (base.versionHistory as any[]) ?? [];
      versionHistory.push({
        version: base.version,
        graph: base.graph,
        name: base.name,
        description: base.description,
        savedAt: base.updatedAt.toISOString(),
        savedBy: ctx.userId,
        mergedFrom: proposal.id,
      });

      await prisma.pipeline.update({
        where: { id: base.id },
        data: {
          graph: mergedGraph as any,
          version: { increment: 1 },
          versionHistory: versionHistory,
        },
      });

      return prisma.pipelineProposal.update({
        where: { id: proposal.id },
        data: { status: "MERGED", mergedByUserId: ctx.userId!, mergedAt: new Date() },
      });
    }),

  // ---- Client-facing connect flow ----
  connect: publicProcedure
    .input(z.object({ token: z.string().min(1), email: z.string().email(), name: z.string().optional(), url: z.string().optional() }))
    .mutation(async ({ input }) => {
      const tokenHash = hashConnectToken(input.token);
      const client = await prisma.hostClient.findFirst({ where: { connectTokenHash: tokenHash } });
      if (!client) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid connect token" });
      if (client.status === "REVOKED") throw new TRPCError({ code: "UNAUTHORIZED", message: "Connect token revoked" });
      if (client.connectTokenExpiresAt && client.connectTokenExpiresAt < new Date()) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Connect token expired" });
      }
      if (client.status === "PENDING") {
        await prisma.hostClient.update({
          where: { id: client.id },
          data: { status: "ACTIVE", lastConnectedAt: new Date(), url: input.url ?? client.url },
        });
      } else {
        await prisma.hostClient.update({
          where: { id: client.id },
          data: { lastConnectedAt: new Date(), url: input.url ?? client.url },
        });
      }
      const groupId = client.connectTokenGroupId ?? null;
      if (!groupId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Connect token is not scoped to a group" });
      }
      const group = await prisma.hostGroup.findUnique({ where: { id: groupId }, select: { id: true, name: true } });
      if (!group) throw new TRPCError({ code: "BAD_REQUEST", message: "Connect token group no longer exists" });
      const accessToken = signHostClientToken({
        type: "host-client",
        clientId: client.id,
        groupId,
        email: input.email,
      });
      return {
        hostClientToken: accessToken,
        clientId: client.id,
        groupId,
        groupName: group.name,
        expiresInHours: 12,
      };
    }),

  client: router({
    pull: hostClientProcedure.query(async ({ ctx }) => {
      const groupId = ctx.hostClient!.groupId;
      if (!groupId) throw new TRPCError({ code: "FORBIDDEN", message: "Connect token is not scoped to a group" });
      const [pipelines, skills, knowledge] = await Promise.all([
        prisma.pipeline.findMany({
          where: { groupId },
          select: { id: true, name: true, description: true, version: true, graph: true, updatedAt: true, hostPipelineId: true },
        }),
        prisma.skill.findMany({
          where: { groupId },
          select: { id: true, name: true, description: true, triggerPattern: true, code: true, version: true, updatedAt: true },
        }),
        prisma.knowledgeBase.findMany({
          where: { groupId },
          select: { id: true, name: true, description: true, totalDocs: true, updatedAt: true },
        }),
      ]);
      return {
        groupId,
        syncedAt: new Date().toISOString(),
        pipelines: pipelines.map((p) => ({ ...p, hostPipelineId: p.id })),
        skills,
        knowledge,
      };
    }),

    searchContext: hostClientProcedure
      .input(z.object({ text: z.string().min(1), topK: z.number().min(1).max(20).default(5) }))
      .query(async ({ input, ctx }) => {
        const groupId = ctx.hostClient!.groupId;
        if (!groupId) throw new TRPCError({ code: "FORBIDDEN" });
        const chunks = await getContextEngine().search({
          text: input.text,
          userId: `group:${groupId}`,
          groupId,
          topK: input.topK,
        });
        return { chunks };
      }),

    proposePipeline: hostClientProcedure
      .input(z.object({
        basePipelineId: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        proposedGraph: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }),
        message: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const groupId = ctx.hostClient!.groupId;
        if (!groupId) throw new TRPCError({ code: "FORBIDDEN" });
        const base = await prisma.pipeline.findFirst({ where: { id: input.basePipelineId, groupId } });
        if (!base) throw new TRPCError({ code: "NOT_FOUND", message: "Base pipeline not found in group" });
        const proposedGraph = normalizeGraph(input.proposedGraph);
        const errors = validateGraph(proposedGraph);
        if (errors.length > 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Invalid proposed graph: ${errors.join("; ")}` });
        }
        const baseGraph = normalizeGraph(base.graph);
        const diff = diffGraphs(baseGraph, proposedGraph);
        return prisma.pipelineProposal.create({
          data: {
            groupId,
            proposedByClient: ctx.hostClient!.clientId,
            proposedByName: ctx.hostClient!.email,
            name: input.name,
            description: input.description,
            basePipelineId: base.id,
            baseVersion: base.version,
            baseGraph: base.graph as any,
            proposedGraph: proposedGraph as any,
            diff: diff as any,
            message: input.message,
          },
        });
      }),

    routeInference: hostClientProcedure
      .input(z.object({
        model: z.string().default("tinyllama"),
        prompt: z.string().min(1),
        system: z.string().optional(),
        temperature: z.number().min(0).max(2).optional(),
      }))
      .mutation(async ({ input }) => {
        const { model, resolved } = await resolveModel(input.model);
        const content = await ollamaGenerate({ ...input, model });
        return { content, model, provider: "host", modelResolved: resolved, ollamaUrl: OLLAMA_URL };
      }),
  }),
});

async function assertCanReview(userId: string, proposalId: string) {
  const roles = await userGroupRoles(userId);
  const proposal = await prisma.pipelineProposal.findUnique({ where: { id: proposalId } });
  if (!proposal || !roles.has(proposal.groupId)) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  const role = roles.get(proposal.groupId);
  if (role !== "OWNER" && role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only group owners/admins can review proposals" });
  }
  return proposal;
}
