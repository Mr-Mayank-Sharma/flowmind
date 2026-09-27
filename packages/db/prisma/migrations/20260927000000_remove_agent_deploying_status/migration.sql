-- Agents have no deploy step: a newly created agent is STOPPED until the user starts it.
-- DEPLOYING was never produced by any real process, so existing rows collapse to STOPPED.
UPDATE "agents" SET "status" = 'STOPPED' WHERE "status" = 'DEPLOYING';

-- AlterEnum
ALTER TYPE "AgentStatus" RENAME TO "AgentStatus_old";
CREATE TYPE "AgentStatus" AS ENUM ('RUNNING', 'STOPPED', 'ERROR');
ALTER TABLE "agents" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "agents" ALTER COLUMN "status" SET DEFAULT 'STOPPED';
ALTER TABLE "agents" ALTER COLUMN "status" TYPE "AgentStatus" USING "status"::text::"AgentStatus";
DROP TYPE "AgentStatus_old";
