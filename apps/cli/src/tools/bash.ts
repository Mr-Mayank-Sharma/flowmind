import { execSync } from "child_process"
import { registerTool, type ToolResult } from "./registry.js"

export function registerBashTools(): void {
  registerTool({
    name: "run_bash",
    description: "Execute a shell command and return its output. For long-running commands, use a reasonable timeout.",
    parameters: [
      { name: "command", type: "string", description: "Shell command to execute", required: true },
      { name: "timeout", type: "number", description: "Timeout in milliseconds (default 30000)", required: false },
      { name: "description", type: "string", description: "Short description of what the command does", required: false },
    ],
    execute: async (args): Promise<ToolResult> => {
      const command = args.command
      const timeout = args.timeout || 30000
      try {
        const output = execSync(command, {
          encoding: "utf-8",
          timeout,
          maxBuffer: 10 * 1024 * 1024,
        })
        const lines = output.split("\n")
        const truncated = lines.length > 200 ? lines.slice(0, 200).join("\n") + `\n... (${lines.length - 200} more lines truncated)` : output
        return {
          success: true,
          output: truncated || "(no output)",
          data: { exitCode: 0, lineCount: lines.length },
        }
      } catch (err: any) {
        const stderr = err.stderr || ""
        const stdout = err.stdout || ""
        const message = stderr || stdout || err.message
        return {
          success: false,
          output: message,
          error: `Command failed with exit code ${err.status || 1}: ${message.slice(0, 500)}`,
          data: { exitCode: err.status || 1 },
        }
      }
    },
  })
}
