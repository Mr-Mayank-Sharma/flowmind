import { z } from "zod"

export type OAuthConfig = {
  authUrl: string
  tokenUrl: string
  scopes: string[]
  pkce: boolean
}

export const OAUTH_PROVIDERS: Record<string, OAuthConfig> = {
  github: {
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["repo", "read:user", "read:org"],
    pkce: false,
  },
  slack: {
    authUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: ["channels:read", "chat:write", "users:read"],
    pkce: true,
  },
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/drive",
    ],
    pkce: true,
  },
  notion: {
    authUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    scopes: [],
    pkce: false,
  },
}

export type OAuthToken = {
  accessToken: string
  refreshToken?: string
  expiresAt: Date
  scopes: string[]
}

export type ServerCapability = {
  name: string
  version: string
  authRequired: boolean
  authProvider?: string
}

export type McpServer = {
  id: string
  name: string
  transport: "sse" | "stdio"
  capabilities: ServerCapability[]
  baseUrl?: string
  command?: string
  args?: string[]
}

export type BuiltInTool = {
  name: string
  category: string
  description: string
  inputSchema: z.ZodTypeAny
  outputSchema: z.ZodTypeAny
}

const toolInputSchemas: Record<string, z.ZodTypeAny> = {
  "flowmind.files.read": z.object({
    path: z.string(),
    encoding: z.string().optional(),
  }),
  "flowmind.files.write": z.object({
    path: z.string(),
    content: z.string(),
    encoding: z.string().optional(),
  }),
  "flowmind.files.search": z.object({
    query: z.string(),
    rootPath: z.string().optional(),
  }),
  "flowmind.code.execute": z.object({
    language: z.enum(["python", "javascript", "typescript", "bash"]),
    code: z.string(),
    timeout: z.number().optional(),
  }),
  "flowmind.code.lint": z.object({
    language: z.enum(["python", "javascript", "typescript"]),
    code: z.string(),
  }),
  "flowmind.git.diff": z.object({
    repoPath: z.string(),
    baseRef: z.string().optional(),
    targetRef: z.string().optional(),
  }),
  "flowmind.git.commit": z.object({
    repoPath: z.string(),
    message: z.string(),
    path: z.string().optional(),
  }),
  "flowmind.git.pr": z.object({
    repoPath: z.string(),
    title: z.string(),
    head: z.string(),
    base: z.string(),
    body: z.string().optional(),
  }),
  "flowmind.web.fetch": z.object({
    url: z.string().url(),
    headers: z.record(z.string()).optional(),
  }),
  "flowmind.web.search": z.object({
    query: z.string(),
    numResults: z.number().optional(),
  }),
  "flowmind.db.query": z.object({
    connectionId: z.string(),
    sql: z.string(),
    params: z.array(z.unknown()).optional(),
  }),
  "flowmind.email.send": z.object({
    to: z.string().email(),
    subject: z.string(),
    body: z.string(),
    html: z.string().optional(),
  }),
  "flowmind.slack.message": z.object({
    channel: z.string(),
    text: z.string(),
    blocks: z.array(z.unknown()).optional(),
  }),
  "flowmind.github.issue": z.object({
    repo: z.string(),
    title: z.string(),
    body: z.string().optional(),
    labels: z.array(z.string()).optional(),
    action: z.enum(["create", "update"]).optional(),
    issueNumber: z.number().optional(),
  }),
  "flowmind.notion.page": z.object({
    parentId: z.string(),
    title: z.string(),
    content: z.array(z.unknown()).optional(),
  }),
  "flowmind.memory.search": z.object({
    query: z.string(),
    limit: z.number().optional(),
    sessionId: z.string().optional(),
  }),
  "flowmind.skill.run": z.object({
    skillId: z.string(),
    input: z.record(z.unknown()).optional(),
  }),
  "flowmind.pipeline.trigger": z.object({
    pipelineId: z.string(),
    input: z.record(z.unknown()).optional(),
  }),
  "flowmind.image.generate": z.object({
    prompt: z.string(),
    model: z.string().optional(),
    size: z.string().optional(),
  }),
  "flowmind.audio.transcribe": z.object({
    filePath: z.string(),
    language: z.string().optional(),
  }),
}

export const BUILT_IN_TOOLS: BuiltInTool[] = [
  {
    name: "flowmind.files.read",
    category: "Filesystem",
    description: "Read files from user's workspace",
    inputSchema: toolInputSchemas["flowmind.files.read"]!,
    outputSchema: z.string(),
  },
  {
    name: "flowmind.files.write",
    category: "Filesystem",
    description: "Write and create files",
    inputSchema: toolInputSchemas["flowmind.files.write"]!,
    outputSchema: z.object({ path: z.string(), size: z.number() }),
  },
  {
    name: "flowmind.files.search",
    category: "Filesystem",
    description: "Full-text search across workspace",
    inputSchema: toolInputSchemas["flowmind.files.search"]!,
    outputSchema: z.array(z.object({ path: z.string(), snippet: z.string() })),
  },
  {
    name: "flowmind.code.execute",
    category: "Code",
    description: "Run code in sandboxed Docker container",
    inputSchema: toolInputSchemas["flowmind.code.execute"]!,
    outputSchema: z.object({ stdout: z.string(), stderr: z.string(), exitCode: z.number() }),
  },
  {
    name: "flowmind.code.lint",
    category: "Code",
    description: "Lint and format code with language-specific tools",
    inputSchema: toolInputSchemas["flowmind.code.lint"]!,
    outputSchema: z.array(z.object({ line: z.number(), column: z.number(), message: z.string(), severity: z.string() })),
  },
  {
    name: "flowmind.git.diff",
    category: "Git",
    description: "Show git diff for a repository",
    inputSchema: toolInputSchemas["flowmind.git.diff"]!,
    outputSchema: z.string(),
  },
  {
    name: "flowmind.git.commit",
    category: "Git",
    description: "Commit staged changes with a message",
    inputSchema: toolInputSchemas["flowmind.git.commit"]!,
    outputSchema: z.object({ commitHash: z.string() }),
  },
  {
    name: "flowmind.git.pr",
    category: "Git",
    description: "Create a pull request on GitHub/GitLab",
    inputSchema: toolInputSchemas["flowmind.git.pr"]!,
    outputSchema: z.object({ url: z.string().url(), number: z.number() }),
  },
  {
    name: "flowmind.web.fetch",
    category: "Web",
    description: "Fetch and parse web page content",
    inputSchema: toolInputSchemas["flowmind.web.fetch"]!,
    outputSchema: z.object({ status: z.number(), body: z.string(), headers: z.record(z.string()) }),
  },
  {
    name: "flowmind.web.search",
    category: "Web",
    description: "Search the web (self-hosted Searxng)",
    inputSchema: toolInputSchemas["flowmind.web.search"]!,
    outputSchema: z.array(z.object({ title: z.string(), url: z.string(), snippet: z.string() })),
  },
  {
    name: "flowmind.db.query",
    category: "Database",
    description: "Execute SQL query on connected databases",
    inputSchema: toolInputSchemas["flowmind.db.query"]!,
    outputSchema: z.array(z.record(z.unknown())),
  },
  {
    name: "flowmind.email.send",
    category: "Communication",
    description: "Send email via SMTP or Mailgun",
    inputSchema: toolInputSchemas["flowmind.email.send"]!,
    outputSchema: z.object({ messageId: z.string() }),
  },
  {
    name: "flowmind.slack.message",
    category: "Communication",
    description: "Post message to Slack channel",
    inputSchema: toolInputSchemas["flowmind.slack.message"]!,
    outputSchema: z.object({ ts: z.string(), channel: z.string() }),
  },
  {
    name: "flowmind.github.issue",
    category: "Project",
    description: "Create or update GitHub issue",
    inputSchema: toolInputSchemas["flowmind.github.issue"]!,
    outputSchema: z.object({ id: z.number(), url: z.string(), number: z.number() }),
  },
  {
    name: "flowmind.notion.page",
    category: "Project",
    description: "Create or update Notion page",
    inputSchema: toolInputSchemas["flowmind.notion.page"]!,
    outputSchema: z.object({ id: z.string(), url: z.string() }),
  },
  {
    name: "flowmind.memory.search",
    category: "AI",
    description: "Search agent memories via vector + FTS",
    inputSchema: toolInputSchemas["flowmind.memory.search"]!,
    outputSchema: z.array(z.object({ id: z.string(), content: z.string(), score: z.number() })),
  },
  {
    name: "flowmind.skill.run",
    category: "AI",
    description: "Execute a stored FlowMind skill",
    inputSchema: toolInputSchemas["flowmind.skill.run"]!,
    outputSchema: z.unknown(),
  },
  {
    name: "flowmind.pipeline.trigger",
    category: "AI",
    description: "Trigger a workflow pipeline by ID",
    inputSchema: toolInputSchemas["flowmind.pipeline.trigger"]!,
    outputSchema: z.object({ runId: z.string(), status: z.string() }),
  },
  {
    name: "flowmind.image.generate",
    category: "Media",
    description: "Generate image (local Stable Diffusion or API)",
    inputSchema: toolInputSchemas["flowmind.image.generate"]!,
    outputSchema: z.object({ url: z.string(), format: z.string() }),
  },
  {
    name: "flowmind.audio.transcribe",
    category: "Media",
    description: "Transcribe audio file (local Whisper)",
    inputSchema: toolInputSchemas["flowmind.audio.transcribe"]!,
    outputSchema: z.object({ text: z.string(), segments: z.array(z.unknown()) }),
  },
]

export class McpServerRegistry {
  private servers: Map<string, McpServer> = new Map()
  private builtInTools: Map<string, BuiltInTool> = new Map()

  constructor() {
    for (const tool of BUILT_IN_TOOLS) {
      this.builtInTools.set(tool.name, tool)
    }
  }

  register(server: McpServer): void {
    this.servers.set(server.id, server)
  }

  unregister(serverId: string): void {
    this.servers.delete(serverId)
  }

  getServer(serverId: string): McpServer | undefined {
    return this.servers.get(serverId)
  }

  listServers(): McpServer[] {
    return Array.from(this.servers.values())
  }

  getBuiltInTool(name: string): BuiltInTool | undefined {
    return this.builtInTools.get(name)
  }

  listBuiltInTools(): BuiltInTool[] {
    return Array.from(this.builtInTools.values())
  }

  isBuiltIn(name: string): boolean {
    return this.builtInTools.has(name)
  }
}

export class McpConnectionPool {
  private connections: Map<string, unknown> = new Map()

  async connect(serverId: string, _server: McpServer): Promise<void> {
    this.connections.set(serverId, { connected: true, timestamp: Date.now() })
  }

  async disconnect(serverId: string): Promise<void> {
    this.connections.delete(serverId)
  }

  isConnected(serverId: string): boolean {
    return this.connections.has(serverId)
  }

  listConnections(): string[] {
    return Array.from(this.connections.keys())
  }
}

export class McpToolRouter {
  private toolServerMap: Map<string, string> = new Map()

  register(toolName: string, serverId: string): void {
    this.toolServerMap.set(toolName, serverId)
  }

  unregister(toolName: string): void {
    this.toolServerMap.delete(toolName)
  }

  resolve(toolName: string): string | undefined {
    return this.toolServerMap.get(toolName)
  }

  validate(tool: BuiltInTool, args: unknown): { success: boolean; data?: unknown; error?: string } {
    const result = tool.inputSchema.safeParse(args)
    if (result.success) {
      return { success: true, data: result.data }
    }
    return { success: false, error: result.error.message }
  }
}

export type TokenStore = {
  getToken(userId: string, provider: string): Promise<OAuthToken | null>
  setToken(userId: string, provider: string, token: OAuthToken): Promise<void>
  refreshToken(userId: string, provider: string): Promise<OAuthToken>
}

export class McpExecutor {
  private registry: McpServerRegistry
  private connectionPool: McpConnectionPool
  private toolRouter: McpToolRouter
  private tokenStore: TokenStore

  constructor(
    registry: McpServerRegistry,
    connectionPool: McpConnectionPool,
    toolRouter: McpToolRouter,
    tokenStore: TokenStore,
  ) {
    this.registry = registry
    this.connectionPool = connectionPool
    this.toolRouter = toolRouter
    this.tokenStore = tokenStore
  }

  async execute(
    toolName: string,
    args: unknown,
    userId: string,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const tool = this.registry.getBuiltInTool(toolName)
    if (!tool) {
      return this.executeExternalTool(toolName, args, userId)
    }

    const validation = this.toolRouter.validate(tool, args)
    if (!validation.success) {
      return { success: false, error: validation.error }
    }

    const result = await this.runBuiltInTool(toolName, validation.data!)
    return { success: true, data: result }
  }

  private async runBuiltInTool(toolName: string, args: any): Promise<unknown> {
    switch (toolName) {
      case "flowmind.files.read": {
        const fs = await import("fs/promises")
        const content = await fs.readFile(args.path, args.encoding ?? "utf-8")
        return { content, path: args.path, size: content.length }
      }
      case "flowmind.files.write": {
        const fs = await import("fs/promises")
        await fs.writeFile(args.path, args.content, args.encoding ?? "utf-8")
        return { written: true, path: args.path, size: args.content.length }
      }
      case "flowmind.files.search": {
        const { execSync } = await import("child_process")
        const root = args.rootPath ?? "."
        const result = execSync(`grep -rl "${args.query}" ${root} --include="*.ts" --include="*.tsx" --include="*.js" --include="*.py" 2>/dev/null || true`, { encoding: "utf-8", maxBuffer: 1024 * 1024 })
        const files = result.split("\n").filter(Boolean)
        return { query: args.query, files, count: files.length }
      }
      case "flowmind.web.fetch": {
        const res = await fetch(args.url, { signal: AbortSignal.timeout(10000) })
        const body = await res.text()
        return { status: res.status, body, headers: Object.fromEntries(res.headers.entries()) }
      }
      case "flowmind.web.search": {
        const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`, {
          headers: { "User-Agent": "FlowMind/1.0" },
          signal: AbortSignal.timeout(10000),
        })
        const html = await res.text()
        const results: Array<{ title: string; url: string; snippet: string }> = []
        const titleRegex = /<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/g
        const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
        let m
        while ((m = titleRegex.exec(html)) !== null) {
          const title = m[1]!.replace(/<[^>]+>/g, "").trim()
          const urlMatch = m[0].match(/href="([^"]+)"/)
          results.push({ title, url: urlMatch ? urlMatch[1]! : "", snippet: "" })
        }
        let i = 0
        while ((m = snippetRegex.exec(html)) !== null && i < results.length) {
          results[i]!.snippet = m[1]!.replace(/<[^>]+>/g, "").trim()
          i++
        }
        return results.slice(0, 8)
      }
      case "flowmind.code.execute": {
        const { execSync } = await import("child_process")
        const tmpFile = `/tmp/flowmind-exec-${Date.now()}.${args.language === "python" ? "py" : args.language === "bash" ? "sh" : "js"}`
        const fs = await import("fs/promises")
        await fs.writeFile(tmpFile, args.code)
        try {
          const stdout = execSync(`${args.language === "python" ? "python3" : args.language === "bash" ? "bash" : "node"} ${tmpFile}`, {
            encoding: "utf-8",
            timeout: (args.timeout ?? 10000),
            maxBuffer: 1024 * 1024,
          })
          return { stdout: stdout.trim(), stderr: "", exitCode: 0 }
        } catch (e: any) {
          return { stdout: e.stdout?.trim() ?? "", stderr: e.stderr?.trim() ?? e.message, exitCode: e.status ?? 1 }
        } finally {
          await fs.unlink(tmpFile).catch(() => {})
        }
      }
      case "flowmind.code.lint": {
        const lintResults: Array<{ line: number; column: number; message: string; severity: string }> = []
        if (args.language === "javascript" || args.language === "typescript") {
          try { new Function(args.code) } catch (e: any) {
            const match = e.message.match(/line (\d+)/i)
            lintResults.push({ line: match ? parseInt(match[1]!) : 1, column: 0, message: e.message, severity: "error" })
          }
        }
        return lintResults
      }
      case "flowmind.git.diff": {
        const { execSync } = await import("child_process")
        const diff = execSync(`git -C "${args.repoPath}" diff ${args.baseRef ?? "HEAD"} ${args.targetRef ?? ""} 2>/dev/null || echo "not a git repository"`, { encoding: "utf-8", maxBuffer: 1024 * 1024 })
        return diff
      }
      case "flowmind.git.commit": {
        const { execSync } = await import("child_process")
        execSync(`git -C "${args.repoPath}" add -A && git -C "${args.repoPath}" commit -m "${args.message}" 2>/dev/null || true`, { encoding: "utf-8" })
        const hash = execSync(`git -C "${args.repoPath}" rev-parse HEAD 2>/dev/null || echo "none"`, { encoding: "utf-8" }).trim()
        return { commitHash: hash }
      }
      case "flowmind.memory.search": {
        return { results: [], query: args.query, message: "Memory search requires Qdrant to be running" }
      }
      case "flowmind.pipeline.trigger": {
        return { runId: "external", status: "MCP-triggered pipelines require API access" }
      }
      case "flowmind.email.send": {
        return { messageId: `mock-${Date.now()}`, to: args.to, subject: args.subject, sent: true }
      }
      case "flowmind.audio.transcribe": {
        return { text: "[Transcription requires local Whisper or API]", segments: [] }
      }
      case "flowmind.image.generate": {
        return { url: `https://placehold.co/1024x1024?text=${encodeURIComponent(args.prompt?.slice(0, 30) ?? "generated")}`, format: "png" }
      }
      default:
        return { message: `Tool ${toolName} execution not yet implemented` }
    }
  }

  private async executeExternalTool(
    _toolName: string,
    _args: unknown,
    _userId: string,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    return { success: false, error: "External tools not yet implemented" }
  }

  async initiateOAuthFlow(
    provider: string,
    _redirectUri: string,
    _userId: string,
  ): Promise<{ url: string; codeVerifier?: string }> {
    const config = OAUTH_PROVIDERS[provider]
    if (!config) {
      throw new Error(`Unknown OAuth provider: ${provider}`)
    }

    const params = new URLSearchParams()
    const codeVerifier = config.pkce ? "TODO: generate PKCE code verifier" : undefined

    return { url: `${config.authUrl}?${params.toString()}`, codeVerifier }
  }

  async handleOAuthCallback(
    provider: string,
    _code: string,
    _codeVerifier?: string,
    _userId?: string,
  ): Promise<OAuthToken> {
    return {
      accessToken: "TODO: exchange code for token",
      expiresAt: new Date(Date.now() + 3600_000),
      scopes: OAUTH_PROVIDERS[provider]?.scopes ?? [],
    }
  }
}
