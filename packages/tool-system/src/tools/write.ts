import fs from "fs"
import path from "path"
import { createTwoFilesPatch } from "diff"
import type { ToolDef, ToolInfo, ToolContext, ExecuteResult } from "../types"

export const WriteToolInfo: ToolInfo = {
  id: "write",
  init: () => ({
    id: "write",
    description: "Create or overwrite a file with new content. Use this to write new files or completely replace existing ones.",
    parameters: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "The absolute path to the file to write" },
        content: { type: "string", description: "The content to write to the file" },
      },
      required: ["filePath", "content"],
    },
    async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ExecuteResult> {
      const filePath = args.filePath as string
      const content = args.content as string

      if (!filePath || content === undefined) {
        throw new Error("Missing required arguments: filePath, content")
      }

      const resolvedPath = path.resolve(filePath)
      const exists = fs.existsSync(resolvedPath)
      const existingContent = exists ? fs.readFileSync(resolvedPath, "utf-8") : ""

      await ctx.ask({
        permission: "edit",
        patterns: [path.relative(process.cwd(), resolvedPath)],
        always: ["*"],
        metadata: { filePath: resolvedPath, exists },
      })

      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true })
      fs.writeFileSync(resolvedPath, content, "utf-8")

      const diff = exists
        ? createTwoFilesPatch(resolvedPath, resolvedPath, existingContent, content, "", "")
        : createTwoFilesPatch("/dev/null", resolvedPath, "", content, "", "")

      return {
        title: exists ? `Updated ${path.basename(resolvedPath)}` : `Created ${path.basename(resolvedPath)}`,
        output: exists ? `Updated ${resolvedPath}` : `Created ${resolvedPath} (${Buffer.byteLength(content, "utf-8")} bytes)`,
        metadata: { diff, filePath: resolvedPath, exists },
      }
    },
  }),
}

export function createWriteTool(): ToolInfo {
  return WriteToolInfo
}
