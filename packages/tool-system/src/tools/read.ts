import fs from "fs"
import path from "path"
import type { ToolInfo, ToolContext, ExecuteResult } from "../types"
import { truncateOutput } from "../truncation"

export const ReadToolInfo: ToolInfo = {
  id: "read",
  init: () => ({
    id: "read",
    description: "Read the contents of a file. Use this to view file contents, check code, or read documentation.",
    parameters: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "The absolute path to the file or directory to read" },
        offset: { type: "number", description: "The line number to start reading from (1-indexed)" },
        limit: { type: "number", description: "The maximum number of lines to read (default 2000)" },
      },
      required: ["filePath"],
    },
    async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ExecuteResult> {
      const filePath = args.filePath as string
      const offset = (args.offset as number) ?? 1
      const limit = (args.limit as number) ?? 2000

      if (!filePath) throw new Error("filePath is required")

      const resolvedPath = path.resolve(filePath)

      await ctx.ask({
        permission: "read",
        patterns: [path.relative(process.cwd(), resolvedPath)],
        always: ["*"],
        metadata: { filePath: resolvedPath },
      })

      const stat = fs.statSync(resolvedPath)

      if (stat.isDirectory()) {
        const entries = fs.readdirSync(resolvedPath).sort()
        const output = entries.map((entry) => {
          const full = path.join(resolvedPath, entry)
          return fs.statSync(full).isDirectory() ? `${entry}/` : entry
        }).join("\n")
        return {
          title: path.basename(resolvedPath),
          output,
          metadata: { type: "directory", entries: entries.length },
        }
      }

      const content = fs.readFileSync(resolvedPath, "utf-8")
      const lines = content.split("\n")
      const total = lines.length

      const start = Math.max(0, offset - 1)
      const end = Math.min(start + limit, total)
      const slice = lines.slice(start, end)
      const output = slice.map((line, i) => `${start + i + 1}: ${line}`).join("\n")

      const header = `<path>${resolvedPath}</path>\n<type>file</type>\n`
      const footer = start <= 0 && end >= total
        ? `(End of file - total ${total} lines)`
        : `(Showing lines ${start + 1}-${end} of ${total}. Use offset=${end + 1} to continue.)`

      return {
        title: path.basename(resolvedPath),
        output: header + output + "\n" + footer,
        metadata: { preview: slice[0]?.slice(0, 100), truncated: end < total, lines: total },
      }
    },
  }),
}

export function createReadTool(): ToolInfo {
  return ReadToolInfo
}
