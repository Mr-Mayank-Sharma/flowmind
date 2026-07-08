import path from "path"
import fs from "fs"

const MAX_LINES = 2000
const MAX_BYTES = 50 * 1024

const TRUNCATION_DIR = path.join(process.cwd(), ".flowmind", "tool-output")

let idCounter = 0

export interface TruncationResult {
  content: string
  truncated: boolean
  outputPath?: string
}

export async function truncateOutput(text: string): Promise<TruncationResult> {
  const lines = text.split("\n")
  const bytes = Buffer.byteLength(text, "utf-8")

  if (lines.length <= MAX_LINES && bytes <= MAX_BYTES) {
    return { content: text, truncated: false }
  }

  const truncated = lines.slice(0, MAX_LINES).join("\n")
  const truncatedBytes = Buffer.byteLength(truncated, "utf-8")
  const preview = truncatedBytes > MAX_BYTES
    ? truncated.slice(0, MAX_BYTES)
    : truncated

  const id = `tool_${++idCounter}`
  const fullPath = path.join(TRUNCATION_DIR, id)

  fs.mkdirSync(TRUNCATION_DIR, { recursive: true })
  fs.writeFileSync(fullPath, text, "utf-8")

  return {
    content: `${preview}\n\n(Output truncated: showing ${preview.length} of ${bytes} bytes. Use the read tool to view "${fullPath}" for full output.)`,
    truncated: true,
    outputPath: fullPath,
  }
}

export function cleanupTruncation(): void {
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  if (!fs.existsSync(TRUNCATION_DIR)) return

  for (const file of fs.readdirSync(TRUNCATION_DIR)) {
    const full = path.join(TRUNCATION_DIR, file)
    try {
      const stat = fs.statSync(full)
      if (Date.now() - stat.mtimeMs > sevenDays) {
        fs.unlinkSync(full)
      }
    } catch {}
  }
}
