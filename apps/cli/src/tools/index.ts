import { registerFilesystemTools } from "./filesystem.js"
import { registerBashTools } from "./bash.js"
import { registerSearchTools } from "./search.js"
import { registerWebTools } from "./web.js"
import { registerAgentManagementTools } from "./agent-tools.js"
import type { ToolDefinition, ToolResult } from "./registry.js"
export { listTools, getTool, executeTool, getToolDescriptions, getToolNames, registerTool } from "./registry.js"
export type { ToolDefinition, ToolResult } from "./registry.js"

export function registerAllTools(): void {
  registerFilesystemTools()
  registerBashTools()
  registerSearchTools()
  registerWebTools()
  registerAgentManagementTools()
}
