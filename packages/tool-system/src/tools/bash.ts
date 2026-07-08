import { execSync, spawn } from "child_process"
import path from "path"
import fs from "fs"
import type { ToolInfo, ToolContext, ExecuteResult } from "../types"
import { truncateOutput } from "../truncation"

export const BashToolInfo: ToolInfo = {
  id: "bash",
  init: () => ({
    id: "bash",
    description: "Execute shell commands in a persistent shell session. Use this to run tests, build commands, git operations, or any shell command.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to execute" },
        timeout: { type: "number", description: "Optional timeout in milliseconds (default 120000)" },
        workdir: { type: "string", description: "Working directory for the command" },
      },
      required: ["command"],
    },
    async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ExecuteResult> {
      const command = args.command as string
      const timeout = (args.timeout as number) ?? 120000
      const workdir = args.workdir ? path.resolve(args.workdir as string) : process.cwd()

      if (!command) throw new Error("command is required")

      await ctx.ask({
        permission: "bash",
        patterns: [command],
        always: ["*"],
        metadata: { command, timeout, workdir },
      })

      const cmdPrefix = command.split(/\s+/).slice(0, 3).join(" ") + " *"
      await ctx.ask({
        permission: "bash",
        patterns: [command],
        always: [cmdPrefix],
        metadata: { command },
      })

      try {
        const output = execSync(command, {
          cwd: workdir,
          encoding: "utf-8",
          maxBuffer: 10 * 1024 * 1024,
          timeout,
          stdio: ["pipe", "pipe", "pipe"],
        })

        const truncated = await truncateOutput(output.trim())
        return {
          title: command.slice(0, 60),
          output: truncated.content,
          metadata: {
            exitCode: 0,
            truncated: truncated.truncated,
            ...(truncated.outputPath ? { outputPath: truncated.outputPath } : {}),
          },
        }
      } catch (e: any) {
        const stderr = e.stderr?.toString() ?? ""
        const stdout = e.stdout?.toString() ?? ""
        const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n") || e.message
        const truncated = await truncateOutput(combined)

        return {
          title: command.slice(0, 60),
          output: truncated.content,
          metadata: {
            exitCode: e.status ?? 1,
            error: true,
            truncated: truncated.truncated,
            ...(truncated.outputPath ? { outputPath: truncated.outputPath } : {}),
          },
        }
      }
    },
  }),
}

export function createBashTool(): ToolInfo {
  return BashToolInfo
}
