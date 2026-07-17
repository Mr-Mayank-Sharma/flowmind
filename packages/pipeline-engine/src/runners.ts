import type { PipelineNode, ExecutionContext, NodeRunner, NodeOutput } from "./types"
import { resolveValue, buildExpressionContext } from "./expressions"
import { kindForNodeType } from "./types"
import { getDirectPredecessors } from "./graph"
import { runAgentLoop, type AgentTool, type ProviderFacade, type CompletionRequest, type CompletionResult, type StreamCallbacks, type Message } from "@flowmind/llm-router"

import nodemailer from "nodemailer"

const AGENT_RUNTIME_URL = process.env.AGENT_RUNTIME_URL || "http://localhost:8001"

async function llmGenerate(prompt: string, system: string | undefined, model: string, context: ExecutionContext): Promise<string> {
  if (context.llm) {
    try {
      const messages: Array<{ role: string; content: string }> = []
      if (system) messages.push({ role: "system", content: system })
      messages.push({ role: "user", content: prompt })
      const result = await context.llm.complete({ model: model || "tinyllama", messages, maxTokens: 500 })
      return result.content || "[empty response]"
    } catch (err) {
      return `[LLM error: ${err}]`
    }
  }
  try {
    const res = await fetch(`${AGENT_RUNTIME_URL}/llm/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system_prompt: system ?? "", prompt, model, max_tokens: 500 }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return `[LLM error: ${res.status}]`
    const data = await res.json()
    return data.content || "[empty response]"
  } catch (err) {
    return `[LLM unavailable: ${err}]`
  }
}

function output(node: PipelineNode, result: unknown, durationMs: number, error?: string): NodeOutput {
  return { nodeId: node.id, nodeType: node.type, output: result, durationMs, timestamp: Date.now(), error }
}

function predecessorsInput(node: PipelineNode, context: ExecutionContext): Record<string, unknown> {
  const edges = getDirectPredecessors(node.id, context.graph.edges)
  const inputs: Record<string, unknown> = {}
  for (const e of edges) {
    const nodeOut = context.outputs.get(e.source)
    if (nodeOut) inputs[e.source] = nodeOut.output
  }
  return inputs
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

const triggerRunners: Record<string, (node: PipelineNode, context: ExecutionContext) => Promise<unknown>> = {
  async manualTrigger(node, _context) {
    return { triggered: true, source: "manual", timestamp: new Date().toISOString(), json: _context.input ?? {} }
  },
  async cronTrigger(node, _context) {
    const cron = (node.config.cronExpression as string) ?? "*/5 * * * *"
    return { triggered: true, source: "cron", cron, timestamp: new Date().toISOString(), json: {} }
  },
  async webhookTrigger(node, _context) {
    const path = (node.config.webhookUrl as string) ?? "/webhook/default"
    return { triggered: true, source: "webhook", path, timestamp: new Date().toISOString(), json: _context.input ?? {} }
  },
  async channelTrigger(node, _context) {
    const channel = (node.config.channel as string) ?? "email"
    return { triggered: true, source: "channel", channel, timestamp: new Date().toISOString(), json: _context.input ?? {} }
  },
}

function modelFromNode(node: PipelineNode): string {
  return (node.config.model as string) ?? "tinyllama"
}

const aiRunners: Record<string, (node: PipelineNode, context: ExecutionContext) => Promise<unknown>> = {
  async aiAgent(node, context) {
    const model = modelFromNode(node)
    const maxIterations = (node.config.maxIterations as number) ?? 5
    const systemPrompt = (node.config.systemPrompt as string) ?? ""
    const prompt = (node.config.prompt as string) ?? "Execute your task based on the input data."
    const exprCtx = buildExpressionContext(context)
    const resolvedPrompt = resolveValue(prompt, exprCtx) as string
    const resolvedSystem = resolveValue(systemPrompt, exprCtx) as string
    const predecessorData = predecessorsInput(node, context)
    const enrichedPrompt = `Task: ${resolvedPrompt}\n\nInput data: ${JSON.stringify(predecessorData)}`
    return reactAgentLoop(node, context, enrichedPrompt, resolvedSystem, model, maxIterations)
  },
  async contentWriter(node, context) {
    const model = modelFromNode(node)
    const predecessorData = predecessorsInput(node, context)
    const exprCtx = buildExpressionContext(context)
    const topic = resolveValue(node.config.topic ?? "general", exprCtx) as string
    const tone = (node.config.tone as string) ?? "professional"
    const response = await llmGenerate(
      `Write a ${tone} article about "${topic}". Format as plain text with paragraphs.`,
      "You are a professional content writer. Write engaging, well-structured content.",
      model, context,
    )
    return { topic, tone, input: predecessorData, content: response, json: { content: response, input: predecessorData }, wordCount: response.split(/\s+/).length }
  },
  async dataExtractor(node, context) {
    const model = modelFromNode(node)
    const predecessorData = predecessorsInput(node, context)
    const fields = ((node.config.fields as string) ?? "name,email").split(",").map((f) => f.trim())
    const text = JSON.stringify(predecessorData)
    const response = await llmGenerate(
      `Extract these fields from the text: ${fields.join(", ")}\n\nText: ${text.slice(0, 2000)}\n\nReturn as valid JSON with only those fields.`,
      "You are a data extraction assistant. Return only valid JSON.",
      model, context,
    )
    let extracted: Record<string, unknown> = {}
    try { extracted = JSON.parse(response) } catch { extracted = { raw: response } }
    return { fields, input: predecessorData, extracted, json: { extracted, fields } }
  },
  async classifier(node, context) {
    const model = modelFromNode(node)
    const predecessorData = predecessorsInput(node, context)
    const categories = ((node.config.categories as string) ?? "positive,negative,neutral").split(",").map((c: string) => c.trim())
    const text = JSON.stringify(predecessorData)
    const response = await llmGenerate(
      `Classify the following into one of these categories: ${categories.join(", ")}\n\n${text.slice(0, 1500)}\n\nRespond with ONLY the category name.`,
      "You are a text classifier. Respond with a single category name only.",
      model, context,
    )
    const category = categories.find((c) => response.toLowerCase().includes(c.toLowerCase())) ?? categories[0]!
    const confidence = response.toLowerCase().includes(category.toLowerCase()) ? 0.85 : 0.6
    return { categories, input: predecessorData, category, confidence, json: { category, confidence } }
  },
  async summarizer(node, context) {
    const model = modelFromNode(node)
    const predecessorData = predecessorsInput(node, context)
    const exprCtx = buildExpressionContext(context)
    const text = resolveValue(node.config.text ?? JSON.stringify(predecessorData), exprCtx) as string
    const response = await llmGenerate(
      `Summarize the following text concisely:\n\n${text.slice(0, 3000)}`,
      "You are a text summarizer. Provide a concise summary capturing the key points.",
      model, context,
    )
    return { inputLength: text.length, summary: response, json: { summary: response, originalLength: text.length } }
  },
  async webResearcher(node, context) {
    const model = modelFromNode(node)
    const exprCtx = buildExpressionContext(context)
    const query = resolveValue(node.config.query ?? "", exprCtx) as string
    const predecessorData = predecessorsInput(node, context)
    let webResults = ""
    try {
      const webRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`, { signal: AbortSignal.timeout(5000) })
      if (webRes.ok) {
        const webData = await webRes.json() as any
        webResults = webData.AbstractText || webData.Results?.[0]?.Text || ""
      }
    } catch { /* fallback to LLM */ }
    const response = webResults || await llmGenerate(
      `Based on your knowledge, provide information about: ${query}`,
      "You are a research assistant. Provide factual information.",
      model, context,
    )
    return { query, input: predecessorData, results: [response], json: { query, resultCount: 1, results: [response] } }
  },
  async imageGenerator(node, context) {
    const exprCtx = buildExpressionContext(context)
    const prompt = resolveValue(node.config.prompt ?? "", exprCtx) as string
    const size = (node.config.size as string) ?? "1024x1024"
    const hfToken = process.env.HF_TOKEN || ""

    let url = ""
    if (hfToken) {
      try {
        const res = await fetch("https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev", {
          method: "POST",
          headers: { Authorization: `Bearer ${hfToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: prompt }),
          signal: AbortSignal.timeout(30_000),
        })
        if (res.ok) {
          const blob = await res.blob()
          url = `data:image/png;base64,${Buffer.from(await blob.bytes()).toString("base64")}`
        } else {
          const errText = await res.text().catch(() => "unknown")
          url = `[HF API error ${res.status}: ${errText.slice(0, 100)}]`
        }
      } catch (err) {
        url = `[Image generation error: ${err}]`
      }
    }

    return { prompt, size, url, json: { prompt, size, url: url.startsWith("data:") ? "base64_image" : url } }
  },
}

const pipelineAgentTools: AgentTool[] = [
  {
    name: "webSearch",
    description: "Search the web for information",
    parameters: { query: { type: "string", description: "Search query" } },
    async execute(args: Record<string, unknown>): Promise<string> {
      const query = (args.query as string)?.trim() || "latest news"
      try {
        const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`, { signal: AbortSignal.timeout(5000) })
        if (!res.ok) return `[web search error: ${res.status}]`
        const data = await res.json() as any
        return data.AbstractText || data.Results?.[0]?.Text || `[no results for "${query}"]`
      } catch (err) {
        return `[web search unavailable: ${err}]`
      }
    },
  },
  {
    name: "calculator",
    description: "Evaluate a mathematical expression",
    parameters: { expression: { type: "string", description: "Math expression to evaluate" } },
    async execute(args: Record<string, unknown>): Promise<string> {
      const expression = (args.expression as string) || (args.input as string) || ""
      try {
        const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, "")
        const fn = new Function(`"use strict"; return (${sanitized})`)
        const result = fn()
        return String(result)
      } catch {
        return "[calculator error: invalid expression]"
      }
    },
  },
  {
    name: "currentTime",
    description: "Get the current date and time",
    parameters: {},
    async execute() {
      return new Date().toISOString()
    },
  },
  {
    name: "readFile",
    description: "Read a file (simulated in pipeline context)",
    parameters: { path: { type: "string", description: "File path to read" } },
    async execute(args: Record<string, unknown>): Promise<string> {
      const filePath = (args.path as string) || (args.input as string) || ""
      return `[readFile "${filePath}": simulated - tool not available in pipeline context]`
    },
  },
]

function wrapLLMAsProvider(llm: { complete(req: { model: string; messages: Array<{ role: string; content: string }>; temperature?: number; maxTokens?: number }): Promise<{ content: string; model: string }> }): ProviderFacade {
  return {
    id: "pipeline-adapter",
    baseUrl: "",
    async complete(req: CompletionRequest): Promise<CompletionResult> {
      const result = await llm.complete({
        model: req.model || "tinyllama",
        messages: req.messages.map((m: Message) => ({ role: m.role, content: typeof m.content === "string" ? m.content : "" })),
        temperature: req.temperature,
        maxTokens: req.maxTokens,
      })
      return {
        message: { role: "assistant", content: result.content || "[empty response]" },
        finish_reason: "stop",
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        model: result.model,
        provider: "pipeline-adapter",
      }
    },
    async stream(req: CompletionRequest, callbacks: StreamCallbacks): Promise<CompletionResult> {
      const result = await this.complete(req)
      const textContent = typeof result.message.content === "string" ? result.message.content : result.message.content.map((b) => (b.type === "text" ? b.text : "")).join("")
      callbacks.onChunk?.({ delta: { content: textContent }, model: result.model, provider: result.provider })
      callbacks.onDone?.(result)
      return result
    },
  }
}

async function reactAgentLoop(
  node: PipelineNode,
  context: ExecutionContext,
  initialPrompt: string,
  systemPrompt: string,
  model: string,
  maxIterations: number,
): Promise<unknown> {
  if (!context.llm) {
    return { model, prompt: initialPrompt, system: systemPrompt, response: "[No LLM provider available]", iterations: 0, steps: [] }
  }
  const provider = wrapLLMAsProvider(context.llm)
  const result = await runAgentLoop({
    provider,
    model: model || "tinyllama",
    systemPrompt,
    userMessage: initialPrompt,
    tools: pipelineAgentTools,
    maxIterations,
    maxTokens: 2000,
  })
  return {
    model,
    prompt: initialPrompt,
    system: systemPrompt,
    response: result.response,
    iterations: result.iterations,
    steps: result.steps,
    json: { response: result.response, iterations: result.iterations, steps: result.steps },
    usage: result.usage,
  }
}

const actionRunners: Record<string, (node: PipelineNode, context: ExecutionContext) => Promise<unknown>> = {
  async httpRequest(node, context) {
    const exprCtx = buildExpressionContext(context)
    const url = resolveValue(node.config.url ?? "", exprCtx) as string
    const method = (node.config.method as string) ?? "GET"
    const headersRaw = resolveValue(node.config.headers ?? "{}", exprCtx) as string
    const bodyRaw = node.config.body ? resolveValue(node.config.body as string, exprCtx) as string : undefined
    let headers: Record<string, string> = {}
    try { headers = JSON.parse(headersRaw) } catch { headers = {} }
    let body: string | undefined
    try { body = bodyRaw ? JSON.stringify(JSON.parse(bodyRaw ?? "{}")) : undefined } catch { body = bodyRaw }

    const res = await fetch(url, { method, headers, body, signal: context.abortSignal })
    const resBody = await res.text()
    let parsed: unknown
    try { parsed = JSON.parse(resBody) } catch { parsed = resBody }
    return { status: res.status, statusText: res.statusText, headers: Object.fromEntries(res.headers.entries()), body: parsed, json: { status: res.status, body: parsed } }
  },
  async databaseQuery(node, context) {
    const exprCtx = buildExpressionContext(context)
    const query = resolveValue(node.config.query ?? "", exprCtx) as string
    return { query, rows: [], rowCount: 0, json: { query, rowCount: 0, rows: [] } }
  },
  async sendEmail(node, context) {
    const exprCtx = buildExpressionContext(context)
    const to = resolveValue(node.config.to ?? "", exprCtx) as string
    const subject = resolveValue(node.config.subject ?? "", exprCtx) as string
    const body = resolveValue(node.config.body ?? "", exprCtx) as string
    const smtpHost = process.env.SMTP_HOST || ""
    const smtpUser = process.env.SMTP_USER || ""
    const smtpPass = process.env.SMTP_PASS || ""
    const smtpFrom = process.env.SMTP_FROM || "noreply@flowmind.ai"

    let sent = false
    let error = ""
    if (smtpHost && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost, port: parseInt(process.env.SMTP_PORT || "587", 10),
          secure: process.env.SMTP_SECURE === "true",
          auth: { user: smtpUser, pass: smtpPass },
        })
        await transporter.sendMail({ from: smtpFrom, to, subject, text: body })
        sent = true
      } catch (err) {
        error = String(err)
      }
    }

    return { to, subject, body, sent, error, json: { sent, to, subject } }
  },
  async sendMessage(node, context) {
    const exprCtx = buildExpressionContext(context)
    const channel = (node.config.channel as string) ?? "slack"
    const message = resolveValue(node.config.message ?? "", exprCtx) as string
    const webhookUrl = (node.config.webhookUrl as string) || ""

    let sent = false
    let error = ""
    if (webhookUrl) {
      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: message }),
          signal: AbortSignal.timeout(10_000),
        })
        sent = res.ok
      } catch (err) {
        error = String(err)
      }
    }

    const apiUrl = process.env.APP_URL || "http://localhost:3001"
    if (!webhookUrl) {
      try {
        const token = process.env.INTERNAL_API_TOKEN || ""
        const res = await fetch(`${apiUrl}/trpc/webhooks.ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ channel, body: { text: message } }),
          signal: AbortSignal.timeout(5_000),
        })
        if (res.ok) sent = true
      } catch (err) {
        error = String(err)
      }
    }

    return { channel, message, sent, error, json: { sent, channel, message } }
  },
  async codeExecute(node, context) {
    const exprCtx = buildExpressionContext(context)
    const language = (node.config.language as string) ?? "javascript"
    const code = resolveValue(node.config.code ?? "", exprCtx) as string

    if (language === "javascript" || language === "typescript") {
      const predecessorData = predecessorsInput(node, context)
      const vmGlobals = { $json: exprCtx.$json, $node: exprCtx.$node, $env: exprCtx.$env, $items: exprCtx.$items, $run: exprCtx.$run, console, Buffer, setTimeout, Math, JSON, Date, Array, Object, String, Number, Boolean, RegExp, Map, Set, Promise }
      const fn = new Function(...Object.keys(vmGlobals), `"use strict"; ${code}`)
      const result = await fn(...Object.values(vmGlobals))
      return { language, code, result, json: { result, type: typeof result } }
    }

    return { language, code, result: `[${language} execution simulated]`, json: { result: null } }
  },
  async subPipeline(node, context) {
    const subPipelineId = (node.config.pipelineId as string) ?? ""
    if (!context.subPipelineRunner) throw new Error("Sub-pipeline runner not available")
    const predecessorData = predecessorsInput(node, context)
    const result = await context.subPipelineRunner.run(subPipelineId, predecessorData, context)
    return { subPipelineId, result, json: { subPipelineId, result } }
  },
  async openhumanMessage(node, context) {
    const exprCtx = buildExpressionContext(context)
    const message = resolveValue(node.config.message ?? "", exprCtx) as string
    const conversationId = (node.config.conversationId as string) ?? ""
    const apiKey = (node.config.apiKey as string) ?? process.env.OPENHUMAN_API_KEY ?? ""
    const baseUrl = (node.config.baseUrl as string) ?? "https://api.openhuman.ai/v1"

    if (!apiKey) return { error: "No OpenHuman API key configured", sent: false }

    try {
      const res = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ conversation_id: conversationId, message }),
        signal: AbortSignal.timeout(15_000),
      })
      const data = await res.json() as Record<string, unknown>
      return { sent: res.ok, conversationId, messageId: data.id, json: { sent: res.ok, conversationId, response: data } }
    } catch (err) {
      return { error: String(err), sent: false }
    }
  },
}

const flowRunners: Record<string, (node: PipelineNode, context: ExecutionContext) => Promise<unknown>> = {
  async condition(node, context) {
    const exprCtx = buildExpressionContext(context)
    const conditionExpr = (node.config.condition as string) ?? "true"
    const resolved = evaluateSimpleCondition(conditionExpr, exprCtx)
    return { condition: conditionExpr, result: resolved, json: { condition: conditionExpr, result: resolved } }
  },
  async switch(node, context) {
    const exprCtx = buildExpressionContext(context)
    const switchExpr = (node.config.expression as string) ?? "''"
    const resolved = resolveValue(switchExpr, exprCtx) as string
    const cases = ((node.config.cases as string) ?? "default").split(",").map((c: string) => c.trim())
    return { expression: switchExpr, value: resolved, cases, json: { expression: switchExpr, value: resolved, cases } }
  },
  async parallelFork(node, _context) {
    return { forked: true, branches: [], json: { forked: true, branchCount: 0 } }
  },
  async merge(node, context) {
    const predecessorData = predecessorsInput(node, context)
    return { merged: true, inputs: predecessorData, json: { merged: true, inputCount: Object.keys(predecessorData).length } }
  },
  async loop(node, context) {
    const iterations = (node.config.iterations as number) ?? 3
    return { loop: true, iterations, current: 1, json: { iterations, current: 1 } }
  },
  async wait(node, context) {
    const durationMs = (node.config.durationMs as number) ?? 1000
    await sleep(durationMs)
    return { waited: true, durationMs, json: { durationMs } }
  },
}

function evaluateSimpleCondition(condition: string, ctx: { $json: Record<string, unknown> }): boolean {
  try {
    const fn = new Function("$json", `"use strict"; return Boolean(${condition})`)
    return fn(ctx.$json)
  } catch {
    return condition === "true" || condition === "1"
  }
}

const integrationRunners: Record<string, (node: PipelineNode, context: ExecutionContext) => Promise<unknown>> = {
  async integrationNode(node, context) {
    const provider = (node.config.provider as string) ?? "generic"
    const predecessorData = predecessorsInput(node, context)
    const exprCtx = buildExpressionContext(context)
    const action = resolveValue(node.config.action ?? "execute", exprCtx) as string
    return { provider, action, input: predecessorData, result: `[${provider} ${action} simulated]`, json: { provider, action } }
  },
}

const allRunners: Record<string, (node: PipelineNode, context: ExecutionContext) => Promise<unknown>> = {
  ...triggerRunners,
  ...aiRunners,
  ...actionRunners,
  ...flowRunners,
  ...integrationRunners,
}

export function getRunner(nodeType: string): ((node: PipelineNode, context: ExecutionContext) => Promise<unknown>) | undefined {
  if (nodeType.startsWith("skill.")) {
    const skillName = nodeType.slice(6)
    return async (node, context) => {
      const skillId = node.config.skillId as string
      if (!skillId) return { error: "No skillId configured for skill node" }
      try {
        const { SkillEngine } = await import("@flowmind/skill-engine")
        const engine = new SkillEngine()
        const predecessorData = predecessorsInput(node, context)
        const inputStr = JSON.stringify(predecessorData)
        const result = await engine.execute(skillId, { userId: "system", input: inputStr })
        return JSON.parse(result.output)
      } catch (err) {
        return { error: `Skill "${skillName}" failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    }
  }
  return allRunners[nodeType]
}

export function executeNode(node: PipelineNode, context: ExecutionContext): Promise<NodeOutput> {
  const start = Date.now()
  const runner = getRunner(node.type)
  if (!runner) {
    return Promise.resolve(output(node, { error: `No runner for node type: ${node.type}` }, Date.now() - start, `Unknown node type: ${node.type}`))
  }
  return runner(node, context).then(
    (result) => output(node, result, Date.now() - start),
    (err) => output(node, { error: err.message }, Date.now() - start, err.message),
  )
}

export { triggerRunners, aiRunners, actionRunners, flowRunners, integrationRunners }
