import { registerTool, type ToolResult } from "./registry.js"
import { getAgents, getModels, getPipelines, getMCPServers, getSessions } from "../store/index.js"

export function registerAgentManagementTools(): void {
  registerTool({
    name: "list_agents",
    description: "List all available AI agents with their status and roles.",
    parameters: [],
    execute: async (): Promise<ToolResult> => {
      const agents = getAgents()
      const lines = agents.map(a =>
        `  ${a.status === "active" ? "●" : "○"} ${a.name} (${a.role}) — ${a.model} — ${a.status}`
      )
      return { success: true, output: lines.join("\n") || "No agents configured.", data: { agents } }
    },
  })

  registerTool({
    name: "get_agent_info",
    description: "Get detailed information about a specific agent by ID or name.",
    parameters: [
      { name: "id", type: "string", description: "Agent ID or name to look up", required: true },
    ],
    execute: async (args): Promise<ToolResult> => {
      const agents = getAgents()
      const agent = agents.find(a => a.id === args.id || a.name.toLowerCase() === args.id.toLowerCase())
      if (!agent) {
        return { success: false, output: "", error: `Agent not found: ${args.id}` }
      }
      const lines = [
        `Name: ${agent.name}`,
        `Role: ${agent.role}`,
        `Model: ${agent.model} (${agent.provider})`,
        `Status: ${agent.status}`,
        `Memory: ${agent.memoryEnabled ? "enabled" : "disabled"}`,
        `Cost: $${agent.costSpent} / $${agent.costCap}`,
        `Tools: ${agent.tools}`,
        `Created: ${agent.createdAt}`,
      ]
      return { success: true, output: lines.join("\n"), data: { agent } }
    },
  })

  registerTool({
    name: "get_system_status",
    description: "Get an overview of the FlowMind system including agents, pipelines, MCP servers, and sessions.",
    parameters: [],
    execute: async (): Promise<ToolResult> => {
      const agents = getAgents()
      const pipelines = getPipelines()
      const servers = getMCPServers()
      const sessions = getSessions()
      const lines = [
        `Agents: ${agents.filter(a => a.status === "active").length}/${agents.length} active`,
        `Pipelines: ${pipelines.filter(p => p.status === "ACTIVE").length}/${pipelines.length} active`,
        `MCP Servers: ${servers.filter(s => s.status === "connected").length}/${servers.length} connected`,
        `Sessions: ${sessions.filter(s => s.status === "active").length}/${sessions.length} active`,
      ]
      return { success: true, output: lines.join("\n"), data: { agents, pipelines, servers, sessions } }
    },
  })
}
