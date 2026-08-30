import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { executeNode } from "../runners"
import type { PipelineNode, ExecutionContext, PipelineGraph } from "../types"

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    runId: "test-run",
    pipelineId: "test-pipeline",
    graph: { nodes: [], edges: [] },
    input: {},
    outputs: new Map(),
    variables: {},
    staticData: {},
    nodeStaticData: new Map(),
    binaryData: new Map(),
    abortSignal: new AbortController().signal,
    ...overrides,
  }
}

describe("sqliteQuery node", () => {
  let root: string
  let dbFile: string

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "fm-sqlite-"))
    dbFile = path.join(root, "test.db")
    process.env.PIPELINE_FILE_ROOT = root
    const { DatabaseSync } = await import("node:sqlite") as typeof import("node:sqlite")
    const db = new DatabaseSync(dbFile)
    db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, qty INTEGER)")
    const ins = db.prepare("INSERT INTO items (name, qty) VALUES (?, ?)")
    ins.run("apple", 3)
    ins.run("banana", 5)
    db.close()
  })

  afterAll(() => {
    delete process.env.PIPELINE_FILE_ROOT
    fs.rmSync(root, { recursive: true, force: true })
  })

  function node(config: Record<string, unknown>): PipelineNode {
    return { id: "n1", type: "sqliteQuery", label: "SQLite", position: { x: 0, y: 0 }, config }
  }

  it("returns rows from a read-only SELECT", async () => {
    const result = await executeNode(
      node({ file: "test.db", query: "SELECT name, qty FROM items ORDER BY qty DESC" }),
      makeContext(),
    )
    const out = result.output as any
    expect(out.error).toBeUndefined()
    expect(out.rowCount).toBe(2)
    expect(out.rows).toEqual([
      { name: "banana", qty: 5 },
      { name: "apple", qty: 3 },
    ])
  })

  it("refuses a non-SELECT statement when writes are not enabled", async () => {
    process.env.PIPELINE_DB_ALLOW_WRITE = "false"
    const result = await executeNode(node({ file: "test.db", query: "DELETE FROM items WHERE qty = 5" }), makeContext())
    const out = result.output as any
    expect(out.rowCount).toBe(0)
    expect(out.error).toMatch(/read-only|blocked|DDL/i)
  })

  it("refuses a path that escapes the configured root", async () => {
    const result = await executeNode(node({ file: "../outside.db", query: "SELECT 1" }), makeContext())
    const out = result.output as any
    expect(out.error).toMatch(/escapes/i)
  })
})

describe("transform node", () => {
  function makeNode(config: Record<string, unknown>, id = "n1"): PipelineNode {
    return { id, type: "transform", label: "Transform", position: { x: 0, y: 0 }, config }
  }

  it("maps input fields via mapping", async () => {
    const prev: PipelineNode = { id: "prev", type: "httpRequest", label: "P", position: { x: 0, y: 0 }, config: {} }
    const ctx = makeContext()
    ctx.outputs.set("prev", { nodeId: "prev", nodeType: "httpRequest", output: { json: { name: "Ada", age: 36 } }, durationMs: 1, timestamp: Date.now() })
    ctx.graph = { nodes: [prev, makeNode({ mode: "map", mapping: { full: "{{ $json.name }}", years: "{{ $json.age }}" } })], edges: [{ id: "e", source: "prev", target: "n1" }] }
    const result = await executeNode(makeNode({ mode: "map", mapping: { full: "{{ $json.name }}", years: "{{ $json.age }}" } }), ctx)
    const out = result.output as any
    expect(out.result).toEqual({ full: "Ada", years: 36 })
  })

  function withPredecessor(data: unknown): { ctx: ExecutionContext; node: PipelineNode } {
    const prev: PipelineNode = { id: "prev", type: "httpRequest", label: "P", position: { x: 0, y: 0 }, config: {} }
    const ctx = makeContext()
    ctx.outputs.set("prev", { nodeId: "prev", nodeType: "httpRequest", output: data, durationMs: 1, timestamp: Date.now() })
    ctx.graph = { nodes: [prev, makeNode({})], edges: [{ id: "e1", source: "prev", target: "n1" }] }
    return { ctx, node: makeNode({}) }
  }

  it("selects a subset of keys", async () => {
    const { ctx } = withPredecessor({ json: { a: 1, b: 2, c: 3 } })
    const result = await executeNode(makeNode({ mode: "select", select: ["a", "c"] }), ctx)
    const out = result.output as any
    expect(out.result).toEqual({ a: 1, c: 3 })
  })

  it("renames keys", async () => {
    const { ctx } = withPredecessor({ json: { userId: 42, name: "Ada" } })
    const result = await executeNode(makeNode({ mode: "rename", rename: { id: "userId" } }), ctx)
    const out = result.output as any
    expect(out.result).toEqual({ id: 42, name: "Ada" })
  })

  it("computes a numeric summary", async () => {
    const { ctx } = withPredecessor({ json: { items: [{ qty: 2 }, { qty: 4 }, { qty: 6 }] } })
    const result = await executeNode(makeNode({ mode: "summary", summary: { qty: { sum: true, avg: true, count: true } } }), ctx)
    const out = result.output as any
    expect(out.result.summary).toMatchObject({ sum_qty: 12, avg_qty: 4, count: 3 })
  })
})

describe("fileIo node", () => {
  let root: string

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "fm-fileio-"))
    process.env.PIPELINE_FILE_ROOT = root
  })

  afterEach(() => {
    delete process.env.PIPELINE_FILE_ROOT
    fs.rmSync(root, { recursive: true, force: true })
  })

  function node(config: Record<string, unknown>): PipelineNode {
    return { id: "n1", type: "fileIo", label: "File", position: { x: 0, y: 0 }, config }
  }

  it("writes and reads a JSON file inside the root", async () => {
    const write = await executeNode(node({ action: "write", file: "out/data.json", data: { a: 1, b: "two" } }), makeContext())
    expect((write.output as any).written).toBe(true)

    const read = await executeNode(node({ action: "read", file: "out/data.json" }), makeContext())
    const out = read.output as any
    expect(out.data).toEqual({ a: 1, b: "two" })
    expect(out.size).toBeGreaterThan(0)
  })

  it("refuses a path that escapes the root via traversal", async () => {
    const result = await executeNode(node({ action: "write", file: "../../etc/evil.txt", data: "x" }), makeContext())
    expect((result.output as any).error).toMatch(/escapes/i)
  })

  it("refuses an absolute path", async () => {
    const result = await executeNode(node({ action: "read", file: "C:/Windows/win.ini" }), makeContext())
    expect((result.output as any).error).toMatch(/absolute/i)
  })
})
