import { evaluateExpression } from "./expressions"

export type TransformMode = "map" | "select" | "rename" | "summary"

export interface TransformConfig {
  mode?: TransformMode
  input?: unknown
  mapping?: Record<string, unknown>
  select?: string[]
  rename?: Record<string, string>
  summary?: Record<string, Record<string, unknown>>
}

function resolveValue(value: unknown, source: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    if (value.startsWith("$json")) return evaluateExpression(value.trim(), { $json: source } as never)
    if (value.startsWith("{{") && value.endsWith("}}")) {
      const inner = value.slice(2, -2).trim()
      const result = evaluateExpression(inner, { $json: source } as never)
      return result ?? value
    }
  }
  return value
}

function getPath(value: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean)
  let current = value
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

function mapItems(items: unknown[], mapping: Record<string, unknown>): Record<string, unknown>[] {
  return items.map((item) => {
    const record = (typeof item === "object" && item !== null ? item : { value: item }) as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [key, expr] of Object.entries(mapping)) {
      const resolved = resolveValue(expr, record)
      out[key] = typeof resolved === "string" && resolved.startsWith("$json")
        ? getPath(item, resolved.slice(5))
        : resolved
    }
    return out
  })
}

function selectKeys(items: unknown[], keys: string[]): Record<string, unknown>[] {
  return items.map((item) => {
    const record = (typeof item === "object" && item !== null ? item : { value: item }) as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of keys) out[key] = record[key]
    return out
  })
}

function renameKeys(items: unknown[], rename: Record<string, string>): Record<string, unknown>[] {
  return items.map((item) => {
    const record = (typeof item === "object" && item !== null ? item : { value: item }) as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [nextKey, oldKey] of Object.entries(rename)) out[nextKey] = record[oldKey]
    for (const [key, val] of Object.entries(record)) {
      if (!Object.values(rename).includes(key)) out[key] = val
    }
    return out
  })
}

function numeric(values: unknown[]): number[] {
  return values.filter((v) => typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)))).map(Number)
}

function summarizeItems(items: unknown[], summary: Record<string, Record<string, unknown>>): Record<string, unknown> {
  const record = (typeof items[0] === "object" && items[0] !== null ? items[0] : {}) as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [field, ops] of Object.entries(summary)) {
    const values = items.map((item) => (typeof item === "object" && item !== null ? (item as Record<string, unknown>)[field] : undefined))
    for (const [op, _enabled] of Object.entries(ops ?? {})) {
      if (!_enabled) continue
      const nums = numeric(values)
      switch (op) {
        case "count": out[`${op}_${field}`] = values.length; break
        case "sum": out[`${op}_${field}`] = nums.reduce((a, b) => a + b, 0); break
        case "avg": out[`${op}_${field}`] = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0; break
        case "min": out[`${op}_${field}`] = nums.length ? Math.min(...nums) : undefined; break
        case "max": out[`${op}_${field}`] = nums.length ? Math.max(...nums) : undefined; break
        case "distinct": out[`${op}_${field}`] = Array.from(new Set(values.filter((v) => v !== undefined).map((v) => JSON.stringify(v)))).map((s) => JSON.parse(s)); break
        default: break
      }
    }
  }
  out.count = items.length
  return out
}

function asItems(input: unknown): unknown[] {
  if (Array.isArray(input)) return input
  if (input && typeof input === "object" && "items" in (input as Record<string, unknown>) && Array.isArray((input as Record<string, unknown>).items)) {
    return (input as Record<string, unknown>).items as unknown[]
  }
  return [input]
}

export function transform<const T extends TransformConfig>(config: T): unknown {
  const mode = config.mode ?? "map"
  const items = asItems(config.input)
  const inputRecord = typeof items[0] === "object" && items[0] !== null ? items[0] as Record<string, unknown> : {}

  switch (mode) {
    case "map": {
      const mapping = (config.mapping ?? {}) as Record<string, unknown>
      if (items.length === 1) return mapItems(items, mapping)[0] ?? {}
      return mapItems(items, mapping)
    }
    case "select": {
      const keys = (config.select ?? []) as string[]
      const selected = selectKeys(items, keys)
      return items.length === 1 ? selected[0] ?? {} : selected
    }
    case "rename": {
      const rename = (config.rename ?? {}) as Record<string, string>
      const renamed = renameKeys(items, rename)
      return items.length === 1 ? renamed[0] ?? {} : renamed
    }
    case "summary": {
      const summary = (config.summary ?? {}) as Record<string, Record<string, unknown>>
      const single = summarizeItems(items, summary)
      return { ...inputRecord, summary: single }
    }
    default:
      throw new Error(`Unknown transform mode: ${String(mode)}`)
  }
}
