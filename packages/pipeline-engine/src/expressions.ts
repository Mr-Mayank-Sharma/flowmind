import type { ExecutionContext, NodeOutput, BinaryDataEntry } from "./types"

const EXPRESSION_RE = /\{\{\s*(.+?)\s*\}\}/g

function hasExpressionMarkers(value: string): boolean {
  return /\{\{/.test(value) && /\}\}/.test(value)
}

export interface ExpressionContext {
  $json: Record<string, unknown>
  $node: Record<string, Record<string, unknown>>
  $items: unknown[]
  $env: Record<string, string | undefined>
  $now: Date
  $run: Record<string, unknown>
  $binary: Record<string, BinaryDataEntry[]>
  $staticData: Record<string, unknown>
}

export function buildExpressionContext(context: ExecutionContext): ExpressionContext {
  const $node: Record<string, Record<string, unknown>> = {}
  const $json: Record<string, unknown> = {}

  for (const [id, output] of context.outputs) {
    const data = output.output as Record<string, unknown> | undefined ?? {}
    $node[id] = data
    if (data.json && typeof data.json === "object") {
      Object.assign($json, data.json as Record<string, unknown>)
    }
    if (typeof data === "object" && !Array.isArray(data)) {
      Object.assign($json, data as Record<string, unknown>)
    }
  }

  const $binary: Record<string, BinaryDataEntry[]> = {}
  for (const [id, entries] of context.binaryData) {
    $binary[id] = entries
  }

  return {
    $json,
    $node,
    $items: Array.from(context.outputs.values()),
    $env: typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : {},
    $now: new Date(),
    $run: { id: context.runId, pipelineId: context.pipelineId, ...(typeof context.input === "object" && context.input !== null ? context.input as Record<string, unknown> : {}) },
    $binary,
    $staticData: context.staticData,
  }
}

function resolvePath(obj: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean)
  let current = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return current
}

export function evaluateExpression(expression: string, exprCtx: ExpressionContext): unknown {
  const trimmed = expression.trim()

  if (trimmed.startsWith("$json")) {
    return resolvePath(exprCtx.$json, trimmed.slice(5))
  }

  if (trimmed.startsWith("$node")) {
    const rest = trimmed.slice(5)
    const dotIdx = rest.indexOf(".", 1)
    if (dotIdx === -1) return undefined
    const nodeId = rest.slice(0, dotIdx)
    const fieldPath = rest.slice(dotIdx + 1)
    const nodeData = exprCtx.$node[nodeId]
    if (!nodeData) return undefined
    return resolvePath(nodeData, fieldPath)
  }

  if (trimmed.startsWith("$items")) {
    return exprCtx.$items
  }

  if (trimmed.startsWith("$env")) {
    const key = trimmed.slice(4).trim()
    return key ? process.env[key] : process.env
  }

  if (trimmed.startsWith("$now")) {
    return exprCtx.$now.toISOString()
  }

  if (trimmed.startsWith("$run")) {
    const rest = trimmed.slice(4).trim()
    return rest ? resolvePath(exprCtx.$run, rest) : exprCtx.$run
  }

  if (trimmed.startsWith("$binary")) {
    const rest = trimmed.slice(7).trim()
    return rest ? resolvePath(exprCtx.$binary, rest) : exprCtx.$binary
  }

  if (trimmed.startsWith("$staticData")) {
    const rest = trimmed.slice(11).trim()
    return rest ? resolvePath(exprCtx.$staticData, rest) : exprCtx.$staticData
  }

  return undefined
}

export function resolveExpressions(template: string, exprCtx: ExpressionContext): string {
  return template.replace(EXPRESSION_RE, (_, expr: string) => {
    const result = evaluateExpression(expr.trim(), exprCtx)
    if (result === null || result === undefined) return ""
    if (typeof result === "object") return JSON.stringify(result)
    return String(result)
  })
}

export function resolveValue(value: unknown, exprCtx: ExpressionContext): unknown {
  if (typeof value === "string" && hasExpressionMarkers(value)) {
    return resolveExpressions(value, exprCtx)
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveValue(v, exprCtx))
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = resolveValue(v, exprCtx)
    }
    return result
  }
  return value
}

export function hasExpressions(value: string): boolean {
  return hasExpressionMarkers(value)
}
