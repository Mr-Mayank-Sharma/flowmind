import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { registerTool, type ToolResult } from "./registry.js"

export function registerSearchTools(): void {
  registerTool({
    name: "search_code",
    description: "Search file contents using a regular expression pattern. Returns matching files and line numbers.",
    parameters: [
      { name: "pattern", type: "string", description: "Regex pattern to search for", required: true },
      { name: "path", type: "string", description: "Directory to search in (defaults to current)", required: false },
      { name: "include", type: "string", description: "File pattern to include (e.g. '*.ts', '*.{ts,tsx}')", required: false },
    ],
    execute: async (args): Promise<ToolResult> => {
      const searchPath = args.path || "."
      const include = args.include ? `--include '${args.include}'` : ""
      const { execSync } = await import("child_process")
      try {
        const command = `rg -n '${args.pattern.replace(/'/g, "'\\''")}' ${include} ${searchPath} 2>/dev/null || true`
        const output = execSync(command, { encoding: "utf-8", maxBuffer: 5 * 1024 * 1024 })
        const lines = output.trim().split("\n").filter(Boolean)
        if (lines.length === 0) {
          return { success: true, output: "No matches found.", data: { matches: [], count: 0 } }
        }
        const truncated = lines.length > 100 ? lines.slice(0, 100).join("\n") + `\n... (${lines.length - 100} more matches)` : lines.join("\n")
        return { success: true, output: truncated, data: { matches: lines, count: lines.length } }
      } catch {
        return { success: true, output: "No matches found (rg not available or no matches).", data: { matches: [], count: 0 } }
      }
    },
  })

  registerTool({
    name: "grep_code",
    description: "Simple text search in files (fallback when ripgrep is not available).",
    parameters: [
      { name: "pattern", type: "string", description: "Text to search for", required: true },
      { name: "path", type: "string", description: "Directory to search", required: false },
      { name: "include", type: "string", description: "File extension filter", required: false },
    ],
    execute: async (args): Promise<ToolResult> => {
      const searchPath = args.path || "."
      const { readdirSync, statSync } = await import("fs")
      const { join } = await import("path")
      const allFiles: string[] = []
      function walk(dir: string, depth: number = 0): void {
        if (depth > 4) return
        try {
          for (const entry of readdirSync(dir)) {
            const full = join(dir, entry)
            try {
              if (statSync(full).isDirectory()) walk(full, depth + 1)
              else allFiles.push(full.replace(searchPath + "/", ""))
            } catch {}
          }
        } catch {}
      }
      walk(searchPath)
      const files = allFiles.filter(f => !args.include || f.endsWith(args.include.replace("*", "")))
      const results: string[] = []
      for (const file of files.slice(0, 500)) {
        try {
          const content = readFileSync(join(searchPath, file), "utf-8")
          const lines = content.split("\n")
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(args.pattern)) {
              results.push(`${file}:${i + 1}: ${lines[i].trim()}`)
            }
          }
        } catch {}
      }
      if (results.length === 0) {
        return { success: true, output: "No matches found.", data: { matches: [], count: 0 } }
      }
      const truncated = results.length > 100 ? results.slice(0, 100).join("\n") + `\n... (${results.length - 100} more)` : results.join("\n")
      return { success: true, output: truncated, data: { matches: results, count: results.length } }
    },
  })
}
