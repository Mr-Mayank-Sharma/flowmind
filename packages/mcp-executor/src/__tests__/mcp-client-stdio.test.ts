import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { fileURLToPath } from "node:url"
import { McpConnectionPool } from "../index"
import type { McpServerConfig } from "../index"

vi.mock("@flowmind/db", () => ({ prisma: {} }))

const fixturePath = fileURLToPath(new URL("./fixtures/demo-mcp-server.mjs", import.meta.url))

const stdioConfig: McpServerConfig = {
  id: "demo-stdio",
  name: "demo-stdio",
  transport: "stdio",
  command: process.execPath,
  args: [fixturePath],
  enabled: true,
}

describe("McpConnectionPool over stdio", () => {
  let pool: McpConnectionPool

  beforeAll(() => {
    vi.stubEnv("MCP_ALLOWED_COMMANDS", process.execPath)
    pool = new McpConnectionPool()
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    await pool.disconnect("demo-stdio")
  })

  it("lists the demo server's tools over a spawned child process", async () => {
    const tools = await pool.listTools(stdioConfig)
    const names = tools.map((t) => t.name)
    expect(names).toContain("echo")
    expect(names).toContain("getWeather")
    expect(names).toContain("failTool")
  })

  it("calls echo and returns the payload", async () => {
    const result = await pool.callTool(stdioConfig, "echo", { text: "hello agent" })
    expect(result.success).toBe(true)
    expect(result.content).toContain("hello agent")
  })

  it("calls getWeather and returns the stub payload", async () => {
    const result = await pool.callTool(stdioConfig, "getWeather", { city: "Berlin" })
    expect(result.success).toBe(true)
    expect(result.content).toContain("Berlin")
  })

  it("surfaces a server-side isError result as a failed tool call", async () => {
    const result = await pool.callTool(stdioConfig, "failTool", {})
    expect(result.success).toBe(false)
    expect(result.isError).toBe(true)
    expect(result.content).toContain("boom")
  })

  it("throws a descriptive error for unknown tools", async () => {
    await expect(pool.callTool(stdioConfig, "notARealTool", {})).rejects.toThrow(/Unknown tool/)
  })

  it("reconnects after disconnect", async () => {
    await pool.disconnect("demo-stdio")
    expect(pool.isConnected("demo-stdio")).toBe(false)

    const tools = await pool.listTools(stdioConfig)
    expect(tools.map((t) => t.name)).toContain("echo")

    const result = await pool.callTool(stdioConfig, "echo", { text: "again" })
    expect(result.success).toBe(true)
    expect(result.content).toContain("again")
  })
})