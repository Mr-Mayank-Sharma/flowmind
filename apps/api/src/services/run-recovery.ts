import { prisma } from "@flowmind/db";
import { getRunEmitter, cleanupRunEmitter } from "./run-emitters";
import { isRunActive } from "./active-runs";
import { logger } from "../infrastructure";

const RECOVERY_INTERVAL_MS = 5 * 60 * 1000;
const EMITTER_CLEANUP_DELAY_MS = 60_000;
const RECOVERY_NOTE = "Orphaned run recovered after restart";

export async function recoverOrphanedRuns(): Promise<void> {
  try {
    const orphaned = await prisma.pipelineRun.findMany({ where: { status: "RUNNING" } });
    const stale = orphaned.filter((run) => !isRunActive(run.id));
    if (stale.length === 0) return;

    for (const run of stale) {
      await prisma.pipelineRun.update({
        where: { id: run.id },
        data: { status: "FAILED", output: { error: RECOVERY_NOTE }, completedAt: new Date() },
      });

      await prisma.runLog.createMany({
        data: [{
          runId: run.id,
          nodeId: "system",
          nodeType: "recovery",
          input: {},
          output: { message: RECOVERY_NOTE },
          error: "Run was left in RUNNING state when the API process restarted",
          duration: 0,
        }],
      }).catch((err: unknown) => {
        logger.error({ err, runId: run.id }, "failed to persist recovery log for recovered run");
      });

      getRunEmitter(run.id).emit("error", { message: RECOVERY_NOTE });
      setTimeout(() => cleanupRunEmitter(run.id), EMITTER_CLEANUP_DELAY_MS).unref?.();
    }

    logger.warn({ recovered: stale.length }, "recovered orphaned pipeline runs");
  } catch (err) {
    logger.error({ err }, "orphaned run recovery failed");
  }
}

export function startRunRecovery(): () => void {
  void recoverOrphanedRuns();
  const interval = setInterval(() => void recoverOrphanedRuns(), RECOVERY_INTERVAL_MS);
  interval.unref?.();
  return () => clearInterval(interval);
}