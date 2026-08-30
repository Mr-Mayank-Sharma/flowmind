import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import http from "node:http"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { McpConnectionPool } from "../index"
import type { McpServerConfig } from "../index"

vi.mock("@flowmind/db", () => ({ prisma: {} }))

const TOOLS = [
  {
    name: "echo",
    description: "Echo the provided text back verbatim",
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "getWeather",
    description: "Return the current weather for a city (stub)",
    inputSchema: { type: "object", properties: { city: { type: "string" } }, required: ["city"] },
  },
  {
    name: "failTool",
    description: "Always fails; used to verify error propagation",
    inputSchema: { type: "object", properties: {} },
  },
]

function createHttpDemoServer(): Server {
  const server = new Server(
    { name: "demo-http-server", version: "1.0.0" },
    { capabilities: { tools: {} } },
  )
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    if (name === "echo") return { content: [{ type: "text", text: `echo: ${String(args?.text ?? "")}` }] }
    if (name === "getWeather") {
      return { content: [{ type: "text", text: `weather in ${String(args?.city ?? "unknown")}: sunny, 22C` }] }
    }
    if (name === "failTool") return { content: [{ type: "text", text: "boom" }], isError: true }
    throw new Error(`Unknown tool: ${name}`)
  })
  return server
}

interface HttpTestServer {
  port: number
  close: () => Promise<void>
}

function startHttpDemoServer(): Promise<HttpTestServer> {
  return new Promise((resolve, reject) => {
    const transports = new Map<string, SSEServerTransport>()
    const httpServer = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1")
      if (req.method === "GET" && url.pathname === "/sse") {
        const transport = new SSEServerTransport("/messages", res)
        transports.set(transport.sessionId, transport)
        res.on("close", () => transports.delete(transport.sessionId))
        await createHttpDemoServer().connect(transport)
        return
      }
      if (req.method === "POST" && url.pathname === "/messages") {
        const transport = url.searchParams.get("sessionId")
          ? transports.get(url.searchParams.get("sessionId")!)
          : undefined
        if (!transport) {
          res.writeHead(400).end()
          return
        }
        await transport.handlePostMessage(req, res)
        return
      }
      res.writeHead(404).end()
    })
    httpServer.on("error", reject)
    httpServer.listen(0, "127.0.0.1", () => {
      const address = httpServer.address()
      if (!address || typeof address === "string") {
        reject(new Error("failed to bind test HTTP server"))
        return
      }
      resolve({
        port: address.port,
        close: () => new Promise<void>((done) => httpServer.close(() => done())),
      })
    })
  })
}

describe("McpConnectionPool over HTTP (SSE transport)", () => {
  let pool: McpConnectionPool
  let server: HttpTestServer
  let config: McpServerConfig

  beforeAll(async () => {
    vi.stubEnv("ALLOW_PRIVATE_MCP_URLS", "true")
    server = await startHttpDemoServer()
    config = {
      id: "demo-http",
      name: "demo-http",
      transport: "sse",
      baseUrl: `http://127.0.0.1:${server.port}/sse`,
      enabled: true,
    }
    pool = new McpConnectionPool()
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    await pool.disconnect("demo-http")
    await server.close()
  })

  it("discovers tools over SSE", async () => {
    const tools = await pool.listTools(config)
    const names = tools.map((t) => t.name)
    expect(names).toContain("echo")
    expect(names).toContain("getWeather")
    expect(names).toContain("failTool")
  })

  it("calls tools over SSE", async () => {
    const result = await pool.callTool(config, "echo", { text: "over http" })
    expect(result.success).toBe(true)
    expect(result.content).toContain("over http")
  })

  it("propagates isError results over SSE", async () => {
    const result = await pool.callTool(config, "failTool", {})
    expect(result.success).toBe(false)
    expect(result.content).toContain("boom")
  })
})