import { NextRequest, NextResponse } from "next/server"
import { execSync } from "child_process"
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs"
import { join, resolve } from "path"

export const runtime = "nodejs"

interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

function resolvePath(p: string): string {
  let full = resolve(p)
  if (!existsSync(full)) {
    const alt = resolve("../../", p)
    if (existsSync(alt)) full = alt
  }
  return full
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, history } = body as { message: string; history: ChatMessage[] }

    const lower = message.toLowerCase()

    if (lower.startsWith("read ") || lower.startsWith("show ")) {
      const fileMatch = message.match(/(?:read|show|open|get)\s+[`']?([^`'"]+)[`']?/i)
      const filePath = fileMatch?.[1]?.trim()
      const fullPath = filePath ? resolvePath(filePath) : ""
      if (filePath && existsSync(fullPath)) {
        const content = readFileSync(fullPath, "utf-8")
        const lines = content.split("\n")
        const shown = lines.slice(0, 50).map((l, i) => `${i + 1}: ${l}`).join("\n")
        const truncated = lines.length > 50 ? `\n\n... (${lines.length - 50} more lines)` : ""
        return NextResponse.json({
          content: `Here's what I found in \`${filePath}\`:\n\n\`\`\`\n${shown}${truncated}\n\`\`\``,
          toolCalls: [{ id: "tc1", name: "read_file", arguments: JSON.stringify({ path: filePath }) }],
        })
      }
    }

    const projectRoot = resolve("../../")

    if (lower.startsWith("run ") || lower.startsWith("execute ")) {
      const cmdMatch = message.match(/(?:run|execute)\s+`([^`]+)`/) || message.match(/^(?:run|execute)\s+(.+)$/i)
      const command = cmdMatch?.[1]?.trim()
      if (command) {
        try {
          const output = execSync(command, { encoding: "utf-8", timeout: 10000, maxBuffer: 1024 * 1024, cwd: projectRoot })
          const lines = output.trim().split("\n")
          const shown = lines.slice(0, 30).join("\n")
          const truncated = lines.length > 30 ? `\n... (${lines.length - 30} more lines)` : ""
          return NextResponse.json({
            content: `Command executed successfully:\n\n\`\`\`\n${shown}${truncated}\n\`\`\``,
            toolCalls: [{ id: "tc1", name: "run_bash", arguments: JSON.stringify({ command }), result: output.slice(0, 1000) }],
          })
        } catch (err: any) {
          return NextResponse.json({
            content: `Command failed:\n\n\`\`\`\n${err.stderr || err.message}\n\`\`\``,
            toolCalls: [{ id: "tc1", name: "run_bash", arguments: JSON.stringify({ command }), result: err.message }],
          })
        }
      }
    }

    if (lower.startsWith("search ") || lower.startsWith("find ") || lower.startsWith("grep ")) {
      const searchMatch = message.match(/(?:search|find|grep)\s+["']?([^"']+?)["']?(?:\s+in\s+["']?([^"']+)["']?)?$/i)
      const pattern = searchMatch?.[1]?.trim()
      const rawPath = searchMatch?.[2]?.trim() || "."
      const searchPath = resolvePath(rawPath)
      if (pattern) {
        const p = pattern
        const results: string[] = []
        function walk(dir: string, depth = 0) {
          if (depth > 3) return
          try {
            for (const entry of readdirSync(dir)) {
              const full = join(dir, entry)
              try {
                if (statSync(full).isDirectory()) walk(full, depth + 1)
                else {
                  const content = readFileSync(full, "utf-8")
                  const lines = content.split("\n")
                  lines.forEach((line, i) => {
                    if (line.toLowerCase().includes(p.toLowerCase())) {
                      results.push(`${full.replace(projectRoot + "/", "")}:${i + 1}: ${line.trim()}`)
                    }
                  })
                }
              } catch {}
            }
          } catch {}
        }
        if (existsSync(searchPath)) walk(searchPath)
        if (results.length > 0) {
          const shown = results.slice(0, 20).join("\n")
          const truncated = results.length > 20 ? `\n... (${results.length - 20} more matches)` : ""
          return NextResponse.json({
            content: `Found ${results.length} matches:\n\n\`\`\`\n${shown}${truncated}\n\`\`\``,
            toolCalls: [{ id: "tc1", name: "search_code", arguments: JSON.stringify({ pattern, path: rawPath }), result: results.slice(0, 10).join("\n") }],
          })
        }
        return NextResponse.json({
          content: `No matches found for "${pattern}" in ${rawPath}.`,
          toolCalls: [{ id: "tc1", name: "search_code", arguments: JSON.stringify({ pattern, path: rawPath }) }],
        })
      }
    }

    if (lower.includes("list") && (lower.includes("file") || lower.includes("directory") || lower.includes("dir"))) {
      const dirMatch = message.match(/(?:in|of|directory|dir)\s+[`']?([^`'"\s]+)[`']?/i) || message.match(/files\s+in\s+[`']?([^`'"\s]+)/i)
      const rawDir = dirMatch?.[1]?.trim() || "."
      const dir = resolvePath(rawDir)
      if (existsSync(dir)) {
        const entries = readdirSync(dir)
        const items = entries.map(e => {
          const isDir = statSync(join(dir, e)).isDirectory()
          return `${isDir ? "📁" : "📄"} ${e}${isDir ? "/" : ""}`
        })
        return NextResponse.json({
          content: `Contents of \`${rawDir}\`:\n\n${items.join("\n")}`,
          toolCalls: [{ id: "tc1", name: "list_files", arguments: JSON.stringify({ path: rawDir }) }],
        })
      }
    }

    return NextResponse.json({
      content: `I understand you're asking about "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}". I can help with:\n\n- **Reading files**: \`read path/to/file\`\n- **Running commands**: \`run command\`\n- **Searching code**: \`search pattern in path\`\n- **Listing directories**: \`list files in path\`\n- Managing agents, pipelines, and models\n\nWhat would you like me to do?`,
      toolCalls: [],
    })
  } catch (err: any) {
    console.error(JSON.stringify({ level: "error", timestamp: new Date().toISOString(), message: "Agent chat route failed", error: err.message }))
    return NextResponse.json({ content: `Error: ${err.message}` }, { status: 500 })
  }
}
