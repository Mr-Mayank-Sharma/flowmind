import type { PipelineNode, ExecutionContext, NodeRunner, NodeOutput } from "./types"
import { resolveValue, buildExpressionContext } from "./expressions"
import { kindForNodeType } from "./types"
import { getDirectPredecessors } from "./graph"
import { runAgentLoop, resolveDefaultOllamaModel, type AgentTool, type ProviderFacade, type CompletionRequest, type CompletionResult, type StreamCallbacks, type Message } from "@flowmind/llm-router"
import { BlockedUrlError, fetchPublic } from "./network-guard"
import { runCodeSandboxed, sanitizeEnv } from "./code-sandbox"
import { transform as applyTransform } from "./transform"
import { configuredFileRoot, resolveWithinRoot, assertWithinRoot } from "./file-root"

import nodemailer from "nodemailer"
import fs from "node:fs"
import path from "node:path"

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
  async pollingTrigger(node, context) {
    const endpoint = (node.config.endpoint as string) ?? ""
    const intervalMs = (node.config.intervalMs as number) ?? 60000
    let payload: unknown = { polled: true, time: new Date().toISOString() }
    if (endpoint) {
      try {
        const res = await fetchPublic(endpoint, { timeoutMs: 10_000 })
        payload = await res.json()
      } catch (err) {
        payload = { error: String(err), time: new Date().toISOString() }
      }
    }
    return { triggered: true, source: "polling", endpoint, intervalMs, payload, timestamp: new Date().toISOString(), json: payload }
  },
}

function modelFromNode(node: PipelineNode): string {
  return (node.config.model as string) ?? ""
}

async function resolveNodeModel(node: PipelineNode): Promise<string> {
  const configured = modelFromNode(node)
  if (configured) {
    const resolved = await resolveDefaultOllamaModel(configured)
    return resolved || configured
  }
  return (await resolveDefaultOllamaModel()) || "tinyllama"
}

const aiRunners: Record<string, (node: PipelineNode, context: ExecutionContext) => Promise<unknown>> = {
  async aiAgent(node, context) {
    const model = await resolveNodeModel(node)
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
    const model = await resolveNodeModel(node)
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
    const model = await resolveNodeModel(node)
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
    const model = await resolveNodeModel(node)
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
    const model = await resolveNodeModel(node)
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
    const model = await resolveNodeModel(node)
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
  async ragRetrieve(node, context) {
    const exprCtx = buildExpressionContext(context)
    const text = resolveValue(node.config.query ?? node.config.text ?? "", exprCtx) as string
    const topK = (node.config.topK as number) ?? 5
    const filters = node.config.filters as Record<string, unknown> | undefined
    if (!context.ragSearch) {
      return { query: text, results: [], error: "No RAG search engine available", json: { query: text, resultCount: 0, results: [] } }
    }
    const results = await context.ragSearch({ text, topK, filters })
    return {
      query: text,
      results,
      json: {
        query: text,
        resultCount: results.length,
        results: results.map((r) => ({ id: r.id, score: r.score, content: r.content })),
      },
    }
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

    if (context.abortSignal.aborted) {
      return { status: 0, error: "Request aborted", url, json: { status: 0, error: "aborted" } }
    }

    const res = await fetchPublic(url, {
      method,
      headers,
      body,
      timeoutMs: 15_000,
    })
    const resBody = await res.text()
    let parsed: unknown
    try { parsed = JSON.parse(resBody) } catch { parsed = resBody }
    return { status: res.status, statusText: res.statusText, headers: Object.fromEntries(res.headers.entries()), body: parsed, json: { status: res.status, body: parsed } }
  },
  async databaseQuery(node, context) {
    const exprCtx = buildExpressionContext(context)
    const query = resolveValue(node.config.query ?? "", exprCtx) as string
    const configuredConnection = (node.config.connectionString as string) ?? (node.config.url as string) ?? ""

    if (configuredConnection) {
      return {
        query, rows: [], rowCount: 0,
        error: "databaseQuery with a custom connection string is not supported. Use the server-configured DATABASE_URL instead.",
        json: { query, rowCount: 0, rows: [], error: "custom connection string not supported" },
      }
    }

    const connectionString = process.env.DATABASE_URL ?? ""
    if (!connectionString) {
      return { query, rows: [], rowCount: 0, error: "No server DATABASE_URL configured", json: { query, rowCount: 0, rows: [], error: "No database URL" } }
    }

    const guardError = assertSafeReadOnlySql(query)
    if (guardError) {
      return { query, rows: [], rowCount: 0, error: guardError, json: { query, rowCount: 0, rows: [], error: guardError } }
    }

    try {
      const { Client } = await import("pg")
      const client = new Client({ connectionString })
      await client.connect()

      try {
        const result = await client.query(query)
        return {
          query,
          rows: result.rows,
          rowCount: result.rowCount ?? 0,
          fields: result.fields?.map((f: any) => f.name) ?? [],
          json: { query, rowCount: result.rowCount ?? 0, rows: result.rows },
        }
      } finally {
        await client.end()
      }
    } catch (err: any) {
      return { query, rows: [], rowCount: 0, error: err.message, json: { query, rowCount: 0, rows: [], error: err.message } }
    }
  },
  async sendEmail(node, context) {
    const exprCtx = buildExpressionContext(context)
    const to = resolveValue(node.config.to ?? "", exprCtx) as string
    const subject = resolveValue(node.config.subject ?? "", exprCtx) as string
    const body = resolveValue(node.config.body ?? "", exprCtx) as string

    // Per-user SMTP credential (provider type "smtp") takes precedence over env fallback.
    let smtpConfig: { host: string; port: number; user: string; pass: string; from: string; secure: boolean } | null = null
    try {
      const creds = await context.credentialResolver?.getCredentialsByType("smtp")
      const cred = creds?.[0]
      if (cred) {
        const c = cred.config as Record<string, unknown>
        if (c && typeof c.host === "string" && c.host) {
          smtpConfig = {
            host: c.host,
            port: c.port != null ? Number(c.port) : 587,
            user: typeof c.user === "string" ? c.user : "",
            pass: typeof c.pass === "string" ? c.pass : "",
            from: typeof c.from === "string" ? c.from : "noreply@flowmind.ai",
            secure: c.secure === true || c.secure === "true",
          }
        }
      }
    } catch {
      smtpConfig = null
    }

    if (!smtpConfig) {
      const host = process.env.SMTP_HOST || ""
      const user = process.env.SMTP_USER || ""
      const pass = process.env.SMTP_PASS || ""
      if (host && user && pass) {
        smtpConfig = {
          host,
          port: parseInt(process.env.SMTP_PORT || "587", 10),
          user, pass,
          from: process.env.SMTP_FROM || "noreply@flowmind.ai",
          secure: process.env.SMTP_SECURE === "true",
        }
      }
    }

    let sent = false
    let error = ""
    if (!smtpConfig) {
      error = "No SMTP configuration found (set SMTP_HOST/USER/PASS or add an 'smtp' provider credential)"
    } else if (!to) {
      error = "sendEmail requires a 'to' recipient"
    } else {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpConfig.host, port: smtpConfig.port,
          secure: smtpConfig.secure,
          auth: smtpConfig.user ? { user: smtpConfig.user, pass: smtpConfig.pass } : undefined,
        })
        await transporter.sendMail({ from: smtpConfig.from, to, subject, text: body })
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
      if (process.env.PIPELINE_CODE_EXECUTE_ENABLED === "false") {
        return { language, code, result: null, disabled: true, error: "codeExecute is disabled by configuration", json: { result: null, disabled: true } }
      }
      const predecessorData = predecessorsInput(node, context)
      const globals: Record<string, unknown> = {
        $json: exprCtx.$json,
        $node: exprCtx.$node,
        $env: sanitizeEnv(process.env ?? {}),
        $items: exprCtx.$items,
        $run: exprCtx.$run,
        $input: context.input,
        $predecessors: predecessorData,
      }
      try {
        const { output, console: consoleLines } = await runCodeSandboxed(code, globals)
        return {
          language,
          code,
          result: output,
          console: consoleLines,
          json: { result: output, type: typeof output, console: consoleLines },
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { language, code, result: null, error: message, json: { result: null, error: message } }
      }
    }

    return { language, code, result: `[${language} execution simulated]`, json: { result: null } }
  },
  async sqliteQuery(node, context) {
    const exprCtx = buildExpressionContext(context)
    const query = resolveValue(node.config.query ?? "", exprCtx) as string
    const file = resolveValue(node.config.file ?? "", exprCtx) as string
    const configuredRoot = configuredFileRoot()

    // SQLite is permitted only against an explicitly-provided file, and only read-only
    // unless write access is explicitly enabled by the operator via PIPELINE_DB_ALLOW_WRITE.
    const writeAllowed = process.env.PIPELINE_DB_ALLOW_WRITE === "true"
    let dbPath: string
    try {
      dbPath = resolveWithinRoot(configuredRoot, file)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { query, file, rows: [], rowCount: 0, error: message, json: { query, rowCount: 0, rows: [], error: message } }
    }

    const trimmed = query.trim()
    if (!trimmed) return { query, file, rows: [], rowCount: 0, error: "sqliteQuery requires a query", json: { query, rowCount: 0, rows: [], error: "no query" } }

    const guardError = writeAllowed ? null : assertSafeReadOnlySql(trimmed)
    if (guardError) {
      return { query, file, rows: [], rowCount: 0, error: `${guardError} (writes require PIPELINE_DB_ALLOW_WRITE=true)`, json: { query, rowCount: 0, rows: [], error: guardError } }
    }

    if (!fs.existsSync(dbPath)) {
      return { query, file, rows: [], rowCount: 0, error: `SQLite database file does not exist: ${file} (create it via PIPELINE_DB_ALLOW_WRITE=true)`, json: { query, rowCount: 0, rows: [], error: "db file not found" } }
    }

    try {
      const { DatabaseSync } = await import("node:sqlite")
      const db = new DatabaseSync(dbPath, { readOnly: !writeAllowed })
      try {
        const stmt = db.prepare(trimmed)
        const fields = stmt.columns().map((c) => c.name)
        const rows = stmt.all() as unknown[]
        return {
          query, file, rows, rowCount: rows.length, fields,
          json: { query, rowCount: rows.length, rows },
        }
      } finally {
        db.close()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { query, file, rows: [], rowCount: 0, error: message, json: { query, rowCount: 0, rows: [], error: message } }
    }
  },
  async transform(node, context) {
    const exprCtx = buildExpressionContext(context)
    const predecessorData = predecessorsInput(node, context)
    const mode = (node.config.mode as string) ?? "map"
    const mapping = node.config.mapping as Record<string, unknown> | undefined
    const select = node.config.select as string[] | undefined
    const rename = node.config.rename as Record<string, string> | undefined
    const summaryCfg = node.config.summary as Record<string, Record<string, unknown>> | undefined
    const inputExpr = node.config.input as string | undefined

    let input: unknown = predecessorData
    if (inputExpr) {
      input = resolveValue(inputExpr, exprCtx)
    } else {
      // With a single predecessor, lift its output (preferring the `.json` payload)
      // so transforms operate directly on the upstream data.
      const keys = Object.keys(predecessorData)
      if (keys.length === 1) {
        const single = predecessorData[keys[0]!]
        if (single && typeof single === "object" && "json" in (single as Record<string, unknown>)) {
          input = (single as Record<string, unknown>).json
        } else {
          input = single
        }
      }
    }

    try {
      const result = applyTransform({ mode: mode as never, input, mapping, select, rename, summary: summaryCfg })
      return { mode, input, result, json: { mode, result } }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { mode, input, error: message, json: { mode, error: message } }
    }
  },
  async fileIo(node, context) {
    const exprCtx = buildExpressionContext(context)
    const action = (node.config.action as string) ?? "read"
    const file = resolveValue(node.config.file ?? "", exprCtx) as string
    const encoding: BufferEncoding = ((node.config.encoding as string) ?? "utf-8") as BufferEncoding
    const configuredRoot = configuredFileRoot()

    let targetPath: string
    try {
      targetPath = resolveWithinRoot(configuredRoot, file)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { action, file, error: message, json: { action, error: message } }
    }

    try {
      if (action === "read") {
        if (!fs.existsSync(targetPath)) return { action, file, error: `File does not exist: ${file}`, json: { action, error: "file not found" } }
        const raw = fs.readFileSync(targetPath, encoding)
        const size = Buffer.byteLength(raw, "utf-8")
        let parsed: unknown = raw
        if (typeof raw === "string") {
          try { parsed = JSON.parse(raw) } catch { parsed = raw }
        }
        return { action, file, size, data: parsed, json: { action, file, size, data: parsed } }
      }
      if (action === "write") {
        const rawData = node.config.data
        const data = resolveValue(rawData, exprCtx)
        let serialized: string
        if (typeof data === "string") {
          serialized = data
        } else if (data === undefined || data === null) {
          serialized = ""
        } else {
          serialized = JSON.stringify(data)
        }
        fs.mkdirSync(path.dirname(targetPath), { recursive: true })
        fs.writeFileSync(targetPath, serialized, encoding)
        const size = Buffer.byteLength(serialized, "utf-8")
        return { action, file, size, written: true, json: { action, file, size, written: true } }
      }
      return { action, file, error: `Unknown fileIo action: ${action}`, json: { action, error: `unknown action: ${action}` } }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { action, file, error: message, json: { action, error: message } }
    }
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
  async parallelFork(node, context) {
    const exprCtx = buildExpressionContext(context)
    const branchCount = (node.config.branchCount as number) ?? 2
    const items = resolveValue(node.config.items ?? "[]", exprCtx) as string | unknown[]

    let itemList: unknown[]
    if (typeof items === "string") {
      try { itemList = JSON.parse(items) } catch { itemList = [items] }
    } else {
      itemList = Array.isArray(items) ? items : [items]
    }

    const branches = itemList.map((item, idx) => ({
      branchIndex: idx,
      item,
      status: "pending" as const,
    }))

    return {
      forked: true,
      branchCount: branches.length,
      branches,
      json: { forked: true, branchCount: branches.length, items: itemList },
    }
  },
  async merge(node, context) {
    const predecessorData = predecessorsInput(node, context)
    const allItems: unknown[] = []

    for (const [sourceId, data] of Object.entries(predecessorData)) {
      if (data && typeof data === "object" && "branches" in data && Array.isArray((data as any).branches)) {
        for (const branch of (data as any).branches) {
          if (branch.item !== undefined) allItems.push(branch.item)
        }
      } else if (Array.isArray(data)) {
        allItems.push(...data)
      } else {
        allItems.push(data)
      }
    }

    return { merged: true, inputs: predecessorData, items: allItems, json: { merged: true, inputCount: Object.keys(predecessorData).length, itemCount: allItems.length } }
  },
  async loop(node, context) {
    const iterations = (node.config.iterations as number) ?? 3
    const dataKey = (node.config.dataKey as string) ?? ""
    const predecessorData = predecessorsInput(node, context)

    let items: unknown[] = []
    if (dataKey && predecessorData[dataKey]) {
      items = Array.isArray(predecessorData[dataKey]) ? predecessorData[dataKey] as unknown[] : [predecessorData[dataKey]]
    } else {
      items = Array.from({ length: iterations }, (_, i) => i)
    }

    const results: unknown[] = []
    for (let i = 0; i < items.length; i++) {
      context.variables[`$loop.index`] = i
      context.variables[`$loop.item`] = items[i]
      context.variables[`$loop.total`] = items.length
      results.push({ index: i, item: items[i] })
    }

    return { loop: true, iterations: items.length, items, results, json: { iterations: items.length, items, results } }
  },
  async wait(node, context) {
    const durationMs = (node.config.durationMs as number) ?? 1000
    await sleep(durationMs)
    return { waited: true, durationMs, json: { durationMs } }
  },
  async humanApproval(node, context) {
    const exprCtx = buildExpressionContext(context)
    const message = resolveValue(node.config.message ?? "Approve this step?", exprCtx) as string
    const request = { message, nodeLabel: node.label, nodeId: node.id }
    const override = context.approvalOverrides?.[node.id]
    if (override) {
      return {
        status: override.approved ? "approved" : "rejected",
        approved: override.approved,
        note: override.note,
        request,
        overridden: true,
        json: { status: override.approved ? "approved" : "rejected", approved: override.approved, note: override.note ?? null },
      }
    }
    if (!context.requestApproval) {
      return {
        status: "awaiting_approval",
        approved: false,
        request,
        json: { status: "awaiting_approval", message, nodeId: node.id },
      }
    }
    const decision = await context.requestApproval(node.id, request)
    return {
      status: decision.approved ? "approved" : "rejected",
      approved: decision.approved,
      note: decision.note,
      request,
      json: { status: decision.approved ? "approved" : "rejected", approved: decision.approved, note: decision.note ?? null },
    }
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

const NON_READONLY_SQL = /^\s*(create|alter|drop|truncate|grant|revoke|insert|update|delete|merge|call|copy|vacuum|reindex|comment|do|import|prepare|execute|create\s+procedure|create\s+function)\b/i

function assertSafeReadOnlySql(query: string): string | null {
  const trimmed = query.trim()
  if (!trimmed) return "databaseQuery requires a query"
  if (/;/.test(trimmed.replace(/['"`][^'"]*['"`]/g, ""))) {
    return "databaseQuery only supports a single statement (no multi-statement / no trailing semicolons allowed)"
  }
  if (NON_READONLY_SQL.test(trimmed)) {
    return "databaseQuery only supports read-only SELECT queries (DDL/DML are blocked)"
  }
  return null
}

const integrationRunners: Record<string, (node: PipelineNode, context: ExecutionContext) => Promise<unknown>> = {
  async integrationNode(node, context) {
    const provider = (node.config.provider as string) ?? "generic"
    const predecessorData = predecessorsInput(node, context)
    const exprCtx = buildExpressionContext(context)
    const action = resolveValue(node.config.action ?? "execute", exprCtx) as string
    const config = node.config as Record<string, unknown>

    if (provider === "slack" || provider === "discord" || provider === "telegram" || provider === "whatsapp" || provider === "email") {
      try {
        const channelPayload = {
          channel: provider,
          action,
          channelId: config.channelId ?? "",
          message: config.message ?? JSON.stringify(predecessorData),
          ...config,
        }

        const apiUrl = process.env.APP_URL || "http://localhost:3001"
        const token = process.env.INTERNAL_API_TOKEN || ""
        const res = await fetch(`${apiUrl}/trpc/webhooks.ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ channel: provider, body: channelPayload }),
          signal: AbortSignal.timeout(10_000),
        })

        if (res.ok) {
          const data = await res.json()
          return { provider, action, input: predecessorData, result: data, sent: true, json: { provider, action, sent: true } }
        }
        return { provider, action, input: predecessorData, result: `Channel send failed: ${res.status}`, sent: false, json: { provider, action, sent: false } }
      } catch (err) {
        return { provider, action, input: predecessorData, result: `Channel error: ${err}`, sent: false, error: String(err), json: { provider, action, sent: false } }
      }
    }

    if (provider === "http" || provider === "api") {
      const url = (config.url as string) ?? ""
      const method = (config.method as string) ?? "POST"
      const headers = (config.headers as Record<string, string>) ?? {}
      const body = config.body ?? predecessorData

      try {
        const res = await fetchPublic(
          url,
          { method, headers: { "Content-Type": "application/json", ...headers }, body: method !== "GET" ? JSON.stringify(body) : undefined, timeoutMs: 15_000 },
        )
        const data = await res.json()
        return { provider, action, status: res.status, result: data, json: { provider, action, status: res.status } }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { provider, action, error: message, blocked: err instanceof BlockedUrlError, json: { provider, action, error: message } }
      }
    }

    return { provider, action, input: predecessorData, result: `[${provider} ${action} - no handler registered]`, json: { provider, action } }
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
