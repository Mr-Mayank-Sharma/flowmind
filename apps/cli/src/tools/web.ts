import { registerTool, type ToolResult } from "./registry.js"

export function registerWebTools(): void {
  registerTool({
    name: "web_fetch",
    description: "Fetch content from a URL. Returns the content as markdown or text.",
    parameters: [
      { name: "url", type: "string", description: "URL to fetch", required: true },
      { name: "format", type: "string", description: "Format: 'markdown', 'text', or 'html'", required: false },
    ],
    execute: async (args): Promise<ToolResult> => {
      try {
        const response = await fetch(args.url, {
          signal: AbortSignal.timeout(15000),
          headers: { "User-Agent": "FlowMind-AI/1.0" },
        })
        if (!response.ok) {
          return { success: false, output: "", error: `HTTP ${response.status}: ${response.statusText}` }
        }
        const text = await response.text()
        const format = args.format || "markdown"
        const truncated = text.length > 10000 ? text.slice(0, 10000) + `\n... (${text.length - 10000} more characters truncated)` : text
        return { success: true, output: truncated, data: { contentType: response.headers.get("content-type"), size: text.length } }
      } catch (err: any) {
        return { success: false, output: "", error: `Fetch failed: ${err.message}` }
      }
    },
  })

  registerTool({
    name: "web_search",
    description: "Search the web for information. Returns search results with snippets.",
    parameters: [
      { name: "query", type: "string", description: "Search query", required: true },
      { name: "numResults", type: "number", description: "Number of results (default 5)", required: false },
    ],
    execute: async (args): Promise<ToolResult> => {
      try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15000),
          headers: { "User-Agent": "Mozilla/5.0 (compatible; FlowMind/1.0)" },
        })
        const html = await response.text()

        const results: string[] = []
        const resultRegex = /<a rel="nofollow" class="result__a" href="([^"]+)">([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([^<]+)<\/a>/g
        let match
        let count = 0
        const maxResults = args.numResults || 5
        while ((match = resultRegex.exec(html)) !== null && count < maxResults) {
          results.push(`${count + 1}. ${match[2].trim()}\n   URL: ${match[1]}\n   ${match[3].trim().replace(/<[^>]*>/g, "")}`)
          count++
        }

        if (results.length === 0) {
          return { success: true, output: "No search results found. Try a different query.", data: { results: [] } }
        }
        return { success: true, output: results.join("\n\n"), data: { results, count: results.length } }
      } catch (err: any) {
        return { success: false, output: "", error: `Search failed: ${err.message}. Try a different query format.` }
      }
    },
  })
}
