import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { fileURLToPath } from "node:url"
import { McpConnectionPool } from "../index"
import type { McpServerConfig } from "../index"

vi.mock("@flowmind/db", () => ({ prisma: {} }))

const fixturePath = fileURLToPath(new URL("./fixtures/demo-mcp-server.mjs", import.meta.url))

const stdioConfig: McpServerConfig = {
  id: "sec-stdio",
  name: "sec-stdio",
  transport: "stdio",
  command: process.execPath,
  args: [fixturePath],
  enabled: true,
}

const httpConfig = (baseUrl: string): McpServerConfig => ({
  id: "sec-http",
  name: "sec-http",
  transport: "streamable-http",
  baseUrl,
  enabled: true,
})

describe("MCP security gates", () => {
  let pool: McpConnectionPool

  afterAll(async () => {
    vi.unstubAllEnvs()
    await pool.disconnect("sec-stdio")
    await pool.disconnect("sec-http")
  })

  it("refuses stdio when MCP_ALLOWED_COMMANDS is unset", async () => {
    vi.unstubAllEnvs()
    pool = new McpConnectionPool()
    await expect(pool.listTools(stdioConfig)).rejects.toThrow(/disabled|MCP_ALLOWED_COMMANDS/)
  })

  it("refuses stdio when the command is not allowlisted", async () => {
    vi.stubEnv("MCP_ALLOWED_COMMANDS", "some-other-binary")
    pool = new McpConnectionPool()
    await expect(pool.listTools(stdioConfig)).rejects.toThrow(/not in MCP_ALLOWED_COMMANDS/)
  })

  it("refuses stdio commands containing shell metacharacters", async () => {
    vi.stubEnv("MCP_ALLOWED_COMMANDS", process.execPath)
    pool = new McpConnectionPool()
    const malicious: McpServerConfig = {
      ...stdioConfig,
      id: "sec-meta",
      command: `node; rm -rf /`,
      args: [],
    }
    await expect(pool.listTools(malicious)).rejects.toThrow(/metacharacters/)
    await pool.disconnect("sec-meta")
  })

  it("refuses file: remote URLs outright", async () => {
    vi.stubEnv("ALLOW_PRIVATE_MCP_URLS", "false")
    pool = new McpConnectionPool()
    await expect(pool.listTools(httpConfig("file:///etc/passwd"))).rejects.toThrow(/file:/)
  })

  it("blocks private/loopback/link-local remote URLs", async () => {
    vi.stubEnv("ALLOW_PRIVATE_MCP_URLS", "false")
    pool = new McpConnectionPool()
    for (const baseUrl of [
      "http://127.0.0.1:9999/mcp",
      "http://10.0.0.1:9999/mcp",
      "http://169.254.0.1:9999/mcp",
      "http://[::1]:9999/mcp",
    ]) {
      await expect(pool.listTools(httpConfig(baseUrl))).rejects.toThrow(/Blocked/)
    }
  })

  it("lets remote URLs through when ALLOW_PRIVATE_MCP_URLS=true (then fails at transport level)", async () => {
    vi.stubEnv("ALLOW_PRIVATE_MCP_URLS", "true")
    pool = new McpConnectionPool()
    await expect(pool.listTools(httpConfig("http://127.0.0.1:9/mcp"))).rejects.toThrow(/failed|fetch|connect/i)
  })
})