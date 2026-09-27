import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest"
import { writeFileSync, unlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { McpExecutor, McpServerRegistry, McpConnectionPool, McpToolRouter, BUILT_IN_TOOLS } from "../index"
import type { McpExecutorContext, TokenStore } from "../index"

vi.mock("@flowmind/db", () => ({ prisma: {} }))

vi.mock("pg", () => {
  class MockClient {
    async connect() {}
    async query(_sql: string, _params?: unknown[]) {
      return { rows: [{ id: 1 }], rowCount: 1, fields: [{ name: "id" }] }
    }
    async end() {}
  }
  return { Client: MockClient }
})

const mockTokenStore: TokenStore = {
  getToken: async () => null,
  setToken: async () => {},
  refreshToken: async () => ({ accessToken: "", refreshToken: "", expiresAt: new Date(), provider: "test", scopes: [] }),
}

const makeExecutor = (context?: McpExecutorContext) =>
  new McpExecutor(new McpServerRegistry(), new McpConnectionPool(), new McpToolRouter(), mockTokenStore, context)

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body),
  json: async () => body,
  blob: async () => ({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }),
})

const STUBBED_TOOLS = [
  "flowmind.git.pr",
  "flowmind.db.query",
  "flowmind.slack.message",
  "flowmind.github.issue",
  "flowmind.notion.page",
  "flowmind.memory.search",
  "flowmind.skill.run",
  "flowmind.pipeline.trigger",
  "flowmind.image.generate",
  "flowmind.audio.transcribe",
]

describe("built-in tools", () => {
  it("marks all 10 previously-stubbed tools as implemented", () => {
    for (const name of STUBBED_TOOLS) {
      const tool = BUILT_IN_TOOLS.find((t) => t.name === name)
      expect(tool, name).toBeDefined()
      expect(tool!.implemented, name).toBe(true)
    }
  })
})

describe("flowmind.memory.search", () => {
  it("returns mapped results from the injected context engine", async () => {
    const contextEngine = {
      search: vi.fn(async () => [
        { id: "m1", content: "hello", score: 0.9, metadata: {} },
        { id: "m2", content: "world", score: 0.5, metadata: {} },
      ]),
    }
    const executor = makeExecutor({ contextEngine })
    const res = await executor.execute("flowmind.memory.search", { query: "hi", limit: 2 }, "u1")
    expect(res.success).toBe(true)
    expect(res.data).toEqual({
      query: "hi",
      count: 2,
      results: [
        { id: "m1", content: "hello", score: 0.9 },
        { id: "m2", content: "world", score: 0.5 },
      ],
    })
    expect(contextEngine.search).toHaveBeenCalledWith({ text: "hi", userId: "u1", topK: 2 })
  })

  it("fails loudly when no context engine is injected", async () => {
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.memory.search", { query: "hi" }, "u1")
    expect(res.success).toBe(false)
    expect(res.error).toContain("requires a context engine")
  })
})

describe("flowmind.skill.run", () => {
  it("executes via the injected skill engine", async () => {
    const skillEngine = {
      execute: vi.fn(async () => ({ output: "done", success: true, durationMs: 12 })),
    }
    const executor = makeExecutor({ skillEngine })
    const res = await executor.execute("flowmind.skill.run", { skillId: "s1", input: { a: 1 } }, "u1")
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ output: "done", success: true, durationMs: 12 })
    expect(skillEngine.execute).toHaveBeenCalledWith("s1", { userId: "u1", input: '{"a":1}' })
  })

  it("fails loudly when no skill engine is injected", async () => {
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.skill.run", { skillId: "s1" }, "u1")
    expect(res.success).toBe(false)
    expect(res.error).toContain("requires a skill engine")
  })
})

describe("flowmind.pipeline.trigger", () => {
  it("triggers via the injected callback", async () => {
    const triggerPipeline = vi.fn(async () => ({ runId: "r1", status: "RUNNING" }))
    const executor = makeExecutor({ triggerPipeline })
    const res = await executor.execute("flowmind.pipeline.trigger", { pipelineId: "p1", input: { x: 1 } }, "u1")
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ runId: "r1", status: "RUNNING" })
    expect(triggerPipeline).toHaveBeenCalledWith({ pipelineId: "p1", input: { x: 1 }, userId: "u1" })
  })

  it("fails loudly when no trigger is injected", async () => {
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.pipeline.trigger", { pipelineId: "p1" }, "u1")
    expect(res.success).toBe(false)
    expect(res.error).toContain("requires a pipeline trigger")
  })
})

describe("flowmind.db.query", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("fails loudly when DATABASE_URL is unset", async () => {
    vi.stubEnv("DATABASE_URL", "")
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.db.query", { connectionId: "default", sql: "SELECT 1" }, "u1")
    expect(res.success).toBe(false)
    expect(res.error).toContain("requires DATABASE_URL")
  })

  it("rejects DML through the read-only guard", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://x:y@localhost:5432/db")
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.db.query", { connectionId: "default", sql: "DELETE FROM users" }, "u1")
    expect(res.success).toBe(false)
    expect(res.error).toContain("read-only SELECT")
  })

  it("runs a read-only query and returns rows", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://x:y@localhost:5432/db")
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.db.query", { connectionId: "default", sql: "SELECT id FROM users" }, "u1")
    expect(res.success).toBe(true)
    expect(res.data).toEqual({
      sql: "SELECT id FROM users",
      rowCount: 1,
      fields: [{ name: "id" }],
      rows: [{ id: 1 }],
    })
  })
})

describe("flowmind.image.generate", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("fails loudly when HF_TOKEN is unset", async () => {
    vi.stubEnv("HF_TOKEN", "")
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.image.generate", { prompt: "a cat" }, "u1")
    expect(res.success).toBe(false)
    expect(res.error).toContain("requires HF_TOKEN")
  })

  it("returns a data URL from the HF API", async () => {
    vi.stubEnv("HF_TOKEN", "hf-test")
    const fetchMock = vi.fn(async () => jsonResponse({}))
    vi.stubGlobal("fetch", fetchMock)
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.image.generate", { prompt: "a cat" }, "u1")
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ url: "data:image/png;base64,AQID", format: "png" })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("surfaces API errors", async () => {
    vi.stubEnv("HF_TOKEN", "hf-test")
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "boom" }, false, 503)))
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.image.generate", { prompt: "a cat" }, "u1")
    expect(res.success).toBe(false)
    expect(res.error).toContain("HuggingFace image API error 503")
  })
})

describe("flowmind.audio.transcribe", () => {
  const audioPath = join(tmpdir(), "flowmind-test-audio.bin")

  beforeAll(() => writeFileSync(audioPath, Buffer.from([0, 1, 2])))
  afterAll(() => {
    try {
      unlinkSync(audioPath)
    } catch {
      // ignore
    }
  })
  afterEach(() => vi.unstubAllEnvs())

  it("fails loudly when HF_TOKEN is unset", async () => {
    vi.stubEnv("HF_TOKEN", "")
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.audio.transcribe", { filePath: audioPath }, "u1")
    expect(res.success).toBe(false)
    expect(res.error).toContain("requires HF_TOKEN")
  })

  it("returns transcribed text", async () => {
    vi.stubEnv("HF_TOKEN", "hf-test")
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ text: "hello world" })))
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.audio.transcribe", { filePath: audioPath }, "u1")
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ text: "hello world", segments: [] })
  })
})

describe("flowmind.git.pr", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("fails loudly when GITHUB_TOKEN is unset", async () => {
    vi.stubEnv("GITHUB_TOKEN", "")
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.git.pr", { repoPath: "acme/app", title: "T", head: "feat", base: "main" }, "u1")
    expect(res.success).toBe(false)
    expect(res.error).toContain("requires GITHUB_TOKEN")
  })

  it("rejects non-owner/repo paths", async () => {
    vi.stubEnv("GITHUB_TOKEN", "gh-test")
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.git.pr", { repoPath: "C:\\repo", title: "T", head: "feat", base: "main" }, "u1")
    expect(res.success).toBe(false)
    expect(res.error).toContain("owner/repo")
  })

  it("creates a pull request", async () => {
    vi.stubEnv("GITHUB_TOKEN", "gh-test")
    const fetchMock = vi.fn(async () => jsonResponse({ html_url: "https://github.com/acme/app/pull/7", number: 7 }))
    vi.stubGlobal("fetch", fetchMock)
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.git.pr", { repoPath: "acme/app", title: "T", head: "feat", base: "main", body: "b" }, "u1")
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ url: "https://github.com/acme/app/pull/7", number: 7 })
    expect(fetchMock).toHaveBeenCalledWith("https://api.github.com/repos/acme/app/pulls", expect.objectContaining({ method: "POST" }))
  })
})

describe("flowmind.github.issue", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("fails loudly when GITHUB_TOKEN is unset", async () => {
    vi.stubEnv("GITHUB_TOKEN", "")
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.github.issue", { repo: "acme/app", title: "T" }, "u1")
    expect(res.success).toBe(false)
    expect(res.error).toContain("requires GITHUB_TOKEN")
  })

  it("creates an issue", async () => {
    vi.stubEnv("GITHUB_TOKEN", "gh-test")
    const fetchMock = vi.fn(async () => jsonResponse({ id: 42, html_url: "https://github.com/acme/app/issues/42", number: 42 }))
    vi.stubGlobal("fetch", fetchMock)
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.github.issue", { repo: "acme/app", title: "Bug", body: "desc", labels: ["bug"] }, "u1")
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ id: 42, url: "https://github.com/acme/app/issues/42", number: 42 })
  })

  it("updates an issue when issueNumber is provided", async () => {
    vi.stubEnv("GITHUB_TOKEN", "gh-test")
    const fetchMock = vi.fn(async () => jsonResponse({ id: 42, html_url: "https://github.com/acme/app/issues/42", number: 42 }))
    vi.stubGlobal("fetch", fetchMock)
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.github.issue", { repo: "acme/app", title: "Bug", action: "update", issueNumber: 42 }, "u1")
    expect(res.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith("https://api.github.com/repos/acme/app/issues/42", expect.objectContaining({ method: "PATCH" }))
  })

  it("fails loudly when update lacks issueNumber", async () => {
    vi.stubEnv("GITHUB_TOKEN", "gh-test")
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.github.issue", { repo: "acme/app", title: "Bug", action: "update" }, "u1")
    expect(res.success).toBe(false)
    expect(res.error).toContain("requires issueNumber")
  })
})

describe("flowmind.slack.message", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("fails loudly when SLACK_BOT_TOKEN is unset", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "")
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.slack.message", { channel: "#general", text: "hi" }, "u1")
    expect(res.success).toBe(false)
    expect(res.error).toContain("requires SLACK_BOT_TOKEN")
  })

  it("posts a message", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "slack-test")
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, ts: "123.456", channel: "C123" }))
    vi.stubGlobal("fetch", fetchMock)
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.slack.message", { channel: "#general", text: "hi" }, "u1")
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ ts: "123.456", channel: "C123" })
    expect(fetchMock).toHaveBeenCalledWith("https://slack.com/api/chat.postMessage", expect.objectContaining({ method: "POST" }))
  })

  it("surfaces Slack API errors", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "slack-test")
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: false, error: "invalid_auth" })))
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.slack.message", { channel: "#general", text: "hi" }, "u1")
    expect(res.success).toBe(false)
    expect(res.error).toContain("Slack API error: invalid_auth")
  })
})

describe("flowmind.notion.page", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("fails loudly when NOTION_TOKEN is unset", async () => {
    vi.stubEnv("NOTION_TOKEN", "")
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.notion.page", { parentId: "p1", title: "T" }, "u1")
    expect(res.success).toBe(false)
    expect(res.error).toContain("requires NOTION_TOKEN")
  })

  it("creates a page", async () => {
    vi.stubEnv("NOTION_TOKEN", "nt-test")
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ id: "page-1", url: "https://notion.so/page-1" }))
    vi.stubGlobal("fetch", fetchMock)
    const executor = makeExecutor()
    const res = await executor.execute("flowmind.notion.page", { parentId: "p1", title: "T" }, "u1")
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ id: "page-1", url: "https://notion.so/page-1" })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://api.notion.com/v1/pages")
    expect(init!.headers).toMatchObject({ "Notion-Version": "2022-06-28" })
  })
})