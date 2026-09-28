import type { PrismaClient } from "@flowmind/db";
import { Tier } from "@flowmind/shared";

/** Ascending privilege order; the highest value among a user's sources wins. */
const TIER_ORDER: readonly Tier[] = [Tier.FREE, Tier.PRO, Tier.TEAM, Tier.ENTERPRISE];

/**
 * Picks the most privileged tier from every source that can grant one. Unrecognised
 * values are ignored, so a bad row can only ever fall back to the FREE floor rather
 * than silently upgrading anyone.
 */
export function highestTier(...tiers: readonly (Tier | string | null | undefined)[]): Tier {
  let best = Tier.FREE;
  for (const tier of tiers) {
    if (TIER_ORDER.indexOf(tier as Tier) > TIER_ORDER.indexOf(best)) best = tier as Tier;
  }
  return best;
}

/**
 * The one place a user's entitlements are decided. Three independent columns can
 * grant a tier -- the user's own `User.tier`, their `Org.tier` when they belong to a
 * workspace, and the org's `OrgSubscription.tier` from a paid plan. Reading only one of
 * them meant an org created with an enterprise `Org.tier` and no subscription row was
 * enforced as FREE, so enforcement and the tier reported by `auth.*` disagreed.
 */
export async function resolveEffectiveTier(prisma: PrismaClient, userId: string): Promise<Tier> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true, org: { select: { tier: true, subscription: { select: { tier: true } } } } },
  });
  if (!user) return Tier.FREE;

  return highestTier(user.tier, user.org?.tier, user.org?.subscription?.tier);
}
