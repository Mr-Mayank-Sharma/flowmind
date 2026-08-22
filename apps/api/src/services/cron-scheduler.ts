import cron from "node-cron"
import { prisma } from "@flowmind/db"
import { PipelineEngine } from "@flowmind/pipeline-engine"
import type { PipelineGraph, PipelineNode, LLMProvider } from "@flowmind/pipeline-engine"
import { LLMEngine, resolveDefaultOllamaModel } from "@flowmind/llm-router"

const log = {
  info: (...args: unknown[]) => console.log("[cron-scheduler]", ...args),
  warn: (...args: unknown[]) => console.warn("[cron-scheduler]", ...args),
  error: (...args: unknown[]) => console.error("[cron-scheduler]", ...args),
}

function buildLLMProvider(): LLMProvider | undefined {
  const openaiKey = process.env.OPENAI_KEY
  const anthropicKey = process.env.ANTHROPIC_KEY
  const groqKey = process.env.GROQ_KEY
  const ollamaUrl = process.env.OLLAMA_BASE_URL
  if (!openaiKey && !anthropicKey && !groqKey && !ollamaUrl) return undefined
  const llmEngine = new LLMEngine({
    openaiKey: openaiKey ?? undefined,
    anthropicKey: anthropicKey ?? undefined,
    groqKey: groqKey ?? undefined,
    deepseekKey: process.env.DEEPSEEK_KEY,
    openrouterKey: process.env.OPENROUTER_KEY,
    togetherKey: process.env.TOGETHER_KEY,
    mistralKey: process.env.MISTRAL_KEY,
    perplexityKey: process.env.PERPLEXITY_KEY,
    deepinfraKey: process.env.DEEPINFRA_KEY,
    cerebrasKey: process.env.CEREBRAS_KEY,
    xaiKey: process.env.XAI_KEY,
    cohereKey: process.env.COHERE_KEY,
    cloudflareKey: process.env.CLOUDFLARE_KEY,
    veniceAIKey: process.env.VENICE_AI_KEY,
    alibabaKey: process.env.ALIBABA_KEY,
    googleKey: process.env.GOOGLE_KEY,
    ollamaBaseUrl: ollamaUrl ?? undefined,
  })
  return {
    complete: async (req) => {
      const model = req.model || (await resolveDefaultOllamaModel()) || "tinyllama"
      const result = await llmEngine.complete({
        messages: req.messages as any,
        model,
        maxTokens: req.maxTokens ?? 500,
        temperature: req.temperature,
      })
      return { content: result.message.content as string, model: result.model }
    },
  }
}

function normalizeGraph(graph: any): PipelineGraph {
  if (!graph || !graph.nodes) return { nodes: [], edges: [] }
  return {
    nodes: (graph.nodes as any[]).map((n: any) => ({
      id: n.id,
      type: n.engineType ?? n.type,
      label: n.label ?? "",
      position: n.position ?? { x: 0, y: 0 },
      config: n.config ?? {},
      continueOnFail: n.continueOnFail,
      retryOnFail: n.retryOnFail,
      maxRetries: n.maxRetries,
      disabled: n.disabled,
    } as PipelineNode)),
    edges: (graph.edges || []).map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    })),
  }
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

    const engine = new PipelineEngine({ llm })
    const graph = normalizeGraph(pipeline.graph)

    const result = await engine.execute(run.id, pipelineId, graph, { triggeredBy: "cron", jobId })

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
