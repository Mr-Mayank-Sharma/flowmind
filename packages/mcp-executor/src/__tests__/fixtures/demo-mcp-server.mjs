// A tiny in-repo MCP server used by the vitest suites and the live end-to-end
// verification. Exposes echo, getWeather (stub), and failTool (always errors).
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"

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

export function createDemoServer() {
  const server = new Server(
    { name: "demo-mcp-server", version: "1.0.0" },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    if (name === "echo") {
      return { content: [{ type: "text", text: `echo: ${String(args?.text ?? "")}` }] }
    }
    if (name === "getWeather") {
      return { content: [{ type: "text", text: `weather in ${String(args?.city ?? "unknown")}: sunny, 22C` }] }
    }
    if (name === "failTool") {
      return { content: [{ type: "text", text: "boom" }], isError: true }
    }
    throw new Error(`Unknown tool: ${name}`)
  })

  return server
}

const transport = new StdioServerTransport()
await createDemoServer().connect(transport)