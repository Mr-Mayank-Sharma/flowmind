import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../middleware/trpc";
import { MarketplaceItemType } from "@flowmind/shared";

const itemTypeSchema = z.nativeEnum(MarketplaceItemType);
const sortSchema = z.enum(["popular", "newest", "rating"]).default("popular");

export const marketplaceRouter = router({
  list: publicProcedure
    .input(z.object({
      type: itemTypeSchema.optional(),
      category: z.string().optional(),
      search: z.string().optional(),
      sort: sortSchema,
      cursor: z.string().optional(),
      limit: z.number().default(20),
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

      return { listings, nextCursor };
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
      return listing;
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

      const nextVersion = listing.version + 1;

      const [version] = await ctx.prisma.$transaction([
        ctx.prisma.marketplaceListingVersion.create({
          data: {
            listingId: input.listingId,
            version: nextVersion,
            manifest: (input.manifest as any) ?? undefined,
            payloadRef: (input.payloadRef as any) ?? undefined,
            changelog: input.changelog,
          },
        }),
        ctx.prisma.marketplaceListing.update({
          where: { id: input.listingId },
          data: {
            version: nextVersion,
            manifest: (input.manifest as any) ?? undefined,
            payloadRef: (input.payloadRef as any) ?? undefined,
          },
        }),
      ]);

      return version;
    }),
});
