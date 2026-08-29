import cron from "node-cron"
import { prisma } from "@flowmind/db"
import { PipelineEngine } from "@flowmind/pipeline-engine"
import type { LLMProvider } from "@flowmind/pipeline-engine"
import { buildLLMProvider, normalizeGraph } from "../lib/llm-factory"
import { registerActiveRun, unregisterActiveRun } from "./active-runs"

const log = {
  info: (...args: unknown[]) => console.log("[cron-scheduler]", ...args),
  warn: (...args: unknown[]) => console.warn("[cron-scheduler]", ...args),
  error: (...args: unknown[]) => console.error("[cron-scheduler]", ...args),
}

function computeNextRun(expression: string): Date | null {
  try {
    const parts = expression.trim().split(/\s+/)
    if (parts.length !== 5) return null

    const now = new Date()
    const next = new Date(now)

    const [minExpr, hourExpr] = parts

    if (minExpr && minExpr !== "*") {
      const min = parseInt(minExpr.replace("*/", ""), 10)
      if (minExpr.startsWith("*/")) {
        const currentMin = now.getMinutes()
        const nextMin = Math.ceil((currentMin + 1) / min) * min
        next.setMinutes(nextMin)
        if (nextMin >= 60) {
          next.setHours(next.getHours() + 1)
          next.setMinutes(nextMin - 60)
        }
      } else {
        next.setMinutes(min)
        if (min <= now.getMinutes()) next.setHours(next.getHours() + 1)
      }
    } else {
      next.setMinutes(now.getMinutes() + 1)
    }

    if (hourExpr && hourExpr !== "*") {
      const hour = parseInt(hourExpr.replace("*/", ""), 10)
      if (hourExpr.startsWith("*/")) {
        const currentHour = now.getHours()
        const nextHour = Math.ceil((currentHour + 1) / hour) * hour
        next.setHours(nextHour % 24)
        if (nextHour >= 24) next.setDate(next.getDate() + 1)
      } else {
        next.setHours(hour)
        if (next <= now) next.setDate(next.getDate() + 1)
      }
    }

    return next > now ? next : null
  } catch {
    return null
  }
}

const scheduledTasks = new Map<string, cron.ScheduledTask>()

export function getCronScheduler() {
  return {
    start,
    stop,
    reschedule,
    getStatus,
  }
}

async function start() {
  const llm = buildLLMProvider()
  const jobs = await prisma.cronJob.findMany({ where: { isActive: true } })
  log.info(`Loading ${jobs.length} active cron jobs`)

  for (const job of jobs) {
    scheduleJob(job.id, job.expression, job.pipelineId, llm)
  }
}

function scheduleJob(jobId: string, expression: string, pipelineId: string, llm: LLMProvider | undefined) {
  if (scheduledTasks.has(jobId)) {
    scheduledTasks.get(jobId)!.stop()
  }

  if (!cron.validate(expression)) {
    log.warn(`Invalid cron expression for job ${jobId}: ${expression}`)
    return
  }

  const task = cron.schedule(expression, async () => {
    await executeJob(jobId, pipelineId, llm)
  })

  scheduledTasks.set(jobId, task)
  log.info(`Scheduled job ${jobId} with expression: ${expression}`)
}

async function executeJob(jobId: string, pipelineId: string, llm: LLMProvider | undefined) {
  log.info(`Executing cron job ${jobId} for pipeline ${pipelineId}`)

  let runId: string | null = null
  const controller = new AbortController()

  try {
    const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } })
    if (!pipeline) {
      log.error(`Pipeline ${pipelineId} not found for job ${jobId}`)
      return
    }

    const run = await prisma.pipelineRun.create({
      data: {
        pipelineId,
        status: "RUNNING",
        input: { triggeredBy: "cron", jobId },
        startedAt: new Date(),
      },
    })
    runId = run.id
    registerActiveRun(run.id, controller)

    const engine = new PipelineEngine({ llm })
    const graph = normalizeGraph(pipeline.graph)

    const result = await engine.execute(run.id, pipelineId, graph, { triggeredBy: "cron", jobId }, undefined, controller.signal)

    const finalStatus = result.status === "success" ? "SUCCESS" : "FAILED"

    await prisma.pipelineRun.update({
      where: { id: run.id },
      data: {
        status: finalStatus as any,
        output: result as any,
        completedAt: new Date(),
      },
    })

    await prisma.cronJob.update({
      where: { id: jobId },
      data: {
        lastRunAt: new Date(),
        runCount: { increment: 1 },
        nextRunAt: computeNextRun((await prisma.cronJob.findUnique({ where: { id: jobId } }))?.expression ?? ""),
      },
    })

    await prisma.pipeline.update({
      where: { id: pipelineId },
      data: {
        runCount: { increment: 1 },
        lastRunAt: new Date(),
        avgDurationMs: result.durationMs,
      },
    })

    log.info(`Job ${jobId} completed with status: ${finalStatus} (${result.durationMs}ms)`)
  } catch (err) {
    log.error(`Job ${jobId} failed:`, err)

    await prisma.cronJob.update({
      where: { id: jobId },
      data: {
        lastRunAt: new Date(),
        runCount: { increment: 1 },
      },
    }).catch(() => {})
  } finally {
    if (runId) unregisterActiveRun(runId)
  }
}

function stop() {
  for (const [, task] of scheduledTasks) {
    task.stop()
  }
  scheduledTasks.clear()
  log.info("All cron jobs stopped")
}

function reschedule(jobId: string, expression: string, pipelineId: string) {
  const llm = buildLLMProvider()
  if (scheduledTasks.has(jobId)) {
    scheduledTasks.get(jobId)!.stop()
    scheduledTasks.delete(jobId)
  }
  scheduleJob(jobId, expression, pipelineId, llm)
}

function unschedule(jobId: string) {
  const task = scheduledTasks.get(jobId)
  if (task) {
    task.stop()
    scheduledTasks.delete(jobId)
    log.info(`Unscheduled job ${jobId}`)
  }
}

function getStatus() {
  return {
    activeJobs: scheduledTasks.size,
    jobIds: Array.from(scheduledTasks.keys()),
  }
}

export { unschedule, reschedule }
