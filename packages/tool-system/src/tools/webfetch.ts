import type { ToolInfo, ToolContext, ExecuteResult } from "../types"
import { truncateOutput } from "../truncation"

export const WebFetchToolInfo: ToolInfo = {
  id: "webfetch",
  init: () => ({
    id: "webfetch",
    description: "Fetch and retrieve content from a URL. Supports markdown, text, and HTML format conversion.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The fully-formed URL to fetch content from" },
        format: { type: "string", enum: ["text", "markdown", "html"], description: "Output format (default: markdown)" },
        timeout: { type: "number", description: "Timeout in seconds (max 120, default 30)" },
      },
      required: ["url"],
    },
    async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ExecuteResult> {
      const url = args.url as string
      const format = (args.format as string) ?? "markdown"
      const timeout = (args.timeout as number) ?? 30

      if (!url) throw new Error("url is required")
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        throw new Error("URL must start with http:// or https://")
      }

      await ctx.ask({
        permission: "webfetch",
        patterns: [url],
        always: ["*"],
        metadata: { url, format, timeout },
      })

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeout * 1000)

      try {
        const headers: Record<string, string> = {
          "User-Agent": "Mozilla/5.0 (compatible; FlowMind/1.0)",
        }

        if (format === "markdown") {
          headers["Accept"] = "text/html, text/markdown; q=0.9, text/plain; q=0.5"
        } else if (format === "text") {
          headers["Accept"] = "text/plain, text/html; q=0.5"
        } else {
          headers["Accept"] = "text/html"
        }

        const response = await fetch(url, { signal: controller.signal, headers })
        clearTimeout(timer)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const contentType = response.headers.get("content-type") ?? ""
        const isImage = contentType.startsWith("image/")

        if (isImage) {
          const buffer = await response.arrayBuffer()
          const base64 = Buffer.from(buffer).toString("base64")
          return {
            title: url,
            output: `Fetched image (${contentType})`,
            metadata: { url, format, contentType },
          }
        }

        const text = await response.text()
        const truncated = await truncateOutput(text)

        return {
          title: url,
          output: truncated.content,
          metadata: {
            url,
            format,
            contentType,
            truncated: truncated.truncated,
            ...(truncated.outputPath ? { outputPath: truncated.outputPath } : {}),
          },
        }
      } catch (e: any) {
        clearTimeout(timer)
        throw new Error(`Failed to fetch ${url}: ${e.message}`)
      }
    },
  }),
}

export function createWebFetchTool(): ToolInfo {
  return WebFetchToolInfo
}
