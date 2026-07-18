const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export interface User {
  id: string
  email: string
  name: string | null
  role: string
  tier: string
}

export interface AuthResponse {
  user: User
  token: string
  refreshToken: string
}

export interface Framework {
  id: string
  name: string
  icon: string
  status: "running" | "stopped" | "error"
  port: number
  version: string
  pid: number | null
  models: number
  description: string
  category: string
}

export interface SystemMetrics {
  cpuPercent: number
  ramPercent: number
  ramUsedGb: string
  ramTotalGb: string
  gpuPercent: number | null
  gpuTemp: number | null
  vramUsedGb: string | null
  vramTotalGb: string
  diskPercent: number
  diskUsedGb: string
  diskTotalGb: string
  networkUpMbps: string
  networkDownMbps: string
  processes: number
  loadAvg: string
  uptime: string
  servicesRunning: number
  servicesTotal: number
}

export interface ActivityEntry {
  id: string
  type: "success" | "info" | "warning" | "error"
  message: string
  time: string
  timestamp: string
}

export interface GPUMetrics {
  id: string
  name: string
  utilization: number
  memoryUtil: number
  temperature: number
  vramTotal: string
  vramUsed: string
}

function getToken(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|;\s*)flowmind_token=([^;]*)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

export function setToken(token: string) {
  document.cookie = `flowmind_token=${encodeURIComponent(token)};path=/;max-age=900;SameSite=Lax`
}

export function setRefreshToken(token: string) {
  document.cookie = `flowmind_refresh=${encodeURIComponent(token)};path=/;max-age=604800;SameSite=Lax`
}

export function setUserCookie(user: User) {
  const encoded = encodeURIComponent(JSON.stringify(user))
  document.cookie = `flowmind_user=${encoded};path=/;max-age=900;SameSite=Lax`
}

export function clearAuth() {
  document.cookie = "flowmind_token=;path=/;max-age=0"
  document.cookie = "flowmind_refresh=;path=/;max-age=0"
  document.cookie = "flowmind_user=;path=/;max-age=0"
  document.cookie = "flowmind_session=;path=/;max-age=0"
  localStorage.removeItem("flowmind_user")
}

async function tRPCMutation<T>(procedure: string, input: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const token = getToken()
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${API_URL}/trpc/${procedure}`, {
    method: "POST",
    headers,
    body: JSON.stringify(input ?? {}),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message || json.error.code || "Request failed")
  return json.result?.data as T
}

async function tRPCQuery<T>(procedure: string, input?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers["Authorization"] = `Bearer ${token}`
  const query = input ? `?input=${encodeURIComponent(JSON.stringify(input))}` : "?input={}"
  const res = await fetch(`${API_URL}/trpc/${procedure}${query}`, { headers })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message || json.error.code || "Request failed")
  return json.result?.data as T
}

export const api = {
  auth: {
    login: (input: { email: string; password: string }) =>
      tRPCMutation<AuthResponse>("auth.login", input),
    register: (input: { email: string; password: string; name?: string }) =>
      tRPCMutation<AuthResponse>("auth.register", input),
    me: () => tRPCQuery<User>("auth.me"),
    refresh: () => tRPCMutation<{ token: string; refreshToken: string }>("auth.refresh", {}),
    ssoUrl: (provider: string) =>
      tRPCQuery<{ url: string }>("auth.ssoUrl", { provider }),
    ssoCallback: (input: { provider: string; code: string; state: string }) =>
      tRPCMutation<AuthResponse>("auth.ssoCallback", input),
    ssoProviders: () =>
      tRPCQuery<Array<{ id: string; name: string; icon: string }>>("auth.ssoProviders"),
  },
    pipeline: {
    list: () => tRPCQuery<{ pipelines: any[]; nextCursor?: string }>("pipeline.list"),
    create: (input: { name: string; description?: string; graph: { nodes: any[]; edges: any[] } }) =>
      tRPCMutation<any>("pipeline.create", input),
    update: (input: { id: string; name?: string; description?: string; graph?: any; isActive?: boolean }) =>
      tRPCMutation<any>("pipeline.update", input),
    delete: (id: string) => tRPCMutation<{ success: boolean }>("pipeline.delete", { id }),
    getById: (id: string) => tRPCQuery<any>("pipeline.getById", { id }),
    trigger: (id: string, input?: Record<string, unknown>) =>
      tRPCMutation<{ runId: string; status: "SUCCESS" | "FAILED" | "CANCELLED"; outputs: any[]; durationMs: number }>("pipeline.trigger", { id, input }),
    executeNode: (pipelineId: string, nodeId: string, input?: Record<string, unknown>) =>
      tRPCMutation<any>("pipeline.executeNode", { pipelineId, nodeId, input }),
    validate: (graph: { nodes: any[]; edges: any[] }) =>
      tRPCQuery<{ errors: string[] }>("pipeline.validate", { graph }),
    simulate: (graph: { nodes: any[]; edges: any[] }) =>
      tRPCQuery<any>("pipeline.simulate", { graph }),
    loadOptions: (nodeType: string, field: string, config?: Record<string, unknown>, filter?: string) =>
      tRPCQuery<Array<{ label: string; value: string; description?: string }>>("pipeline.loadOptions", { nodeType, field, config, filter }),
    getRuns: (pipelineId: string) =>
      tRPCQuery<any[]>("pipeline.getRuns", { pipelineId }),
    cancelRun: (runId: string) =>
      tRPCMutation<{ success: boolean }>("pipeline.cancelRun", { runId }),
    getRunLogs: (runId: string) =>
      tRPCQuery<any[]>("pipeline.getRunLogs", { runId }),
    listMarketplace: (category?: string) =>
      tRPCQuery<any[]>("pipeline.listMarketplace", { category }),
    getMarketplaceById: (id: string) =>
      tRPCQuery<any>("pipeline.getMarketplaceById", { id }),
    publishToMarketplace: (input: { pipelineId: string; title: string; description: string; category: string; tags?: string[]; price?: number }) =>
      tRPCMutation<any>("pipeline.publishToMarketplace", input),
    cloneFromMarketplace: (marketplaceId: string) =>
      tRPCMutation<any>("pipeline.cloneFromMarketplace", { marketplaceId }),
    marketplaceCategories: () =>
      tRPCQuery<any[]>("pipeline.marketplaceCategories"),
  },
  system: {
    getFrameworks: () => tRPCQuery<Framework[]>("system.getFrameworks"),
    getMetrics: () => tRPCQuery<SystemMetrics>("system.getMetrics"),
    getRecentActivity: (limit?: number) =>
      tRPCQuery<ActivityEntry[]>("system.getRecentActivity", { limit: limit ?? 8 }),
    getGPUMetrics: () => tRPCQuery<GPUMetrics[]>("system.getGPUMetrics"),
    startFramework: (id: string) =>
      tRPCMutation<{ success: boolean; message: string }>("system.startFramework", { id }),
    stopFramework: (id: string) =>
      tRPCMutation<{ success: boolean; message: string }>("system.stopFramework", { id }),
    listProcesses: () =>
      tRPCQuery<{ pid: number; name: string; status: string; cpu: string; ram: string; ramBytes: number; user: string; uptime: string; command: string; port: number | null }[]>("system.listProcesses"),
    killProcess: (pid: number, signal?: string) =>
      tRPCMutation<{ success: boolean; message: string }>("system.killProcess", { pid, signal: signal ?? "SIGTERM" }),
  },
  models: {
    list: () => tRPCQuery<any[]>("models.list"),
    getProviders: () => tRPCQuery<any[]>("models.getProviders"),
    pullModel: (name: string) =>
      tRPCMutation<{ status: string }>("models.pullModel", { name }),
    searchModels: (query?: string) =>
      tRPCQuery<any[]>("models.searchModels", { query: query ?? "" }),
    getRuntimeHealth: () => tRPCQuery<{ online: boolean; status: string }>("models.getRuntimeHealth"),
  },
  chat: {
    sendMessage: (input: { sessionId: string; content: string; files?: { url: string; type: string }[]; model?: string; tools?: string[] }) =>
      tRPCMutation<{ message: any; streamUrl: string }>("chat.sendMessage", input),
    createSession: (input?: { title?: string }) =>
      tRPCMutation<{ id: string; title: string }>("chat.createSession", input ?? {}),
    getSessions: (input?: { cursor?: string; limit?: number }) =>
      tRPCQuery<{ sessions: any[]; nextCursor?: string }>("chat.getSessions", input ?? {}),
    getSession: (id: string) =>
      tRPCQuery<{ id: string; title: string; messages: any[] }>("chat.getSession", { id }),
    deleteSession: (id: string) =>
      tRPCMutation<{ success: boolean }>("chat.deleteSession", { id }),
    searchSessions: (input: { query: string; limit?: number }) =>
      tRPCQuery<{ sessions: any[] }>("chat.searchSessions", input),
  },
  settings: {
    updateProfile: (input: { name?: string; timezone?: string; language?: string }) =>
      tRPCMutation<any>("settings.updateProfile", input),
    getApiKeys: () => tRPCQuery<any[]>("settings.getApiKeys"),
    createApiKey: (input: { name: string; provider: string; key: string }) =>
      tRPCMutation<any>("settings.createApiKey", input),
    deleteApiKey: (id: string) =>
      tRPCMutation<{ success: boolean }>("settings.deleteApiKey", { id }),
    getNotifications: () => tRPCQuery<any[]>("settings.getNotifications"),
    updateNotification: (input: { id: string; read: boolean }) =>
      tRPCMutation<any>("settings.updateNotification", input),
    updateAppearance: (input: { theme?: string; fontSize?: string; chatDensity?: string }) =>
      tRPCMutation<any>("settings.updateAppearance", input),
    getOrg: () => tRPCQuery<any>("settings.getOrg"),
    updateOrg: (input: { name?: string; slug?: string }) =>
      tRPCMutation<any>("settings.updateOrg", input),
    getOrgMembers: () => tRPCQuery<any[]>("settings.getOrgMembers"),
    getConnections: () => tRPCQuery<any[]>("settings.getConnections"),
    deleteConnection: (id: string) =>
      tRPCMutation<{ success: boolean }>("settings.deleteConnection", { id }),
    getApiTokens: () => tRPCQuery<any[]>("settings.getApiTokens"),
    createApiToken: (input: { name: string; scopes?: string[] }) =>
      tRPCMutation<{ token: string; lastFour: string }>("settings.createApiToken", input),
    deleteApiToken: (id: string) =>
      tRPCMutation<{ success: boolean }>("settings.deleteApiToken", { id }),
    getProfile: () => tRPCQuery<any>("settings.getProfile"),
    getMemories: () => tRPCQuery<any[]>("settings.getMemories"),
    deleteMemory: (id: string) =>
      tRPCMutation<{ success: boolean }>("settings.deleteMemory", { id }),
    getAuditLog: () => tRPCQuery<any[]>("settings.getAuditLog"),
    getSubscription: () => tRPCQuery<any>("settings.getSubscription"),
    getSessions: () => tRPCQuery<any[]>("settings.getSessions"),
  },
  files: {
    list: (dir?: string) => tRPCQuery<{ path: string; children: any[] }>("files.list", { dir: dir ?? "/" }),
    read: (file: string) => tRPCQuery<{ content: string; size: number; modifiedAt: string }>("files.read", { file }),
    delete: (file: string) => tRPCMutation<{ success: boolean }>("files.delete", { file }),
  },
  playground: {
    execute: (input: { method: string; url: string; headers?: Record<string, string>; body?: string }) =>
      tRPCMutation<any>("playground.execute", input),
  },
  mcp: {
    list: () => tRPCQuery<any[]>("mcp.list"),
    create: (input: { provider: string; accessToken: string; refreshToken?: string; scope?: string; expiresAt?: string }) =>
      tRPCMutation<any>("mcp.create", input),
    delete: (id: string) => tRPCMutation<{ success: boolean }>("mcp.delete", { id }),
    toggle: (id: string) => tRPCMutation<any>("mcp.toggle", { id }),
    providers: () => tRPCQuery<Array<{ id: string; name: string; icon: string }>>("mcp.providers"),
    oauthInitiate: (input: { provider: string }) =>
      tRPCMutation<{ url: string; state: string }>("mcp.oauthInitiate", input),
    oauthCallback: (input: { provider: string; code: string; state: string }) =>
      tRPCMutation<any>("mcp.oauthCallback", input),
    execute: (input: { id: string; method: string; params?: Record<string, unknown> }) =>
      tRPCMutation<any>("mcp.execute", input),
  },
  tools: {
    list: () => tRPCQuery<any[]>("tools.list"),
    execute: (input: { id: string; args: Record<string, unknown> }) =>
      tRPCMutation<any>("tools.execute", input),
    toggle: (id: string) => tRPCMutation<any>("tools.toggle", { id }),
  },
  jobs: {
    list: () => tRPCQuery<any[]>("jobs.list"),
    getById: (id: string) => tRPCQuery<any>("jobs.getById", { id }),
    create: (input: { name: string; expression: string; pipelineId: string; channel?: string }) =>
      tRPCMutation<any>("jobs.create", input),
    update: (input: { id: string; name?: string; expression?: string; isActive?: boolean; channel?: string }) =>
      tRPCMutation<any>("jobs.update", input),
    delete: (id: string) =>
      tRPCMutation<{ success: boolean }>("jobs.delete", { id }),
    toggle: (id: string) =>
      tRPCMutation<any>("jobs.toggle", { id }),
  },
  marketplace: {
    list: (input?: { category?: string; search?: string; sort?: string; cursor?: string; limit?: number }) =>
      tRPCQuery<{ flows: any[] }>("marketplace.list", input ?? {}),
    getById: (id: string) => tRPCQuery<any>("marketplace.getById", { id }),
    clone: (flowId: string) =>
      tRPCMutation<any>("marketplace.clone", { flowId }),
    search: (query: string) =>
      tRPCQuery<any[]>("marketplace.search", { query }),
    publish: (input: { flowId: string; title: string; description: string; category: string; tags?: string[] }) =>
      tRPCMutation<any>("marketplace.publish", input),
    rate: (input: { flowId: string; rating: number; review?: string }) =>
      tRPCMutation<any>("marketplace.rate", input),
  },
  knowledge: {
    list: () => tRPCQuery<any[]>("knowledge.list"),
    getById: (id: string) => tRPCQuery<any>("knowledge.getById", { id }),
    create: (input: { name: string; description?: string; model?: string }) =>
      tRPCMutation<any>("knowledge.create", input),
    delete: (id: string) => tRPCMutation<{ success: boolean }>("knowledge.delete", { id }),
    uploadDocument: (input: { kbId: string; name: string; type: string; content?: string }) =>
      tRPCMutation<any>("knowledge.uploadDocument", input),
    deleteDocument: (id: string) =>
      tRPCMutation<{ success: boolean }>("knowledge.deleteDocument", { id }),
    search: (query: string) =>
      tRPCQuery<{ id: string; content: string; kb: string; score: number; doc: string }[]>("knowledge.search", { query }),
  },
  agents: {
    list: () => tRPCQuery<any[]>("agents.list"),
    getById: (id: string) => tRPCQuery<any>("agents.getById", { id }),
    create: (input: { name: string; description?: string; model?: string; temperature?: number; maxTokens?: number }) =>
      tRPCMutation<any>("agents.create", input),
    update: (input: { id: string; name?: string; description?: string; model?: string; temperature?: number; maxTokens?: number }) =>
      tRPCMutation<any>("agents.update", input),
    delete: (id: string) => tRPCMutation<{ success: boolean }>("agents.delete", { id }),
    toggle: (id: string) => tRPCMutation<any>("agents.toggle", { id }),
  },
  toolsV2: {
    listTools: () => tRPCQuery<any[]>("toolsV2.listTools"),
    getTool: (id: string) => tRPCQuery<any>("toolsV2.getTool", { id }),
    executeTool: (input: { toolId: string; args: Record<string, unknown>; sessionId?: string }) =>
      tRPCMutation<any>("toolsV2.executeTool", input),
    getPermissionRules: () => tRPCQuery<any>("toolsV2.getPermissionRules"),
    updatePermissionRules: (rules: any[]) =>
      tRPCMutation<any>("toolsV2.updatePermissionRules", { rules }),
    evaluatePermission: (permission: string, pattern: string) =>
      tRPCQuery<any>("toolsV2.evaluatePermission", { permission, pattern }),
    lspOpenFile: (filePath: string) =>
      tRPCMutation<any>("toolsV2.lspOpenFile", { filePath }),
    lspGoToDefinition: (filePath: string, line: number, column: number) =>
      tRPCQuery<any>("toolsV2.lspGoToDefinition", { filePath, line, column }),
    lspFindReferences: (filePath: string, line: number, column: number) =>
      tRPCQuery<any>("toolsV2.lspFindReferences", { filePath, line, column }),
    lspGetHover: (filePath: string, line: number, column: number) =>
      tRPCQuery<any>("toolsV2.lspGetHover", { filePath, line, column }),
    snapshotCreate: (filePath: string, description?: string) =>
      tRPCMutation<any>("toolsV2.snapshotCreate", { filePath, description }),
    snapshotRevert: () => tRPCMutation<any>("toolsV2.snapshotRevert", {}),
    snapshotRestore: (id: string) =>
      tRPCMutation<any>("toolsV2.snapshotRestore", { id }),
    snapshotDiff: (filePath: string) =>
      tRPCQuery<any>("toolsV2.snapshotDiff", { filePath }),
    snapshotHistory: (filePath?: string) =>
      tRPCQuery<any>("toolsV2.snapshotHistory", { filePath }),
    sessionCompact: (sessionId: string) =>
      tRPCMutation<any>("toolsV2.sessionCompact", { sessionId }),
    sessionGetMessages: (sessionId: string) =>
      tRPCQuery<any>("toolsV2.sessionGetMessages", { sessionId }),
    sessionEstimateTokens: (sessionId: string) =>
      tRPCQuery<any>("toolsV2.sessionEstimateTokens", { sessionId }),
    sessionClear: (sessionId: string) =>
      tRPCMutation<any>("toolsV2.sessionClear", { sessionId }),
    listProviders: () => tRPCQuery<any[]>("toolsV2.listProviders"),
    listModels: (providerId?: string) =>
      tRPCQuery<any[]>("toolsV2.listModels", { providerId }),
    searchModels: (query: string) =>
      tRPCQuery<any[]>("toolsV2.searchModels", { query }),
    getModel: (id: string) =>
      tRPCQuery<any>("toolsV2.getModel", { id }),
    setProviderKey: (providerId: string, apiKey: string) =>
      tRPCMutation<any>("toolsV2.setProviderKey", { providerId, apiKey }),
    listPlugins: () => tRPCQuery<any[]>("toolsV2.listPlugins"),
    loadPluginDir: (dir: string) =>
      tRPCMutation<any>("toolsV2.loadPluginDir", { dir }),
    updateTodos: (todos: any[]) =>
      tRPCMutation<any>("toolsV2.updateTodos", { todos }),
  },
  context: {
    getSessions: () => tRPCQuery<any[]>("context.getSessions"),
    getSkills: () => tRPCQuery<any[]>("context.getSkills"),
    getMemories: () => tRPCQuery<any[]>("context.getMemories"),
    deleteMemory: (id: string) => tRPCMutation<{ success: boolean }>("context.deleteMemory", { id }),
    deleteSession: (id: string) => tRPCMutation<{ success: boolean }>("context.deleteSession", { id }),
    enableSkill: (id: string, enabled: boolean) => tRPCMutation<{ success: boolean }>("context.enableSkill", { id, enabled }),
  },
  skills: {
    list: (input?: { tag?: string; search?: string }) =>
      tRPCQuery<Array<{ id: string; name: string; description: string; author: string; version: string; tags: string[]; downloads: number; ratingAvg: number; ratingCount: number; createdAt: string }>>("skills.list", input),
    search: (query: string) =>
      tRPCQuery<Array<{ id: string; name: string; description: string; author: string; version: string }>>("skills.search", { query }),
    getById: (name: string) => tRPCQuery<any>("skills.getById", { name }),
    install: (skillId: string) => tRPCMutation<any>("skills.install", { skillId }),
    publish: (input: { manifest: { name: string; description: string; author: string; version: string; tags?: string[]; entryPoint?: string }; code: string }) =>
      tRPCMutation<any>("skills.publish", input),
    run: (input: { skillId: string; args?: Record<string, unknown> }) =>
      tRPCMutation<any>("skills.run", input),
    delete: (id: string) => tRPCMutation<{ success: boolean }>("skills.delete", { id }),
    versions: (skillName: string) =>
      tRPCQuery<any[]>("skills.versions", { name: skillName }),
  },
  runtime: {
    list: () => tRPCQuery<Array<{ id: string; name: string; endpoint: string; description: string; version: string; status: string; capabilities: any[]; registeredAt: string; lastHealthCheck: string | null; currentLoad: number }>>("runtime.list"),
    register: (input: { name: string; endpoint: string; description?: string; version?: string; capabilities?: any[] }) =>
      tRPCMutation<{ id: string; name: string; status: string }>("runtime.register", input),
    unregister: (id: string) => tRPCMutation<{ success: boolean }>("runtime.unregister", { id }),
    dispatch: (input: { nodeType: string; inputType?: string }) =>
      tRPCQuery<{ runtimeId: string; endpoint: string; authHeader: string | null } | { error: string }>("runtime.dispatch", input),
    healthCheck: (id: string) =>
      tRPCQuery<{ online: boolean; latency: number; status: string }>("runtime.healthCheck", { id }),
  },
  notifications: {
    sendEmail: (input: { to: string; subject: string; body: string }) =>
      tRPCMutation<{ success: boolean }>("notifications.sendEmail", input),
    list: () => tRPCQuery<any[]>("notifications.list"),
    markRead: (id: string) => tRPCMutation<{ success: boolean }>("notifications.markRead", { id }),
    markAllRead: () => tRPCMutation<{ success: boolean }>("notifications.markAllRead", {}),
  },
  billing: {
    getSubscription: () => tRPCQuery<any>("billing.getSubscription"),
    createCheckout: (input: { tier: string; orgId?: string }) =>
      tRPCMutation<{ url: string }>("billing.createCheckout", input),
    createPortalSession: () => tRPCMutation<{ url: string }>("billing.createPortalSession", {}),
    getUsage: () => tRPCQuery<any>("billing.getUsage"),
    getInvoices: () => tRPCQuery<any[]>("billing.getInvoices"),
  },
  webhooks: {
    whatsapp: (input: Record<string, unknown>) =>
      tRPCMutation<any>("webhooks.whatsapp", input),
    ingest: (input: Record<string, unknown>) =>
      tRPCMutation<any>("webhooks.ingest", input),
    telegram: (input: Record<string, unknown>) =>
      tRPCMutation<any>("webhooks.telegram", input),
    slack: (input: Record<string, unknown>) =>
      tRPCMutation<any>("webhooks.slack", input),
    discord: (input: Record<string, unknown>) =>
      tRPCMutation<any>("webhooks.discord", input),
  },
  console: {
    listWorkspaces: () => tRPCQuery<any[]>("console.listWorkspaces"),
    getWorkspace: (id: string) => tRPCQuery<any>("console.getWorkspace", { id }),
    createWorkspace: (input: { name: string; slug: string; tier?: string }) =>
      tRPCMutation<any>("console.createWorkspace", input),
    updateWorkspace: (input: { id: string; name?: string; slug?: string }) =>
      tRPCMutation<any>("console.updateWorkspace", input),
    deleteWorkspace: (id: string) => tRPCMutation<{ success: boolean }>("console.deleteWorkspace", { id }),
    listMembers: (orgId: string) => tRPCQuery<any[]>("console.listMembers", { orgId }),
    inviteMember: (input: { orgId: string; email: string; role: string }) =>
      tRPCMutation<any>("console.inviteMember", input),
    removeMember: (input: { orgId: string; userId: string }) =>
      tRPCMutation<{ success: boolean }>("console.removeMember", input),
    listApiKeys: () => tRPCQuery<any[]>("console.listApiKeys"),
    createApiKey: (input: { name: string; provider?: string }) =>
      tRPCMutation<any>("console.createApiKey", input),
    deleteApiKey: (id: string) => tRPCMutation<{ success: boolean }>("console.deleteApiKey", { id }),
    getSubscription: () => tRPCQuery<any>("console.getSubscription"),
    createCheckoutSession: (input: { tier: string; orgId?: string }) =>
      tRPCMutation<{ url: string }>("console.createCheckoutSession", input),
    getUsageMetrics: () => tRPCQuery<any>("console.getUsageMetrics"),
    getUsage: () => tRPCQuery<any>("console.getUsage"),
    manageTeamSeats: (input: { orgId: string; quantity: number }) =>
      tRPCMutation<{ success: boolean }>("console.manageTeamSeats", input),
  },
}
