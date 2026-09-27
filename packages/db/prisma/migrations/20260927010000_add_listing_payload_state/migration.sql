-- Listings that carry no manifest and no payloadRef cannot be executed. Recording
-- the payload source lets the browse surface hide dead entries for code-like
-- types while still allowing content-only listings (PROMPT_PACK) through.
-- CreateEnum
CREATE TYPE "MarketplacePayloadState" AS ENUM ('INLINE', 'REFERENCE', 'NONE');

-- AlterTable
ALTER TABLE "marketplace_listings" ADD COLUMN "payloadState" "MarketplacePayloadState" NOT NULL DEFAULT 'NONE';

-- Backfill from the data that already exists: a manifest is the payload, a
-- payloadRef points at one held elsewhere, and anything else is content only.
UPDATE "marketplace_listings" SET "payloadState" = 'INLINE' WHERE "manifest" IS NOT NULL;
UPDATE "marketplace_listings" SET "payloadState" = 'REFERENCE' WHERE "payloadRef" IS NOT NULL;

-- CreateIndex
CREATE INDEX "marketplace_listings_payloadState_idx" ON "marketplace_listings"("payloadState");
