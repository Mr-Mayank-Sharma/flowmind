import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@flowmind/db";
import { Tier } from "@flowmind/shared";

import { highestTier, resolveEffectiveTier } from "../lib/effective-tier";

const prismaWith = (user: unknown) =>
  ({ user: { findUnique: vi.fn().mockResolvedValue(user) } }) as unknown as PrismaClient;

describe("highestTier", () => {
  it("falls back to FREE when nothing grants a tier", () => {
    expect(highestTier()).toBe(Tier.FREE);
    expect(highestTier(null, undefined)).toBe(Tier.FREE);
  });

  it("ignores unrecognised values instead of upgrading on garbage", () => {
    expect(highestTier("PLATINUM", "free-ish", Tier.PRO)).toBe(Tier.PRO);
  });

  it("picks the most privileged source", () => {
    expect(highestTier(Tier.FREE, Tier.TEAM, Tier.PRO)).toBe(Tier.TEAM);
    expect(highestTier(Tier.ENTERPRISE, Tier.FREE, Tier.PRO)).toBe(Tier.ENTERPRISE);
  });
});

describe("resolveEffectiveTier", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns FREE for a user that no longer exists", async () => {
    await expect(resolveEffectiveTier(prismaWith(null), "user-1")).resolves.toBe(Tier.FREE);
  });

  it("uses the user's own tier when they belong to no org", async () => {
    const prisma = prismaWith({ tier: Tier.PRO, org: null });

    await expect(resolveEffectiveTier(prisma, "user-1")).resolves.toBe(Tier.PRO);
  });

  it("escalates to the org tier when the org has no subscription row", async () => {
    // The bug: an org created with an enterprise tier but never subscribed was
    // enforced as FREE because only OrgSubscription was ever read.
    const prisma = prismaWith({ tier: Tier.FREE, org: { tier: Tier.ENTERPRISE, subscription: null } });

    await expect(resolveEffectiveTier(prisma, "user-1")).resolves.toBe(Tier.ENTERPRISE);
  });

  it("prefers the subscription when it outranks the org", async () => {
    const prisma = prismaWith({
      tier: Tier.FREE,
      org: { tier: Tier.FREE, subscription: { tier: Tier.TEAM } },
    });

    await expect(resolveEffectiveTier(prisma, "user-1")).resolves.toBe(Tier.TEAM);
  });

  it("never downgrades a user who outranks their org", async () => {
    const prisma = prismaWith({
      tier: Tier.ENTERPRISE,
      org: { tier: Tier.FREE, subscription: { tier: Tier.PRO } },
    });

    await expect(resolveEffectiveTier(prisma, "user-1")).resolves.toBe(Tier.ENTERPRISE);
  });
});
