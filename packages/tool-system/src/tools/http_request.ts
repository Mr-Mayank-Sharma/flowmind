import type { ToolInfo, ToolContext, ExecuteResult } from "../types"
import { truncateOutput } from "../truncation"
import { fetchPublic, BlockedUrlError } from "@flowmind/pipeline-engine/src/network-guard"

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"])

const MAX_BODY_BYTES = 4 * 1024 * 1024

export const HttpRequestToolInfo: ToolInfo = {
  id: "http_request",
  init: () => ({
    id: "http_request",
    description:
      "Make an HTTP request to a public API. Supports GET, POST, PUT, PATCH, and DELETE methods with a JSON body and custom headers. Protected against SSRF (private/loopback hosts are refused).",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The fully-formed public http/https URL to call" },
        method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"], description: "HTTP method (default: GET)" },
        headers: { type: "object", description: "Optional HTTP headers as a string-to-string object" },
        body: { type: "object", description: "Optional JSON request body (ignored for GET)" },
        timeoutMs: { type: "number", description: "Request timeout in milliseconds (default: 10000)" },
      },
      required: ["url"],
    },
    async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ExecuteResult> {
      const url = args.url as string
      const method = ((args.method as string) ?? "GET").toUpperCase()
      const headers = (args.headers as Record<string, string>) ?? {}
      const body = args.body as Record<string, unknown> | undefined
      const timeoutMs = (args.timeoutMs as number) ?? 10_000

      if (!url) throw new Error("url is required")
      if (!HTTP_METHODS.has(method)) throw new Error(`Unsupported HTTP method: ${method}`)

      await ctx.ask({
        permission: "http_request",
        patterns: [url],
        always: ["*"],
        metadata: { url, method, timeoutMs },
      })

      let payload: string | undefined
      if (body !== undefined) {
        if (method === "GET") throw new Error("GET requests cannot have a body")
        const serialized = JSON.stringify(body)
        if (Buffer.byteLength(serialized, "utf-8") > MAX_BODY_BYTES) {
          throw new Error(`Request body exceeds ${MAX_BODY_BYTES} bytes`)
        }
        payload = serialized
      }

      try {
        const response = await fetchPublic(url, {
          method,
          headers,
          body: payload,
          timeoutMs,
        })

        const responseBody = await response.text()
        const contentType = response.headers.get("content-type") ?? ""
        let parsed: unknown = responseBody
        if (contentType.includes("application/json") || responseBody.trim().startsWith("{")) {
          try {
            parsed = JSON.parse(responseBody)
          } catch {
            parsed = responseBody
          }
        }

        const serialized = typeof parsed === "string" ? parsed : JSON.stringify(parsed)
        const truncated = await truncateOutput(serialized)

        return {
          title: `${method} ${url}`,
          output: `Status ${response.status}\n\n${truncated.content}`,
          metadata: {
            url,
            method,
            status: response.status,
            statusText: response.statusText,
            contentType,
            body: parsed,
            truncated: truncated.truncated,
            ...(truncated.outputPath ? { outputPath: truncated.outputPath } : {}),
          },
        }
      } catch (err) {
        if (err instanceof BlockedUrlError) {
          throw new Error(`Refused: ${err.message}`)
        }
        const message = err instanceof Error ? err.message : String(err)
        throw new Error(`HTTP request to ${url} failed: ${message}`)
      }
    },
  }),
}

export function createHttpRequestTool(): ToolInfo {
  return HttpRequestToolInfo
}
