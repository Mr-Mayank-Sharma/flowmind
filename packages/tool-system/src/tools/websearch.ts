import type { ToolInfo, ToolContext, ExecuteResult } from "../types"
import { truncateOutput } from "../truncation"

interface SearchResult {
  title: string
  url: string
  content: string
}

export const WebSearchToolInfo: ToolInfo = {
  id: "websearch",
  init: () => ({
    id: "websearch",
    description: "Search the web for information. Returns relevant web results with snippets. Use this to get up-to-date information.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
        numResults: { type: "number", description: "Number of search results to return (default: 8)" },
        livecrawl: { type: "string", enum: ["fallback", "preferred"], description: "Live crawl mode" },
        type: { type: "string", enum: ["auto", "fast", "deep"], description: "Search type" },
      },
      required: ["query"],
    },
    async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ExecuteResult> {
      const query = args.query as string
      if (!query) throw new Error("query is required")

      await ctx.ask({
        permission: "websearch",
        patterns: [query],
        always: ["*"],
        metadata: { query },
      })

      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 15000)

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; FlowMind/1.0)" },
        })
        clearTimeout(timer)

        const html = await response.text()
        const results = parseDuckDuckGo(html).slice(0, (args.numResults as number) ?? 8)

        if (results.length === 0) {
          return {
            title: query,
            output: "No search results found",
            metadata: { count: 0 },
          }
        }

        const output = results.map((r, i) =>
          `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.content.slice(0, 300)}`
        ).join("\n\n")

        return {
          title: query,
          output: `Web search results for "${query}":\n\n${output}`,
          metadata: { count: results.length },
        }
      } catch (e: any) {
        clearTimeout(timer)
        throw new Error(`Search failed: ${e.message}`)
      }
    },
  }),
}

function parseDuckDuckGo(html: string): SearchResult[] {
  const results: SearchResult[] = []
  const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
  let match: RegExpExecArray | null
  while ((match = resultRegex.exec(html)) !== null) {
    results.push({
      url: match[1]?.replace(/\/\/duckduckgo\.com\/l\/\?uddg=/, "") ?? "",
      title: match[2]?.replace(/<[^>]*>/g, "").trim() ?? "",
      content: match[3]?.replace(/<[^>]*>/g, "").trim() ?? "",
    })
  }
  return results
}

export function createWebSearchTool(): ToolInfo {
  return WebSearchToolInfo
}
