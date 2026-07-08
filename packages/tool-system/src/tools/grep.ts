import { execSync } from "child_process"
import path from "path"
import type { ToolInfo, ToolContext, ExecuteResult } from "../types"

export const GrepToolInfo: ToolInfo = {
  id: "grep",
  init: () => ({
    id: "grep",
    description: "Search file contents using regular expressions. Fast codebase-wide content search.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "The regex pattern to search for in file contents" },
        path: { type: "string", description: "The directory to search in. Defaults to the current working directory." },
        include: { type: "string", description: 'File pattern to include (e.g. "*.ts", "*.{ts,tsx}")' },
      },
      required: ["pattern"],
    },
    async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ExecuteResult> {
      const pattern = args.pattern as string
      const searchPath = args.path as string | undefined
      const include = args.include as string | undefined

      if (!pattern) throw new Error("pattern is required")

      await ctx.ask({
        permission: "grep",
        patterns: [pattern],
        always: ["*"],
        metadata: { pattern, path: searchPath, include },
      })

      const cwd = searchPath ? path.resolve(searchPath) : process.cwd()
      let cmd = `rg --no-heading --line-number --regexp "${pattern.replace(/"/g, '\\"')}" "${cwd}"`

      if (include) {
        cmd += ` --glob "${include}"`
      }

      try {
        const output = execSync(cmd, { encoding: "utf-8", maxBuffer: 1024 * 1024, timeout: 10000 })
        const lines = output.trim().split("\n").filter(Boolean).slice(0, 100)

        if (lines.length === 0) {
          return {
            title: pattern,
            output: "No files found",
            metadata: { matches: 0, truncated: false },
          }
        }

        const truncated = lines.length === 100
        const result = `Found ${lines.length} matches${truncated ? " (more matches available)" : ""}\n\n${lines.join("\n")}`

        return {
          title: pattern,
          output: result,
          metadata: { matches: lines.length, truncated },
        }
      } catch (e) {
        return {
          title: pattern,
          output: "No files found",
          metadata: { matches: 0, truncated: false },
        }
      }
    },
  }),
}

export function createGrepTool(): ToolInfo {
  return GrepToolInfo
}
