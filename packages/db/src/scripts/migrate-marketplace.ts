import { prisma } from "../index";

async function migrateMarketplace() {
  console.log("Migrating MarketplaceFlow -> MarketplaceListing (type=PIPELINE)...");
  const flows = await prisma.marketplaceFlow.findMany();
  let listingCount = 0;
  for (const flow of flows) {
    const existing = await prisma.marketplaceListing.findFirst({
      where: { title: flow.title, type: "PIPELINE" },
    });
    if (existing) continue;
    await prisma.marketplaceListing.create({
      data: {
        type: "PIPELINE",
        ownerId: flow.creatorId,
        title: flow.title,
        description: flow.description,
        category: flow.category,
        tags: flow.tags,
        downloads: flow.downloads,
        ratingAvg: flow.ratingAvg,
        ratingCount: flow.ratingCount,
        isFeatured: flow.isFeatured,
        isVerified: flow.isVerified,
        publishedAt: flow.publishedAt,
      },
    });
    listingCount++;
  }
  console.log(`  Created ${listingCount} Pipeline listings`);

  const skills = await prisma.marketplaceSkill.findMany();
  let skillCount = 0;
  for (const skill of skills) {
    const existing = await prisma.marketplaceListing.findFirst({
      where: { title: skill.name, type: "SKILL" },
    });
    if (existing) continue;
    const listing = await prisma.marketplaceListing.create({
      data: {
        type: "SKILL",
        ownerId: skill.creatorId ?? undefined,
        title: skill.name,
        description: skill.description,
        downloads: skill.downloads,
        ratingAvg: skill.ratingAvg,
        ratingCount: skill.ratingCount,
        isFeatured: skill.isFeatured,
        isVerified: skill.isVerified,
        publishedAt: skill.publishedAt,
      },
    });
    await prisma.marketplaceListingVersion.create({
      data: {
        listingId: listing.id,
        version: 1,
        changelog: "Initial migration from SkillVersion",
      },
    });
    skillCount++;
  }
  console.log(`  Created ${skillCount} Skill listings`);

  console.log("Migrating FlowReview -> MarketplaceReview...");
  const flowReviews = await prisma.flowReview.findMany();
  let reviewCount = 0;
  for (const r of flowReviews) {
    const listing = await prisma.marketplaceListing.findFirst({
      where: { ownerId: r.reviewerId, type: "PIPELINE" },
    });
    if (!listing) continue;
    const existing = await prisma.marketplaceReview.findUnique({
      where: { listingId_reviewerId: { listingId: listing.id, reviewerId: r.reviewerId } },
    });
    if (existing) continue;
    await prisma.marketplaceReview.create({
      data: {
        listingId: listing.id,
        reviewerId: r.reviewerId,
        stars: r.stars,
        body: r.body ?? undefined,
      },
    });
    reviewCount++;
  }

  const skillReviews = await prisma.skillReview.findMany();
  for (const r of skillReviews) {
    const listing = await prisma.marketplaceListing.findFirst({
      where: { ownerId: r.reviewerId, type: "SKILL" },
    });
    if (!listing) continue;
    const existing = await prisma.marketplaceReview.findUnique({
      where: { listingId_reviewerId: { listingId: listing.id, reviewerId: r.reviewerId } },
    });
    if (existing) continue;
    await prisma.marketplaceReview.create({
      data: {
        listingId: listing.id,
        reviewerId: r.reviewerId,
        stars: r.stars,
        body: r.body ?? undefined,
      },
    });
    reviewCount++;
  }
  console.log(`  Created ${reviewCount} Reviews`);

  console.log("Marketplace migration complete!");
}

migrateMarketplace()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
