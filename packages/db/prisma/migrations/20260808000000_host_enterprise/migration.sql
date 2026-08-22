-- CreateEnum
CREATE TYPE "GroupRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'MERGED');

-- CreateEnum
CREATE TYPE "HostClientStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

-- AlterEnum
ALTER TYPE "RunStatus" ADD VALUE 'AWAITING_APPROVAL';

-- DropForeignKey
ALTER TABLE "skills" DROP CONSTRAINT "skills_userId_fkey";

-- AlterTable
ALTER TABLE "skills" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "hostGroupId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "pipelines" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "hostGroupId" TEXT,
ADD COLUMN     "hostPipelineId" TEXT,
ADD COLUMN     "hostSource" JSONB;

-- AlterTable
ALTER TABLE "knowledge_bases" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "hostGroupId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "host_groups" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "tier" "Tier" NOT NULL DEFAULT 'ENTERPRISE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "host_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "host_group_members" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "host_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "host_clients" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "status" "HostClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "connectTokenHash" TEXT,
    "connectTokenExpiresAt" TIMESTAMP(3),
    "connectTokenGroupId" TEXT,
    "lastConnectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "host_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "host_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hostUrl" TEXT NOT NULL,
    "hostName" TEXT,
    "email" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'connected',
    "groups" JSONB NOT NULL,
    "lastConnectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "host_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_proposals" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "proposedByUserId" TEXT,
    "proposedByClient" TEXT,
    "proposedByName" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basePipelineId" TEXT,
    "baseVersion" INTEGER NOT NULL DEFAULT 0,
    "baseGraph" JSONB,
    "proposedGraph" JSONB NOT NULL,
    "diff" JSONB,
    "message" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PROPOSED',
    "mergedByUserId" TEXT,
    "mergedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedReason" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_proposal_comments" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_proposal_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "host_groups_orgId_idx" ON "host_groups"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "host_groups_orgId_slug_key" ON "host_groups"("orgId", "slug");

-- CreateIndex
CREATE INDEX "host_group_members_userId_idx" ON "host_group_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "host_group_members_groupId_userId_key" ON "host_group_members"("groupId", "userId");

-- CreateIndex
CREATE INDEX "host_connections_userId_idx" ON "host_connections"("userId");

-- CreateIndex
CREATE INDEX "pipeline_proposals_groupId_idx" ON "pipeline_proposals"("groupId");

-- CreateIndex
CREATE INDEX "pipeline_proposals_status_idx" ON "pipeline_proposals"("status");

-- CreateIndex
CREATE INDEX "pipeline_proposal_comments_proposalId_idx" ON "pipeline_proposal_comments"("proposalId");

-- CreateIndex
CREATE INDEX "skills_groupId_idx" ON "skills"("groupId");

-- CreateIndex
CREATE INDEX "pipelines_groupId_idx" ON "pipelines"("groupId");

-- CreateIndex
CREATE INDEX "pipelines_hostPipelineId_idx" ON "pipelines"("hostPipelineId");

-- CreateIndex
CREATE INDEX "knowledge_bases_groupId_idx" ON "knowledge_bases"("groupId");

-- AddForeignKey
ALTER TABLE "host_groups" ADD CONSTRAINT "host_groups_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_group_members" ADD CONSTRAINT "host_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "host_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_group_members" ADD CONSTRAINT "host_group_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_clients" ADD CONSTRAINT "host_clients_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_connections" ADD CONSTRAINT "host_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "host_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "host_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_proposals" ADD CONSTRAINT "pipeline_proposals_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "host_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_proposal_comments" ADD CONSTRAINT "pipeline_proposal_comments_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "pipeline_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "host_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

