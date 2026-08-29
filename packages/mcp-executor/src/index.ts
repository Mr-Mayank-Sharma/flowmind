import { z } from "zod"
import crypto from "crypto"
import { prisma } from "@flowmind/db"

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

export function getClientId(provider: string): string | undefined {
  const map: Record<string, string | undefined> = {
    github: process.env.GITHUB_CLIENT_ID,
    slack: process.env.SLACK_CLIENT_ID,
    google: process.env.GOOGLE_CLIENT_ID,
    notion: process.env.NOTION_CLIENT_ID,
  }
  return map[provider]
}

export function getClientSecret(provider: string): string | undefined {
  const map: Record<string, string | undefined> = {
    github: process.env.GITHUB_CLIENT_SECRET,
    slack: process.env.SLACK_CLIENT_SECRET,
    google: process.env.GOOGLE_CLIENT_SECRET,
    notion: process.env.NOTION_CLIENT_SECRET,
  }
  return map[provider]
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
  implemented: boolean
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
  { name: "flowmind.files.read", category: "Filesystem", description: "Read files from user's workspace", inputSchema: toolInputSchemas["flowmind.files.read"]!, outputSchema: z.string(), implemented: true },
  { name: "flowmind.files.write", category: "Filesystem", description: "Write and create files", inputSchema: toolInputSchemas["flowmind.files.write"]!, outputSchema: z.object({ path: z.string(), size: z.number() }), implemented: true },
  { name: "flowmind.files.search", category: "Filesystem", description: "Full-text search across workspace", inputSchema: toolInputSchemas["flowmind.files.search"]!, outputSchema: z.array(z.object({ path: z.string(), snippet: z.string() })), implemented: true },
  { name: "flowmind.code.execute", category: "Code", description: "Run code in sandboxed Docker container", inputSchema: toolInputSchemas["flowmind.code.execute"]!, outputSchema: z.object({ stdout: z.string(), stderr: z.string(), exitCode: z.number() }), implemented: true },
  { name: "flowmind.code.lint", category: "Code", description: "Lint and format code with language-specific tools", inputSchema: toolInputSchemas["flowmind.code.lint"]!, outputSchema: z.array(z.object({ line: z.number(), column: z.number(), message: z.string(), severity: z.string() })), implemented: true },
  { name: "flowmind.git.diff", category: "Git", description: "Show git diff for a repository", inputSchema: toolInputSchemas["flowmind.git.diff"]!, outputSchema: z.string(), implemented: true },
  { name: "flowmind.git.commit", category: "Git", description: "Commit staged changes with a message", inputSchema: toolInputSchemas["flowmind.git.commit"]!, outputSchema: z.object({ commitHash: z.string() }), implemented: true },
  { name: "flowmind.git.pr", category: "Git", description: "Create a pull request on GitHub/GitLab", inputSchema: toolInputSchemas["flowmind.git.pr"]!, outputSchema: z.object({ url: z.string().url(), number: z.number() }), implemented: false },
  { name: "flowmind.web.fetch", category: "Web", description: "Fetch and parse web page content", inputSchema: toolInputSchemas["flowmind.web.fetch"]!, outputSchema: z.object({ status: z.number(), body: z.string(), headers: z.record(z.string()) }), implemented: true },
  { name: "flowmind.web.search", category: "Web", description: "Search the web (self-hosted Searxng)", inputSchema: toolInputSchemas["flowmind.web.search"]!, outputSchema: z.array(z.object({ title: z.string(), url: z.string(), snippet: z.string() })), implemented: true },
  { name: "flowmind.db.query", category: "Database", description: "Execute SQL query on connected databases", inputSchema: toolInputSchemas["flowmind.db.query"]!, outputSchema: z.array(z.record(z.unknown())), implemented: false },
  { name: "flowmind.email.send", category: "Communication", description: "Send email via SMTP or Mailgun", inputSchema: toolInputSchemas["flowmind.email.send"]!, outputSchema: z.object({ messageId: z.string() }), implemented: false },
  { name: "flowmind.slack.message", category: "Communication", description: "Post message to Slack channel", inputSchema: toolInputSchemas["flowmind.slack.message"]!, outputSchema: z.object({ ts: z.string(), channel: z.string() }), implemented: false },
  { name: "flowmind.github.issue", category: "Project", description: "Create or update GitHub issue", inputSchema: toolInputSchemas["flowmind.github.issue"]!, outputSchema: z.object({ id: z.number(), url: z.string(), number: z.number() }), implemented: false },
  { name: "flowmind.notion.page", category: "Project", description: "Create or update Notion page", inputSchema: toolInputSchemas["flowmind.notion.page"]!, outputSchema: z.object({ id: z.string(), url: z.string() }), implemented: false },
  { name: "flowmind.memory.search", category: "AI", description: "Search agent memories via vector + FTS", inputSchema: toolInputSchemas["flowmind.memory.search"]!, outputSchema: z.array(z.object({ id: z.string(), content: z.string(), score: z.number() })), implemented: false },
  { name: "flowmind.skill.run", category: "AI", description: "Execute a stored FlowMind skill", inputSchema: toolInputSchemas["flowmind.skill.run"]!, outputSchema: z.unknown(), implemented: false },
  { name: "flowmind.pipeline.trigger", category: "AI", description: "Trigger a workflow pipeline by ID", inputSchema: toolInputSchemas["flowmind.pipeline.trigger"]!, outputSchema: z.object({ runId: z.string(), status: z.string() }), implemented: false },
  { name: "flowmind.image.generate", category: "Media", description: "Generate image (local Stable Diffusion or API)", inputSchema: toolInputSchemas["flowmind.image.generate"]!, outputSchema: z.object({ url: z.string(), format: z.string() }), implemented: false },
  { name: "flowmind.audio.transcribe", category: "Media", description: "Transcribe audio file (local Whisper)", inputSchema: toolInputSchemas["flowmind.audio.transcribe"]!, outputSchema: z.object({ text: z.string(), segments: z.array(z.unknown()) }), implemented: false },
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

export type McpConnectionState = {
  connected: boolean
  checkedAt: number
  error?: string
}

export class McpConnectionPool {
  private connections: Map<string, McpConnectionState> = new Map()

  async connect(serverId: string, server: McpServer): Promise<McpConnectionState> {
    const checkedAt = Date.now()
    if (!server.baseUrl || server.transport !== "sse") {
      const state: McpConnectionState = {
        connected: false,
        checkedAt,
        error: "MCP SSE transport is not implemented for this server (no base URL configured)",
      }
      this.connections.set(serverId, state)
      throw new Error(`MCP transport not implemented for server '${serverId}': no SSE base URL configured`)
    }

    try {
      const res = await fetch(server.baseUrl, {
        method: "GET",
        headers: { Accept: "text/event-stream" },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) {
        const state: McpConnectionState = {
          connected: false,
          checkedAt,
          error: `Reachability probe failed with HTTP ${res.status}`,
        }
        this.connections.set(serverId, state)
        throw new Error(`MCP server '${serverId}' unreachable at ${server.baseUrl}: HTTP ${res.status}`)
      }
      const state: McpConnectionState = { connected: true, checkedAt }
      this.connections.set(serverId, state)
      return state
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.connections.set(serverId, { connected: false, checkedAt, error: message })
      throw new Error(`MCP server '${serverId}' unreachable at ${server.baseUrl}: ${message}`)
    }
  }

  async disconnect(serverId: string): Promise<void> {
    this.connections.delete(serverId)
  }

  isConnected(serverId: string): boolean {
    return this.connections.get(serverId)?.connected === true
  }

  getConnectionState(serverId: string): McpConnectionState | undefined {
    return this.connections.get(serverId)
  }

  listConnections(): string[] {
    return Array.from(this.connections.entries())
      .filter(([, state]) => state.connected)
      .map(([id]) => id)
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

// In-memory store for pending OAuth sessions (short-lived, lost on restart)
const pendingOAuthSessions = new Map<string, { provider: string; codeVerifier: string; userId: string; expiresAt: number }>()

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url")
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url")
}

function generateState(): string {
  return crypto.randomBytes(16).toString("hex")
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

    try {
      const result = await this.runBuiltInTool(toolName, validation.data!)
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async initiateOAuthFlow(
    provider: string,
    redirectUri: string,
    userId: string,
  ): Promise<{ url: string; state: string }> {
    const config = OAUTH_PROVIDERS[provider]
    if (!config) {
      throw new Error(`Unknown OAuth provider: ${provider}`)
    }

    const clientId = getClientId(provider)
    if (!clientId) {
      throw new Error(`No client ID configured for ${provider}`)
    }

    const state = generateState()
    const codeVerifier = config.pkce ? generateCodeVerifier() : ""
    const codeChallenge = codeVerifier ? generateCodeChallenge(codeVerifier) : ""

    const params: Record<string, string> = {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: config.scopes.join(" "),
      state,
    }

    if (config.pkce && codeChallenge) {
      params.code_challenge = codeChallenge
      params.code_challenge_method = "S256"
    }

    const authUrl = `${config.authUrl}?${new URLSearchParams(params).toString()}`

    pendingOAuthSessions.set(state, {
      provider,
      codeVerifier,
      userId,
      expiresAt: Date.now() + 600_000, // 10 min expiry
    })

    // Clean expired sessions periodically
    if (pendingOAuthSessions.size % 10 === 0) {
      for (const [key, session] of pendingOAuthSessions) {
        if (session.expiresAt < Date.now()) pendingOAuthSessions.delete(key)
      }
    }

    return { url: authUrl, state }
  }

  async handleOAuthCallback(
    code: string,
    state: string,
  ): Promise<OAuthToken> {
    const session = pendingOAuthSessions.get(state)
    if (!session) {
      throw new Error("OAuth session expired or invalid state parameter")
    }
    if (session.expiresAt < Date.now()) {
      pendingOAuthSessions.delete(state)
      throw new Error("OAuth session has expired")
    }

    const config = OAUTH_PROVIDERS[session.provider]
    if (!config) {
      throw new Error(`Unknown OAuth provider: ${session.provider}`)
    }

    const clientId = getClientId(session.provider) ?? ""
    const clientSecret = getClientSecret(session.provider) ?? ""

    const body: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: `${process.env.APP_URL ?? "http://localhost:3000"}/mcp/oauth/callback`,
    }

    if (config.pkce && session.codeVerifier) {
      body.code_verifier = session.codeVerifier
    } else {
      body.client_secret = clientSecret
    }

    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text()
      throw new Error(`Token exchange failed: ${tokenRes.status} ${errBody}`)
    }

    const tokenData = await tokenRes.json() as Record<string, unknown>
    const accessToken = (tokenData.access_token ?? tokenData.accessToken) as string
    const refreshToken = (tokenData.refresh_token ?? tokenData.refreshToken) as string | undefined
    const expiresIn = (tokenData.expires_in ?? tokenData.expiresIn ?? 3600) as number
    const scopes = ((tokenData.scope ?? tokenData.scopes) as string ?? config.scopes.join(" ")).split(" ").filter(Boolean)

    if (!accessToken) {
      throw new Error("No access token in response")
    }

    pendingOAuthSessions.delete(state)

    // Persist to DB
    await prisma.mcpToken.upsert({
      where: { id: `${session.userId}_${session.provider}` },
      update: {
        accessToken,
        refreshToken: refreshToken ?? null,
        scope: scopes.join(" "),
        expiresAt: new Date(Date.now() + (expiresIn as number) * 1000),
      },
      create: {
        id: `${session.userId}_${session.provider}`,
        userId: session.userId,
        provider: session.provider,
        accessToken,
        refreshToken: refreshToken ?? null,
        scope: scopes.join(" "),
        expiresAt: new Date(Date.now() + (expiresIn as number) * 1000),
      },
    })

    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + (expiresIn as number) * 1000),
      scopes: scopes as string[],
    }
  }

  async getStoredToken(userId: string, provider: string): Promise<OAuthToken | null> {
    const record = await prisma.mcpToken.findFirst({
      where: { userId, provider },
    })
    if (!record) return null
    return {
      accessToken: record.accessToken,
      refreshToken: record.refreshToken ?? undefined,
      expiresAt: record.expiresAt ?? new Date(0),
      scopes: record.scope.split(" ").filter(Boolean),
    }
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
        const { execFileSync } = await import("child_process")
        const root = args.rootPath ?? "."
        try {
          const result = execFileSync("grep", ["-rl", args.query, root, "--include=*.ts", "--include=*.tsx", "--include=*.js", "--include=*.py"], { encoding: "utf-8", maxBuffer: 1024 * 1024 })
          const files = result.split("\n").filter(Boolean)
          return { query: args.query, files, count: files.length }
        } catch {
          return { query: args.query, files: [], count: 0 }
        }
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
        const { execFileSync } = await import("child_process")
        const argsList = ["-C", args.repoPath, "diff", args.baseRef ?? "HEAD"]
        if (args.targetRef) argsList.push(args.targetRef)
        try {
          return execFileSync("git", argsList, { encoding: "utf-8", maxBuffer: 1024 * 1024 })
        } catch {
          return "not a git repository"
        }
      }
      case "flowmind.git.commit": {
        const { execFileSync } = await import("child_process")
        try {
          execFileSync("git", ["-C", args.repoPath, "add", "-A"], { encoding: "utf-8" })
          execFileSync("git", ["-C", args.repoPath, "commit", "-m", args.message], { encoding: "utf-8" })
        } catch {
          return { commitHash: "none" }
        }
        const hash = execFileSync("git", ["-C", args.repoPath, "rev-parse", "HEAD"], { encoding: "utf-8" }).trim()
        return { commitHash: hash }
      }
      case "flowmind.memory.search":
        throw new Error("flowmind.memory.search is not implemented")
      case "flowmind.pipeline.trigger":
        throw new Error("flowmind.pipeline.trigger is not implemented")
      case "flowmind.email.send":
        throw new Error("flowmind.email.send is not implemented")
      case "flowmind.audio.transcribe":
        throw new Error("flowmind.audio.transcribe is not implemented")
      case "flowmind.image.generate":
        throw new Error("flowmind.image.generate is not implemented")
      default:
        throw new Error(`Tool ${toolName} is not implemented`)
    }
  }

  private async executeExternalTool(
    toolName: string,
    _args: unknown,
    _userId: string,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    return { success: false, error: `Tool '${toolName}' is not implemented: no MCP server registered for it` }
  }
}
