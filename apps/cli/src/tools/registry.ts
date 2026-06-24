export interface ToolDefinition {
  name: string
  description: string
  parameters: ToolParameter[]
  execute: (args: Record<string, any>) => Promise<ToolResult>
}

export interface ToolParameter {
  name: string
  type: "string" | "number" | "boolean" | "array" | "object"
  description: string
  required: boolean
}

export interface ToolResult {
  success: boolean
  output: string
  error?: string
  data?: any
}

const tools = new Map<string, ToolDefinition>()

export function registerTool(tool: ToolDefinition): void {
  tools.set(tool.name, tool)
}

export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name)
}

export function listTools(): ToolDefinition[] {
  return Array.from(tools.values())
}

export function getToolNames(): string[] {
  return Array.from(tools.keys())
}

export async function executeTool(name: string, args: Record<string, any>): Promise<ToolResult> {
  const tool = tools.get(name)
  if (!tool) {
    return { success: false, output: "", error: `Unknown tool: ${name}. Available: ${getToolNames().join(", ")}` }
  }
  try {
    return await tool.execute(args)
  } catch (err: any) {
    return { success: false, output: "", error: `Tool ${name} failed: ${err.message}` }
  }
}

export function getToolDescriptions(): string {
  const lines = listTools().map(t => {
    const params = t.parameters.map(p => `    ${p.name} (${p.type})${p.required ? " [required]" : ""} — ${p.description}`).join("\n")
    return `  • ${t.name}: ${t.description}\n${params}`
  })
  return lines.join("\n\n")
}
