import fs from "fs"
import path from "path"
import { createTwoFilesPatch } from "diff"
import type { ToolDef, ToolInfo, ToolContext, ExecuteResult } from "../types"
import { truncateOutput } from "../truncation"

function normalizeLineEndings(text: string): string {
  return text.replaceAll("\r\n", "\n")
}

function detectLineEnding(text: string): "\n" | "\r\n" {
  return text.includes("\r\n") ? "\r\n" : "\n"
}

interface ReplacerResult {
  found: boolean
  content: string
}

type Replacer = (content: string, oldStr: string, newStr: string) => ReplacerResult | undefined

const simpleReplacer: Replacer = (content, oldStr, newStr) => {
  const idx = content.indexOf(oldStr)
  if (idx === -1) return undefined
  return { found: true, content: content.slice(0, idx) + newStr + content.slice(idx + oldStr.length) }
}

const lineTrimmedReplacer: Replacer = (content, oldStr, newStr) => {
  const oldLines = oldStr.split("\n").map((l) => l.trim())
  const contentLines = content.split("\n")
  for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
    let match = true
    for (let j = 0; j < oldLines.length; j++) {
      if (contentLines[i + j]?.trim() !== oldLines[j]) {
        match = false
        break
      }
    }
    if (match) {
      const before = contentLines.slice(0, i).join("\n")
      const after = contentLines.slice(i + oldLines.length).join("\n")
      const glue = before.length > 0 && after.length > 0 ? "\n" : ""
      return { found: true, content: before + (before.length > 0 ? "\n" : "") + newStr + (after.length > 0 ? "\n" : "") + after }
    }
  }
  return undefined
}

const whitespaceNormalizedReplacer: Replacer = (content, oldStr, newStr) => {
  const normOld = oldStr.replace(/\s+/g, " ")
  const normContent = content.replace(/\s+/g, " ")
  const idx = normContent.indexOf(normOld)
  if (idx === -1) return undefined
  const origIdx = mapPosition(content, idx)
  if (origIdx === -1) return undefined
  return { found: true, content: content.slice(0, origIdx) + newStr + content.slice(origIdx + oldStr.length) }
}

function mapPosition(content: string, normalizedIdx: number): number {
  let orig = 0
  let norm = 0
  let inSpace = false
  while (orig < content.length && norm < normalizedIdx) {
    const ch = content[orig]
    if (!ch) break
    const isSpace = /\s/.test(ch)
    if (isSpace) {
      if (!inSpace) { norm++; inSpace = true }
    } else {
      norm++; inSpace = false
    }
    orig++
  }
  return norm === normalizedIdx ? orig : -1
}

const replacers: Replacer[] = [
  simpleReplacer,
  lineTrimmedReplacer,
  whitespaceNormalizedReplacer,
]

function applyReplace(content: string, oldStr: string, newStr: string): ReplacerResult {
  for (const replacer of replacers) {
    const result = replacer(content, oldStr, newStr)
    if (result?.found) return result
  }
  return { found: false, content }
}

export const EditToolInfo: ToolInfo = {
  id: "edit",
  init: () => ({
    id: "edit",
    description: "Edit a file by replacing exact text. Use this tool to make targeted changes to files without rewriting the entire file.",
    parameters: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "The absolute path to the file to modify" },
        oldString: { type: "string", description: "The text to replace" },
        newString: { type: "string", description: "The text to replace it with (must be different from oldString)" },
        replaceAll: { type: "boolean", description: "Replace all occurrences (default false)" },
      },
      required: ["filePath", "oldString", "newString"],
    },
    async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ExecuteResult> {
      const filePath = args.filePath as string
      const oldString = args.oldString as string
      const newString = args.newString as string
      const replaceAll = args.replaceAll as boolean | undefined

      if (!filePath || !oldString || newString === undefined) {
        throw new Error("Missing required arguments: filePath, oldString, newString")
      }
      if (oldString === newString) {
        throw new Error("oldString and newString must differ")
      }

      const resolvedPath = path.resolve(filePath)

      await ctx.ask({
        permission: "edit",
        patterns: [path.relative(process.cwd(), resolvedPath)],
        always: ["*"],
        metadata: { filePath: resolvedPath },
      })

      const content = fs.readFileSync(resolvedPath, "utf-8")
      const normalized = normalizeLineEndings(content)
      const ending = detectLineEnding(content)

      if (oldString === "") {
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true })
        const toWrite = normalizeLineEndings(newString)
        fs.writeFileSync(resolvedPath, ending === "\r\n" ? toWrite.replaceAll("\n", "\r\n") : toWrite, "utf-8")
        const diff = createTwoFilesPatch("/dev/null", resolvedPath, "", newString, "", "")
        return {
          title: `Created ${path.basename(resolvedPath)}`,
          output: `File created: ${resolvedPath}`,
          metadata: { diff, filePath: resolvedPath },
        }
      }

      if (replaceAll) {
        const result = normalized.split(oldString).join(normalizeLineEndings(newString))
        if (result === normalized) {
          throw new Error(`oldString not found in ${resolvedPath}`)
        }
        const diff = createTwoFilesPatch(resolvedPath, resolvedPath, content, result, "", "")
        fs.writeFileSync(resolvedPath, ending === "\r\n" ? result.replaceAll("\n", "\r\n") : result, "utf-8")
        return {
          title: `Edited ${path.basename(resolvedPath)}`,
          output: `Replaced all occurrences in ${resolvedPath}`,
          metadata: { diff, filePath: resolvedPath },
        }
      }

      const result = applyReplace(normalized, normalizeLineEndings(oldString), normalizeLineEndings(newString))
      if (!result.found) {
        throw new Error(`oldString not found in ${resolvedPath}`)
      }

      const diff = createTwoFilesPatch(resolvedPath, resolvedPath, content, result.content, "", "")
      fs.writeFileSync(resolvedPath, ending === "\r\n" ? result.content.replaceAll("\n", "\r\n") : result.content, "utf-8")

      return {
        title: `Edited ${path.basename(resolvedPath)}`,
        output: `Applied edit to ${resolvedPath}`,
        metadata: { diff, filePath: resolvedPath },
      }
    },
  }),
}

export function createEditTool(): ToolInfo {
  return EditToolInfo
}
