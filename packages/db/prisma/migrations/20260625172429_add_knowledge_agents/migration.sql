-- CreateEnum
CREATE TYPE "KnowledgeBaseStatus" AS ENUM ('READY', 'INDEXING', 'ERROR');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('INDEXED', 'INDEXING', 'ERROR');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PDF', 'TXT', 'MD', 'CSV', 'JSON');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('RUNNING', 'STOPPED', 'ERROR', 'DEPLOYING');

-- CreateTable
CREATE TABLE "knowledge_bases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "model" TEXT NOT NULL DEFAULT 'nomic-embed-text',
    "status" "KnowledgeBaseStatus" NOT NULL DEFAULT 'READY',
    "totalDocs" INTEGER NOT NULL DEFAULT 0,
    "totalChunks" INTEGER NOT NULL DEFAULT 0,
    "totalSize" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "kbId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL DEFAULT 'TXT',
    "size" INTEGER NOT NULL DEFAULT 0,
    "chunks" INTEGER NOT NULL DEFAULT 0,
    "status" "DocumentStatus" NOT NULL DEFAULT 'INDEXING',
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "model" TEXT NOT NULL DEFAULT 'mistral:7b',
    "status" "AgentStatus" NOT NULL DEFAULT 'STOPPED',
    "tools" INTEGER NOT NULL DEFAULT 0,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "maxTokens" INTEGER NOT NULL DEFAULT 2048,
    "memory" TEXT NOT NULL DEFAULT '0.5 GB',
    "messages" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_bases_userId_idx" ON "knowledge_bases"("userId");

-- CreateIndex
CREATE INDEX "knowledge_documents_kbId_idx" ON "knowledge_documents"("kbId");

-- CreateIndex
CREATE INDEX "agents_userId_idx" ON "agents"("userId");

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
