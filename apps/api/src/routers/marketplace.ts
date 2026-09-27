import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@flowmind/db";
import { router, publicProcedure, protectedProcedure } from "../middleware/trpc";
import {
  EXECUTABLE_ITEM_TYPES,
  MarketplaceItemType,
  MarketplacePayloadState,
  requiresExecutablePayload,
  resolvePayloadState,
  type CatalogEntry,
  type PayloadResolution,
} from "@flowmind/shared";

const itemTypeSchema = z.nativeEnum(MarketplaceItemType);
const sortSchema = z.enum(["popular", "newest", "rating"]).default("popular");

/**
 * A listing nobody can run is a dead listing. `publish` and `createVersion` refuse to
 * create new ones, but rows written before that rule exist, so browse hides them unless
 * the caller explicitly asks. PROMPT_PACK survives: content is not code, so having no
 * payload is legitimate for it.
 */
const HIDE_DEAD_LISTINGS = {
  NOT: {
    AND: [
      { type: { in: [...EXECUTABLE_ITEM_TYPES] } },
      { payloadState: MarketplacePayloadState.NONE },
    ],
  },
} as const;

type SortKey = "popular" | "newest" | "rating";

/**
 * Prisma exposes enums as plain string unions while @flowmind/shared exports a TypeScript
 * enum, so a row read from the database cannot be passed to the shared helpers directly.
 * Normalizing once here keeps the cast out of every call site.
 */
function toItemType(value: string): MarketplaceItemType {
  return value as unknown as MarketplaceItemType;
}

function compareEntries(a: CatalogEntry, b: CatalogEntry, sort: SortKey): number {
  if (sort === "rating") return b.ratingAvg - a.ratingAvg || a.title.localeCompare(b.title);
  if (sort === "newest") {
    return Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.title.localeCompare(b.title);
  }
  return b.downloads - a.downloads || a.title.localeCompare(b.title);
}

function textMatch(search: string | undefined) {
  if (!search) return undefined;
  return {
    OR: [
      { title: { contains: search, mode: "insensitive" as const } },
      { description: { contains: search, mode: "insensitive" as const } },
    ],
  };
}

/** Flows record their author's id with no relation, so the name needs an explicit lookup. */
async function creatorNames(
  prisma: any,
  creatorIds: string[],
): Promise<Map<string, string | null>> {
  const unique = [...new Set(creatorIds)];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u: { id: string; name: string | null }) => [u.id, u.name]));
}

function listingEntry(row: any, ownerName: string | null = null, resolved?: PayloadResolution): CatalogEntry {
  return {
    source: "listing",
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    category: row.category ?? null,
    tags: row.tags ?? [],
    downloads: row.downloads ?? 0,
    ratingAvg: row.ratingAvg ?? 0,
    ratingCount: row.ratingCount ?? 0,
    version: String(row.version ?? 1),
    publishedAt: new Date(row.publishedAt ?? row.createdAt ?? 0).toISOString(),
    ownerName,
    isVerified: row.isVerified ?? false,
    payload: resolved ?? resolvePayloadState(row.type, row),
  };
}

function skillEntry(row: any): CatalogEntry {
  return {
    source: "skill",
    id: row.id,
    type: MarketplaceItemType.SKILL,
    title: row.name,
    description: row.description,
    category: null,
    tags: row.tags ?? [],
    downloads: row.downloads ?? 0,
    ratingAvg: row.ratingAvg ?? 0,
    ratingCount: row.ratingCount ?? 0,
    version: row.version ?? "1",
    publishedAt: new Date(row.createdAt ?? 0).toISOString(),
    ownerName: row.author ?? null,
    // Only listings carry curation state; a published skill has no such column.
    isVerified: false,
    // A skill's manifest is its code contract, so it is an inline payload by definition.
    payload: resolvePayloadState(MarketplaceItemType.SKILL, { manifest: row.manifest }),
  };
}

function flowEntry(row: any, ownerName: string | null): CatalogEntry {
  return {
    source: "flow",
    id: row.id,
    type: MarketplaceItemType.PIPELINE,
    title: row.title,
    description: row.description,
    category: row.category ?? null,
    tags: row.tags ?? [],
    downloads: row.downloads ?? 0,
    ratingAvg: row.ratingAvg ?? 0,
    ratingCount: row.ratingCount ?? 0,
    version: "1",
    publishedAt: new Date(row.publishedAt ?? row.createdAt ?? 0).toISOString(),
    ownerName,
    isVerified: row.isVerified ?? false,
    // The executable unit of a flow is its pipeline, so the reference is the payload.
    payload: resolvePayloadState(MarketplaceItemType.PIPELINE, {
      payloadRef: { pipelineId: row.pipelineId },
    }),
  };
}

/**
 * A REFERENCE payload only counts if the thing it points at still exists. Reporting an
 * unresolvable reference as executable would be exactly the kind of lie this batch removes.
 */
async function resolveListingPayload(
  prisma: any,
  listing: any,
): Promise<{
  payload: PayloadResolution;
  reference: { pipelineId: string; pipelineName: string | null; graph: unknown; available: boolean } | null;
}> {
  const payload = resolvePayloadState(listing.type, listing);
  const pipelineId = (listing.payloadRef as { pipelineId?: unknown } | null)?.pipelineId;
  if (payload.state !== MarketplacePayloadState.REFERENCE || typeof pipelineId !== "string") {
    return { payload, reference: null };
  }
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    select: { id: true, name: true, graph: true },
  });
  if (!pipeline) {
    return {
      payload: { ...payload, executable: false, reason: "referenced pipeline is no longer available" },
      reference: { pipelineId, pipelineName: null, graph: null, available: false },
    };
  }
  return {
    payload,
    reference: { pipelineId, pipelineName: pipeline.name, graph: pipeline.graph, available: true },
  };
}

/**
 * The same honesty rule as resolveListingPayload, applied to a whole page. A listing's payloadRef
 * is plain Json with no foreign key, so a referenced pipeline can be deleted while a listing still
 * points at it. Resolving every reference in one query keeps browse honest without N+1 round trips.
 */
async function resolveListingPayloads(
  prisma: any,
  listings: any[],
): Promise<Map<string, PayloadResolution>> {
  const resolutions = new Map<string, PayloadResolution>();
  const referenced: { listing: any; pipelineId: string }[] = [];

  for (const listing of listings) {
    const payload = resolvePayloadState(listing.type, listing);
    resolutions.set(listing.id, payload);
    if (payload.state !== MarketplacePayloadState.REFERENCE) continue;
    const pipelineId = (listing.payloadRef as { pipelineId?: unknown } | null)?.pipelineId;
    if (typeof pipelineId === "string") referenced.push({ listing, pipelineId });
  }
  if (referenced.length === 0) return resolutions;

  const pipelines = await prisma.pipeline.findMany({
    where: { id: { in: [...new Set(referenced.map((r) => r.pipelineId))] } },
    select: { id: true },
  });
  const live = new Set(pipelines.map((p: { id: string }) => p.id));

  for (const { listing, pipelineId } of referenced) {
    if (live.has(pipelineId)) continue;
    const payload = resolutions.get(listing.id);
    if (!payload) continue;
    resolutions.set(listing.id, {
      ...payload,
      executable: false,
      reason: "referenced pipeline is no longer available",
    });
  }
  return resolutions;
}

export const marketplaceRouter = router({
  list: publicProcedure
    .input(z.object({
      type: itemTypeSchema.optional(),
      category: z.string().optional(),
      search: z.string().optional(),
      sort: sortSchema,
      cursor: z.string().optional(),
      limit: z.number().default(20),
      includeNonExecutable: z.boolean().default(false),
    }))
    .query(async ({ input, ctx }) => {
      const where: any = {};
      if (input.type) where.type = input.type;
      if (input.category) where.category = input.category;
      if (input.search) {
        where.OR = [
          { title: { contains: input.search, mode: "insensitive" } },
          { description: { contains: input.search, mode: "insensitive" } },
        ];
      }
      if (!input.includeNonExecutable) where.NOT = HIDE_DEAD_LISTINGS.NOT;

      const orderBy: any =
        input.sort === "newest" ? { publishedAt: "desc" } :
        input.sort === "rating" ? { ratingAvg: "desc" } :
        { downloads: "desc" };

      const listings = await ctx.prisma.marketplaceListing.findMany({
        where,
        orderBy,
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        include: { owner: { select: { name: true, avatarUrl: true } } },
      });

      let nextCursor: string | undefined;
      if (listings.length > input.limit) {
        listings.pop();
        nextCursor = listings[listings.length - 1]?.id;
      }

      const payloads = await resolveListingPayloads(ctx.prisma, listings);
      return {
        listings: listings.map((listing: any) => ({
          ...listing,
          payload: payloads.get(listing.id) ?? resolvePayloadState(listing.type, listing),
        })),
        nextCursor,
      };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const listing = await ctx.prisma.marketplaceListing.findUnique({
        where: { id: input.id },
        include: {
          owner: { select: { name: true, avatarUrl: true } },
          versions: { orderBy: { version: "desc" }, take: 1 },
          reviews: { include: { reviewer: { select: { name: true, avatarUrl: true } } } },
        },
      });
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" });
      return { ...listing, payload: resolvePayloadState(toItemType(listing.type), listing) };
    }),

  clone: protectedProcedure
    .input(z.object({ listingId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const source = await ctx.prisma.marketplaceListing.findUnique({
        where: { id: input.listingId },
      });
      if (!source) throw new TRPCError({ code: "NOT_FOUND" });

      const fork = await ctx.prisma.marketplaceListing.create({
        data: {
          type: source.type,
          ownerId: ctx.userId!,
          title: `${source.title} (fork)`,
          description: source.description,
          category: source.category,
          tags: source.tags,
          manifest: (source.manifest as any) ?? undefined,
          payloadRef: (source.payloadRef as any) ?? undefined,
          payloadState: source.payloadState,
          forkedFromId: source.id,
        },
      });

      await ctx.prisma.marketplaceFork.create({
        data: {
          sourceId: source.id,
          forkListingId: fork.id,
          userId: ctx.userId!,
        },
      });

      await ctx.prisma.marketplaceListing.update({
        where: { id: source.id },
        data: { forkCount: { increment: 1 }, downloads: { increment: 1 } },
      });

      return fork;
    }),

  search: protectedProcedure
    .input(z.object({
      query: z.string(),
      type: itemTypeSchema.optional(),
      limit: z.number().default(10),
    }))
    .query(async ({ input, ctx }) => {
      const where: any = {
        OR: [
          { title: { contains: input.query, mode: "insensitive" } },
          { description: { contains: input.query, mode: "insensitive" } },
          { tags: { has: input.query.toLowerCase() } },
        ],
      };
      if (input.type) where.type = input.type;

      return ctx.prisma.marketplaceListing.findMany({
        where,
        take: input.limit,
        orderBy: { downloads: "desc" },
        include: { owner: { select: { name: true, avatarUrl: true } } },
      });
    }),

  publish: protectedProcedure
    .input(z.object({
      type: itemTypeSchema,
      title: z.string().min(1).max(128),
      description: z.string().min(1).max(2000),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      manifest: z.record(z.unknown()).optional(),
      payloadRef: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const payload = resolvePayloadState(input.type, {
        manifest: input.manifest,
        payloadRef: input.payloadRef,
      });
      if (!payload.executable && requiresExecutablePayload(input.type)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: payload.reason });
      }

      return ctx.prisma.marketplaceListing.create({
        data: {
          type: input.type,
          ownerId: ctx.userId!,
          title: input.title,
          description: input.description,
          category: input.category,
          tags: input.tags ?? [],
          manifest: (input.manifest as any) ?? undefined,
          payloadRef: (input.payloadRef as any) ?? undefined,
          payloadState: payload.state,
        },
      });
    }),

  rate: protectedProcedure
    .input(z.object({
      listingId: z.string(),
      stars: z.number().int().min(1).max(5),
      body: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const review = await ctx.prisma.marketplaceReview.upsert({
        where: { listingId_reviewerId: { listingId: input.listingId, reviewerId: ctx.userId! } },
        update: { stars: input.stars, body: input.body },
        create: {
          listingId: input.listingId,
          reviewerId: ctx.userId!,
          stars: input.stars,
          body: input.body,
        },
      });

      const aggregate = await ctx.prisma.marketplaceReview.aggregate({
        where: { listingId: input.listingId },
        _avg: { stars: true },
        _count: true,
      });

      await ctx.prisma.marketplaceListing.update({
        where: { id: input.listingId },
        data: {
          ratingAvg: aggregate._avg.stars || 0,
          ratingCount: aggregate._count,
        },
      });

      return review;
    }),

  getTypes: publicProcedure
    .query(() => {
      return Object.values(MarketplaceItemType);
    }),

  getByOwner: protectedProcedure
    .input(z.object({ ownerId: z.string().optional(), limit: z.number().default(20) }))
    .query(async ({ input, ctx }) => {
      return ctx.prisma.marketplaceListing.findMany({
        where: { ownerId: input.ownerId ?? ctx.userId! },
        orderBy: { updatedAt: "desc" },
        take: input.limit,
      });
    }),

  createVersion: protectedProcedure
    .input(z.object({
      listingId: z.string(),
      manifest: z.record(z.unknown()).optional(),
      payloadRef: z.record(z.unknown()).optional(),
      changelog: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const listing = await ctx.prisma.marketplaceListing.findUnique({
        where: { id: input.listingId },
      });
      if (!listing || listing.ownerId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // A changelog-only release keeps the payload it already had; dropping it here would
      // quietly turn a working listing into a dead one.
      const manifest = (input.manifest ?? listing.manifest ?? undefined) as any;
      const payloadRef = (input.payloadRef ?? listing.payloadRef ?? undefined) as any;
      const payload = resolvePayloadState(toItemType(listing.type), { manifest, payloadRef });
      if (!payload.executable && requiresExecutablePayload(toItemType(listing.type))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: payload.reason });
      }

      const nextVersion = listing.version + 1;

      const [version] = await ctx.prisma.$transaction([
        ctx.prisma.marketplaceListingVersion.create({
          data: {
            listingId: input.listingId,
            version: nextVersion,
            manifest,
            payloadRef,
            changelog: input.changelog,
          },
        }),
        ctx.prisma.marketplaceListing.update({
          where: { id: input.listingId },
          data: {
            version: nextVersion,
            manifest,
            payloadRef,
            payloadState: payload.state,
          },
        }),
      ]);

      return version;
    }),

  /**
   * One browse surface over all three tables. The legacy skill and flow catalogs are
   * projected onto the listing shape instead of being migrated away, because skills.ts,
   * pipeline.ts and MetricsService all still read them.
   */
  catalog: publicProcedure
    .input(z.object({
      type: itemTypeSchema.optional(),
      category: z.string().optional(),
      search: z.string().optional(),
      sort: sortSchema,
      limit: z.number().default(30),
    }))
    .query(async ({ input, ctx }) => {
      const match = textMatch(input.search);
      const listingWhere: any = {};
      if (input.type) listingWhere.type = input.type;
      if (input.category) listingWhere.category = input.category;
      if (match) listingWhere.OR = match.OR;
      if (input.type && requiresExecutablePayload(input.type)) {
        listingWhere.NOT = HIDE_DEAD_LISTINGS.NOT;
      }

      // Each catalog gets its own clause: they share sort fields, but skills spell "newest"
      // as createdAt, and Prisma's order types are not interchangeable across models.
      const order: Prisma.MarketplaceListingOrderByWithRelationInput =
        input.sort === "rating" ? { ratingAvg: "desc" } :
        input.sort === "newest" ? { publishedAt: "desc" } :
        { downloads: "desc" };
      const skillOrder: Prisma.MarketplaceSkillOrderByWithRelationInput =
        input.sort === "rating" ? { ratingAvg: "desc" } :
        input.sort === "newest" ? { createdAt: "desc" } :
        { downloads: "desc" };
      const flowOrder: Prisma.MarketplaceFlowOrderByWithRelationInput =
        input.sort === "rating" ? { ratingAvg: "desc" } :
        input.sort === "newest" ? { publishedAt: "desc" } :
        { downloads: "desc" };

      // The legacy tables only know about skills and flows, so a type filter narrower than
      // that leaves nothing to read from them.
      const wantSkills = input.type === undefined || input.type === MarketplaceItemType.SKILL;
      const wantFlows = input.type === undefined || input.type === MarketplaceItemType.PIPELINE;
      // Skills have no category column, so a category browse cannot match them.
      const wantUncategorized = !input.category;
      const search = input.search;

      const [listings, skills, flows] = await Promise.all([
        ctx.prisma.marketplaceListing.findMany({
          where: listingWhere,
          orderBy: order,
          take: input.limit,
          include: { owner: { select: { name: true } } },
        }),
        wantSkills && wantUncategorized
          ? ctx.prisma.marketplaceSkill.findMany({
              where: search
                ? {
                    OR: [
                      { name: { contains: search, mode: "insensitive" } },
                      { description: { contains: search, mode: "insensitive" } },
                    ],
                  }
                : {},
              orderBy: skillOrder,
              take: input.limit,
            })
          : Promise.resolve([]),
        wantFlows
          ? ctx.prisma.marketplaceFlow.findMany({
              where: {
                ...(input.category ? { category: input.category } : {}),
                ...(match ? { OR: match.OR } : {}),
              },
              orderBy: flowOrder,
              take: input.limit,
            })
          : Promise.resolve([]),
      ]);

      const owners = await creatorNames(
        ctx.prisma,
        flows.map((f: any) => f.creatorId).filter((id: unknown): id is string => typeof id === "string"),
      );

      const listingPayloads = await resolveListingPayloads(ctx.prisma, listings as any[]);
      const entries: CatalogEntry[] = [
        ...(listings as any[]).map((l: any) =>
          listingEntry(l, l.owner?.name ?? null, listingPayloads.get(l.id)),
        ),
        ...(skills as any[]).map(skillEntry),
        ...(flows as any[]).map((f: any) => flowEntry(f, owners.get(f.creatorId) ?? null)),
      ];

      entries.sort((a, b) => compareEntries(a, b, input.sort));
      return { entries: entries.slice(0, input.limit) };
    }),

  catalogEntry: publicProcedure
    .input(z.object({
      source: z.enum(["listing", "skill", "flow"]),
      id: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      if (input.source === "skill") {
        const skill = await ctx.prisma.marketplaceSkill.findUnique({ where: { id: input.id } });
        if (!skill) throw new TRPCError({ code: "NOT_FOUND" });
        return {
          entry: skillEntry(skill),
          // The real executable payload, not just a claim that one exists.
          payload: { manifest: skill.manifest, code: skill.code },
        };
      }

      if (input.source === "flow") {
        const flow = await ctx.prisma.marketplaceFlow.findUnique({
          where: { id: input.id },
          include: { pipeline: { select: { id: true, name: true } } },
        });
        if (!flow) throw new TRPCError({ code: "NOT_FOUND" });
        const owners = await creatorNames(ctx.prisma, [flow.creatorId]);
        return {
          entry: flowEntry(flow, owners.get(flow.creatorId) ?? null),
          payload: {
            pipelineId: flow.pipelineId,
            pipelineName: flow.pipeline?.name ?? null,
            available: flow.pipeline != null,
          },
        };
      }

      const listing = await ctx.prisma.marketplaceListing.findUnique({
        where: { id: input.id },
        include: { owner: { select: { name: true } } },
      });
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" });
      const { payload, reference } = await resolveListingPayload(ctx.prisma, listing);
      return {
        entry: { ...listingEntry(listing, listing.owner?.name ?? null), payload },
        payload: {
          manifest: listing.manifest ?? null,
          payloadRef: listing.payloadRef ?? null,
          reference,
        },
      };
    }),
});
