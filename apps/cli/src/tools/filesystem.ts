import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from "fs"
import { join, relative, resolve, sep } from "path"
import { registerTool, type ToolResult } from "./registry.js"

const WORKSPACE_ROOT = process.cwd()

function resolvePath(inputPath: string): string {
  if (inputPath.startsWith("/")) return inputPath
  return resolve(join(WORKSPACE_ROOT, inputPath))
}

function isWithinWorkspace(filePath: string): boolean {
  const resolved = resolve(filePath)
  return resolved.startsWith(WORKSPACE_ROOT) || resolved.startsWith("/home") || resolved.startsWith("/tmp")
}

export function registerFilesystemTools(): void {
  registerTool({
    name: "read_file",
    description: "Read the contents of a file. Can specify offset and limit for large files.",
    parameters: [
      { name: "path", type: "string", description: "Path to the file (absolute or relative)", required: true },
      { name: "offset", type: "number", description: "Line number to start reading from (1-indexed)", required: false },
      { name: "limit", type: "number", description: "Maximum number of lines to read", required: false },
    ],
    execute: async (args): Promise<ToolResult> => {
      const filePath = resolvePath(args.path)
      if (!existsSync(filePath)) {
        return { success: false, output: "", error: `File not found: ${args.path}` }
      }
      const content = readFileSync(filePath, "utf-8")
      const lines = content.split("\n")
      const offset = args.offset || 1
      const limit = args.limit || lines.length
      const selected = lines.slice(offset - 1, offset - 1 + limit)
      const output = selected.map((line, i) => `${offset + i}: ${line}`).join("\n")
      const total = lines.length
      const shown = selected.length
      return {
        success: true,
        output: output || "(empty file)",
        data: { totalLines: total, shownLines: shown, filePath },
      }
    },
  })

  registerTool({
    name: "write_file",
    description: "Write content to a file. Creates parent directories if needed. Overwrites existing content.",
    parameters: [
      { name: "path", type: "string", description: "Path to the file (absolute or relative)", required: true },
      { name: "content", type: "string", description: "Content to write to the file", required: true },
    ],
    execute: async (args): Promise<ToolResult> => {
      const filePath = resolvePath(args.path)
      const dir = filePath.split(sep).slice(0, -1).join(sep)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(filePath, args.content, "utf-8")
      return { success: true, output: `Written ${args.content.length} bytes to ${args.path}`, data: { filePath, size: args.content.length } }
    },
  })

  registerTool({
    name: "edit_file",
    description: "Edit a file by replacing exact text. Uses exact string matching — provide enough context for uniqueness.",
    parameters: [
      { name: "path", type: "string", description: "Path to the file", required: true },
      { name: "oldString", type: "string", description: "Exact text to find and replace", required: true },
      { name: "newString", type: "string", description: "Text to replace with", required: true },
    ],
    execute: async (args): Promise<ToolResult> => {
      const filePath = resolvePath(args.path)
      if (!existsSync(filePath)) {
        return { success: false, output: "", error: `File not found: ${args.path}` }
      }
      const content = readFileSync(filePath, "utf-8")
      const count = (content.match(new RegExp(escapeRegex(args.oldString), "g")) || []).length
      if (count === 0) {
        return { success: false, output: "", error: `Could not find oldString in file: ${args.path}` }
      }
      const newContent = content.replace(args.oldString, args.newString)
      writeFileSync(filePath, newContent, "utf-8")
      return { success: true, output: `Replaced ${count} occurrence${count > 1 ? "s" : ""} in ${args.path}`, data: { filePath } }
    },
  })

  registerTool({
    name: "list_files",
    description: "List files and directories in a given path.",
    parameters: [
      { name: "path", type: "string", description: "Directory path to list", required: false },
    ],
    execute: async (args): Promise<ToolResult> => {
      const dirPath = resolvePath(args.path || ".")
      if (!existsSync(dirPath)) {
        return { success: false, output: "", error: `Directory not found: ${args.path || "."}` }
      }
      const entries = readdirSync(dirPath)
      const items = entries.map(e => {
        const full = join(dirPath, e)
        const isDir = statSync(full).isDirectory()
        return `${isDir ? "📁" : "📄"} ${e}${isDir ? "/" : ""}`
      })
      return { success: true, output: items.join("\n"), data: { entries: items, count: items.length } }
    },
  })

  registerTool({
    name: "delete_file",
    description: "Delete a file or empty directory.",
    parameters: [
      { name: "path", type: "string", description: "Path to delete", required: true },
    ],
    execute: async (args): Promise<ToolResult> => {
      const filePath = resolvePath(args.path)
      if (!existsSync(filePath)) {
        return { success: false, output: "", error: `Not found: ${args.path}` }
      }
      unlinkSync(filePath)
      return { success: true, output: `Deleted: ${args.path}`, data: { filePath } }
    },
  })

  registerTool({
    name: "glob_files",
    description: "Find files matching a glob pattern (e.g. '**/*.ts', 'src/**/*.css').",
    parameters: [
      { name: "pattern", type: "string", description: "Glob pattern to search with", required: true },
      { name: "path", type: "string", description: "Base directory (defaults to current)", required: false },
    ],
    execute: async (args): Promise<ToolResult> => {
      const basePath = resolvePath(args.path || ".")
      const pattern = args.pattern
      const results: string[] = []

      try {
        const { execSync } = await import("child_process")
        const output = execSync(`find ${basePath} -type f -name "${pattern.replace(/\*/g, "*")}" 2>/dev/null | head -200`, { encoding: "utf-8", timeout: 5000 })
        results.push(...output.trim().split("\n").filter(Boolean).map(f => f.replace(basePath + "/", "")))
      } catch {
        // fallback: simple recursive walk
        const { readdirSync, statSync } = await import("fs")
        const { join } = await import("path")
        function walk(dir: string, depth: number = 0): void {
          if (depth > 3) return
          try {
            const entries = readdirSync(dir)
            for (const entry of entries) {
              const full = join(dir, entry)
              try {
                if (statSync(full).isDirectory()) {
                  walk(full, depth + 1)
                } else {
                  const rel = full.replace(basePath + "/", "")
                  if (rel.includes(pattern.replace("*", "").replace("**", ""))) {
                    results.push(rel)
                  }
                }
              } catch {}
            }
          } catch {}
        }
        walk(basePath)
      }

      if (results.length === 0) {
        return { success: true, output: "No files found matching pattern.", data: { files: [], count: 0 } }
      }
      return { success: true, output: results.slice(0, 100).map(f => `  ${f}`).join("\n"), data: { files: results.slice(0, 100), count: results.length } }
    },
  })
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
