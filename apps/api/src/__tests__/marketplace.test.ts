import { describe, it, expect, beforeEach, vi } from "vitest";

// protectedProcedure reads the module-level prisma (tier lookup + usage limits), so the
// mock has to stand in for those models as well as the marketplace models.
const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    orgSubscription: { findUnique: vi.fn() },
    session: { count: vi.fn() },
    pipeline: { count: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    marketplaceListing: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    marketplaceSkill: { findMany: vi.fn(), findUnique: vi.fn() },
    marketplaceFlow: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock("@flowmind/db", () => ({ prisma: mocks.prisma }));

import { marketplaceRouter } from "../routers/marketplace";
import { MarketplaceItemType } from "@flowmind/shared";

const ctx = {
  prisma: mocks.prisma,
  userId: "user-1",
  hostClient: null,
  req: { method: "POST", headers: {} },
  res: {},
} as never;

const caller = () => marketplaceRouter.createCaller(ctx);

const LISTING = {
  id: "listing-1",
  type: "SKILL",
  ownerId: "user-1",
  title: "Formatter",
  description: "Formats text",
  category: "text",
  tags: ["text"],
  manifest: { name: "formatter", runtime: "javascript" },
  payloadRef: null,
  payloadState: "INLINE",
  version: 2,
  downloads: 10,
  ratingAvg: 4.5,
  ratingCount: 2,
  isVerified: true,
  isFeatured: false,
  visibility: "PUBLIC",
  forkedFromId: null,
  ownerId_user: undefined,
  publishedAt: new Date("2026-01-01"),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
} as never;

const DEAD_LISTING = {
  ...(LISTING as object),
  id: "listing-dead",
  title: "Ghost",
  type: "PIPELINE",
  manifest: null,
  payloadRef: null,
  payloadState: "NONE",
  publishedAt: new Date("2026-02-01"),
} as never;

const PROMPT_LISTING = {
  ...(LISTING as object),
  id: "listing-prompt",
  title: "Starter prompts",
  type: "PROMPT_PACK",
  manifest: null,
  payloadRef: null,
  payloadState: "NONE",
  publishedAt: new Date("2026-03-01"),
} as never;

const LIVE_REFERENCE_LISTING = {
  ...(LISTING as object),
  id: "listing-live-ref",
  title: "Live reference",
  type: "PIPELINE",
  manifest: null,
  payloadRef: { pipelineId: "pipe-1" },
  payloadState: "REFERENCE",
  publishedAt: new Date("2026-04-01"),
} as never;

const STALE_REFERENCE_LISTING = {
  ...(LISTING as object),
  id: "listing-stale-ref",
  title: "Orphan reference",
  type: "PIPELINE",
  manifest: null,
  payloadRef: { pipelineId: "pipe-deleted" },
  payloadState: "REFERENCE",
  publishedAt: new Date("2026-04-02"),
} as never;

const SKILL = {
  id: "skill-1",
  name: "Summarizer",
  description: "Summarizes text",
  author: "ada",
  manifest: { name: "summarizer", runtime: "javascript" },
  code: "export default () => 'hi'",
  version: "3.1.0",
  tags: ["nlp"],
  downloads: 7,
  ratingAvg: 4,
  ratingCount: 1,
  createdAt: new Date("2026-01-05"),
} as never;

const FLOW = {
  id: "flow-1",
  pipelineId: "pipe-1",
  creatorId: "user-2",
  title: "Ingest flow",
  description: "Ingests docs",
  category: "rag",
  tags: ["docs"],
  price: null,
  downloads: 3,
  ratingAvg: 3.5,
  ratingCount: 1,
  isFeatured: false,
  isVerified: false,
  publishedAt: new Date("2026-01-10"),
} as never;

const PIPELINE = {
  id: "pipe-1",
  name: "Ingest pipeline",
  graph: { nodes: [{ id: "n1" }], edges: [] },
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.user.findUnique.mockResolvedValue({ id: "user-1", tier: "FREE", orgId: null, role: "USER" });
  mocks.prisma.orgSubscription.findUnique.mockResolvedValue(null);
  mocks.prisma.session.count.mockResolvedValue(0);
  mocks.prisma.pipeline.count.mockResolvedValue(0);
  mocks.prisma.pipeline.findMany.mockResolvedValue([]);
  mocks.prisma.user.findMany.mockResolvedValue([]);
  mocks.prisma.marketplaceListing.findMany.mockResolvedValue([]);
  mocks.prisma.marketplaceSkill.findMany.mockResolvedValue([]);
  mocks.prisma.marketplaceFlow.findMany.mockResolvedValue([]);
});

describe("marketplace.publish payload enforcement", () => {
  it("rejects an executable listing that carries no payload", async () => {
    await expect(
      caller().publish({ type: MarketplaceItemType.SKILL, title: "Ghost skill", description: "no payload" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.prisma.marketplaceListing.create).not.toHaveBeenCalled();
  });

  it("stores a manifest-backed skill listing as INLINE and executable", async () => {
    mocks.prisma.marketplaceListing.create.mockResolvedValue(LISTING);
    const result = await caller().publish({
      type: MarketplaceItemType.SKILL,
      title: "Formatter",
      description: "Formats text",
      manifest: { name: "formatter", runtime: "javascript" },
    });
    expect(mocks.prisma.marketplaceListing.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ payloadState: "INLINE" }) }),
    );
    expect(result.payloadState).toBe("INLINE");
  });

  it("stores a pipelineId reference as REFERENCE", async () => {
    mocks.prisma.marketplaceListing.create.mockResolvedValue({ ...(LISTING as object), payloadState: "REFERENCE" } as never);
    const result = await caller().publish({
      type: MarketplaceItemType.PIPELINE,
      title: "Ingest flow",
      description: "Runs a pipeline",
      payloadRef: { pipelineId: "pipe-1" },
    });
    expect(mocks.prisma.marketplaceListing.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ payloadState: "REFERENCE" }) }),
    );
    expect(result.payloadState).toBe("REFERENCE");
  });

  it("accepts a payload-free prompt pack because prompts are content, not code", async () => {
    mocks.prisma.marketplaceListing.create.mockResolvedValue(PROMPT_LISTING);
    const result = await caller().publish({ type: MarketplaceItemType.PROMPT_PACK, title: "Starter prompts", description: "text" });
    expect(mocks.prisma.marketplaceListing.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ payloadState: "NONE" }) }),
    );
    expect(result.payloadState).toBe("NONE");

    // Reading it back must say so out loud rather than pretending it can run.
    mocks.prisma.marketplaceListing.findUnique.mockResolvedValue(PROMPT_LISTING);
    const readBack = await caller().getById({ id: "listing-prompt" });
    expect(readBack.payload).toEqual({
      state: "NONE",
      executable: false,
      reason: "PROMPT_PACK listings are content only",
    });
  });
});

describe("marketplace.list dead-listing filter", () => {
  it("hides executable-typed listings with no payload by default", async () => {
    mocks.prisma.marketplaceListing.findMany.mockResolvedValue([LISTING]);
    const result = await caller().list({});
    const args = mocks.prisma.marketplaceListing.findMany.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(args.where.NOT).toBeDefined();
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]!.payload.executable).toBe(true);
  });

  it("reports a reference listing dead in list when its pipeline was deleted", async () => {
    mocks.prisma.marketplaceListing.findMany.mockResolvedValue([STALE_REFERENCE_LISTING]);
    mocks.prisma.pipeline.findMany.mockResolvedValue([]);

    const result = await caller().list({ sort: "newest" });

    expect(result.listings[0]!.payload).toEqual({
      state: "REFERENCE",
      executable: false,
      reason: "referenced pipeline is no longer available",
    });
  });

  it("drops the NOT clause when includeNonExecutable is set", async () => {
    mocks.prisma.marketplaceListing.findMany.mockResolvedValue([DEAD_LISTING]);
    const result = await caller().list({ includeNonExecutable: true });
    const args = mocks.prisma.marketplaceListing.findMany.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(args.where.NOT).toBeUndefined();
    expect(result.listings[0]!.payload).toEqual({
      state: "NONE",
      executable: false,
      reason: "PIPELINE listings need a manifest or payloadRef to be executable",
    });
  });
});

describe("marketplace.catalog", () => {
  it("merges listings, skills and flows into one normalized, sorted catalog", async () => {
    mocks.prisma.marketplaceListing.findMany.mockResolvedValue([LISTING]);
    mocks.prisma.marketplaceSkill.findMany.mockResolvedValue([SKILL]);
    mocks.prisma.marketplaceFlow.findMany.mockResolvedValue([FLOW]);

    const result = await caller().catalog({ sort: "popular" });

    expect(result.entries.map((entry) => entry.source)).toEqual(["listing", "skill", "flow"]);
    expect(result.entries.map((entry) => entry.id)).toEqual(["listing-1", "skill-1", "flow-1"]);

    const [listing, skill, flow] = result.entries;
    expect(listing!.payload).toEqual({ state: "INLINE", executable: true });
    expect(skill!.payload).toEqual({ state: "INLINE", executable: true });
    expect(flow!.payload).toEqual({ state: "REFERENCE", executable: true });
    expect(skill!.title).toBe("Summarizer");
    expect(skill!.version).toBe("3.1.0");
    expect(flow!.category).toBe("rag");
  });

  it("reports a reference listing dead in the catalog when its pipeline was deleted", async () => {
    mocks.prisma.marketplaceListing.findMany.mockResolvedValue([
      LIVE_REFERENCE_LISTING,
      STALE_REFERENCE_LISTING,
    ]);
    mocks.prisma.pipeline.findMany.mockResolvedValue([{ id: "pipe-1" }]);

    const result = await caller().catalog({ sort: "newest" });

    const live = result.entries.find((e) => e.id === "listing-live-ref");
    const stale = result.entries.find((e) => e.id === "listing-stale-ref");
    expect(live!.payload).toEqual({ state: "REFERENCE", executable: true });
    expect(stale!.payload).toEqual({
      state: "REFERENCE",
      executable: false,
      reason: "referenced pipeline is no longer available",
    });
    // One query for the whole page: browse must not fall back to N+1 per listing.
    expect(mocks.prisma.pipeline.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.pipeline.findMany.mock.calls[0]![0].where.id.in).toEqual([
      "pipe-1",
      "pipe-deleted",
    ]);
  });

  it("skips the skill table when a type filter excludes SKILL", async () => {
    await caller().catalog({ type: MarketplaceItemType.PIPELINE });
    expect(mocks.prisma.marketplaceSkill.findMany).not.toHaveBeenCalled();
  });

  it("resolves flow owner names through user.findMany because creatorId has no relation", async () => {
    mocks.prisma.marketplaceFlow.findMany.mockResolvedValue([FLOW]);
    mocks.prisma.user.findMany.mockResolvedValue([{ id: "user-2", name: "grace" }]);
    const result = await caller().catalog({ type: MarketplaceItemType.PIPELINE });
    expect(mocks.prisma.user.findMany).toHaveBeenCalled();
    expect(result.entries[0]!.ownerName).toBe("grace");
  });
});

describe("marketplace.catalogEntry", () => {
  it("returns the real manifest and code for a skill", async () => {
    mocks.prisma.marketplaceSkill.findUnique.mockResolvedValue(SKILL);
    const result = await caller().catalogEntry({ source: "skill", id: "skill-1" });
    expect(result.payload).toEqual({
      manifest: { name: "summarizer", runtime: "javascript" },
      code: "export default () => 'hi'",
    });
    expect(result.entry.payload.executable).toBe(true);
  });

  it("marks a reference listing dead when the pipeline it points at is gone", async () => {
    mocks.prisma.marketplaceListing.findUnique.mockResolvedValue({
      ...(LISTING as object),
      type: "PIPELINE",
      manifest: null,
      payloadRef: { pipelineId: "pipe-gone" },
      payloadState: "REFERENCE",
    } as never);
    mocks.prisma.pipeline.findUnique.mockResolvedValue(null);

    const result = await caller().catalogEntry({ source: "listing", id: "listing-1" });

    expect(result.payload.reference).toEqual({
      pipelineId: "pipe-gone",
      pipelineName: null,
      graph: null,
      available: false,
    });
    expect(result.entry.payload.executable).toBe(false);
    expect(result.entry.payload.reason).toBe("referenced pipeline is no longer available");
  });

  it("hands back the real graph for a reference listing whose pipeline still exists", async () => {
    mocks.prisma.marketplaceListing.findUnique.mockResolvedValue({
      ...(LISTING as object),
      type: "PIPELINE",
      manifest: null,
      payloadRef: { pipelineId: "pipe-1" },
      payloadState: "REFERENCE",
    } as never);
    mocks.prisma.pipeline.findUnique.mockResolvedValue(PIPELINE);

    const result = await caller().catalogEntry({ source: "listing", id: "listing-1" });

    expect(result.payload.reference).toEqual({
      pipelineId: "pipe-1",
      pipelineName: "Ingest pipeline",
      graph: { nodes: [{ id: "n1" }], edges: [] },
      available: true,
    });
    expect(result.entry.payload.executable).toBe(true);
  });

  it("throws NOT_FOUND for a source that does not exist", async () => {
    mocks.prisma.marketplaceFlow.findUnique.mockResolvedValue(null);
    await expect(caller().catalogEntry({ source: "flow", id: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
