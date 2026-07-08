import fs from "fs"
import path from "path"
import { createTwoFilesPatch } from "diff"
import type { ToolInfo, ToolContext, ExecuteResult } from "../types"

interface PatchHunk {
  type: "add" | "update" | "delete" | "move"
  filePath: string
  oldStr?: string
  newStr?: string
  toPath?: string
}

function parsePatch(text: string): PatchHunk[] {
  const hunks: PatchHunk[] = []
  const lines = text.split("\n")
  let i = 0

  while (i < lines.length) {
    const line = lines[i]?.trim() ?? ""

    if (line.startsWith("*** Begin Patch")) {
      i++
      continue
    }

    const addMatch = line.match(/^\*\*\* Add File:\s+(.+)$/i)
    if (addMatch) {
      const filePath = addMatch[1]!.trim()
      i++
      const contentLines: string[] = []
      while (i < lines.length && !lines[i]!.trim().startsWith("***") && !lines[i]!.trim().startsWith("@@")) {
        if (lines[i]!.startsWith("+")) {
          contentLines.push(lines[i]!.slice(1))
        }
        i++
      }
      hunks.push({ type: "add", filePath, newStr: contentLines.join("\n") })
      continue
    }

    const updateMatch = line.match(/^\*\*\* Update File:\s+(.+)$/i)
    if (updateMatch) {
      const filePath = updateMatch[1]!.trim()
      i++
      let oldStr = ""
      let newStr = ""
      let inChunk = false

      while (i < lines.length) {
        const l = lines[i]!.trim()
        if (l.startsWith("***") || l.startsWith("@@")) break
        if (l.startsWith("@@ ")) {
          inChunk = true
          i++
          continue
        }
        if (inChunk) {
          if (l.startsWith("@@")) break
          if (l.startsWith("-")) oldStr += l.slice(1) + "\n"
          else if (l.startsWith("+")) newStr += l.slice(1) + "\n"
          else { oldStr += l + "\n"; newStr += l + "\n" }
        }
        i++
      }

      hunks.push({ type: "update", filePath, oldStr: oldStr.trim(), newStr: newStr.trim() })
      continue
    }

    const moveMatch = line.match(/^\*\*\* Move to:\s+(.+)$/i)
    if (moveMatch) {
      const toPath = moveMatch[1]!.trim()
      hunks.push({ type: "move", filePath: "", toPath })
      i++
      continue
    }

    const deleteMatch = line.match(/^\*\*\* Delete File:\s+(.+)$/i)
    if (deleteMatch) {
      hunks.push({ type: "delete", filePath: deleteMatch[1]!.trim() })
      i++
      continue
    }

    if (line === "*** End Patch") break
    i++
  }

  return hunks
}

export const ApplyPatchToolInfo: ToolInfo = {
  id: "apply_patch",
  init: () => ({
    id: "apply_patch",
    description: "Apply a patch to multiple files at once. Supports add, update, move, and delete operations in a single patch text.",
    parameters: {
      type: "object",
      properties: {
        patchText: { type: "string", description: "The patch text in the patch format" },
      },
      required: ["patchText"],
    },
    async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ExecuteResult> {
      const patchText = args.patchText as string
      if (!patchText) throw new Error("patchText is required")

      const hunks = parsePatch(patchText)
      if (hunks.length === 0) throw new Error("No valid patch hunks found")

      const changedFiles: string[] = []

      for (const hunk of hunks) {
        const resolvedPath = path.resolve(hunk.filePath)

        switch (hunk.type) {
          case "add": {
            await ctx.ask({
              permission: "edit",
              patterns: [path.relative(process.cwd(), resolvedPath)],
              always: ["*"],
              metadata: { filePath: resolvedPath, operation: "add" },
            })
            fs.mkdirSync(path.dirname(resolvedPath), { recursive: true })
            fs.writeFileSync(resolvedPath, hunk.newStr!, "utf-8")
            changedFiles.push(`A ${hunk.filePath}`)
            break
          }
          case "update": {
            await ctx.ask({
              permission: "edit",
              patterns: [path.relative(process.cwd(), resolvedPath)],
              always: ["*"],
              metadata: { filePath: resolvedPath, operation: "update" },
            })
            const content = fs.readFileSync(resolvedPath, "utf-8")
            const newContent = hunk.oldStr
              ? content.replace(hunk.oldStr, hunk.newStr!)
              : hunk.newStr! + "\n" + content
            fs.writeFileSync(resolvedPath, newContent, "utf-8")
            changedFiles.push(`M ${hunk.filePath}`)
            break
          }
          case "delete": {
            await ctx.ask({
              permission: "edit",
              patterns: [path.relative(process.cwd(), resolvedPath)],
              always: ["*"],
              metadata: { filePath: resolvedPath, operation: "delete" },
            })
            fs.unlinkSync(resolvedPath)
            changedFiles.push(`D ${hunk.filePath}`)
            break
          }
        }
      }

      return {
        title: `Applied patch (${hunks.length} changes)`,
        output: changedFiles.join("\n"),
        metadata: { files: changedFiles, count: changedFiles.length },
      }
    },
  }),
}

export function createApplyPatchTool(): ToolInfo {
  return ApplyPatchToolInfo
}
