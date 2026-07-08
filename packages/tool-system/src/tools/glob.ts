import { execSync } from "child_process"
import path from "path"
import type { ToolInfo, ToolContext, ExecuteResult } from "../types"

export const GlobToolInfo: ToolInfo = {
  id: "glob",
  init: () => ({
    id: "glob",
    description: "Find files matching a glob pattern. Use this to locate files by name patterns across the codebase.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "The glob pattern to match files against (e.g. '**/*.ts', 'src/**/*.tsx')" },
        path: { type: "string", description: "The directory to search in. Defaults to the current working directory." },
      },
      required: ["pattern"],
    },
    async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ExecuteResult> {
      const pattern = args.pattern as string
      const searchPath = args.path as string | undefined

      if (!pattern) throw new Error("pattern is required")

      await ctx.ask({
        permission: "glob",
        patterns: [pattern],
        always: ["*"],
        metadata: { pattern, path: searchPath },
      })

      const cwd = searchPath ? path.resolve(searchPath) : process.cwd()
      const limit = 100

      try {
        const output = execSync(
          `fd --glob "${pattern.replace(/"/g, '\\"')}" "${cwd}" --max-results ${limit}`,
          { encoding: "utf-8", maxBuffer: 1024 * 1024, timeout: 10000 }
        )
        const files = output.trim().split("\n").filter(Boolean)

        if (files.length === 0) {
          return {
            title: pattern,
            output: "No files found",
            metadata: { count: 0, truncated: false },
          }
        }

        const truncated = files.length === limit
        const result = files.join("\n")
        if (truncated) {
          return {
            title: pattern,
            output: result + `\n\n(Results are truncated: showing first ${limit} results. Consider using a more specific pattern.)`,
            metadata: { count: files.length, truncated },
          }
        }

        return {
          title: pattern,
          output: result,
          metadata: { count: files.length, truncated: false },
        }
      } catch (e) {
        return {
          title: pattern,
          output: "No files found",
          metadata: { count: 0, truncated: false },
        }
      }
    },
  }),
}

export function createGlobTool(): ToolInfo {
  return GlobToolInfo
}
