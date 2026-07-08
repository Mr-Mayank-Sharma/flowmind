import { api } from "@/lib/api"

export const systemService = {
  getMetrics: () => api.system.getMetrics(),
  getFrameworks: () => api.system.getFrameworks(),
  getRecentActivity: (limit?: number) => api.system.getRecentActivity(limit),
  getGPUMetrics: () => api.system.getGPUMetrics(),
  startFramework: (id: string) => api.system.startFramework(id),
  stopFramework: (id: string) => api.system.stopFramework(id),
  listProcesses: () => api.system.listProcesses(),
  killProcess: (pid: number, signal?: string) => api.system.killProcess(pid, signal),
}

export const pipelineService = {
  list: () => api.pipeline.list(),
  getById: (id: string) => api.pipeline.getById(id),
  getRuns: (pipelineId: string) => api.pipeline.getRuns(pipelineId),
}

export const chatService = {
  sendMessage: (input: { sessionId: string; content: string; model?: string; tools?: string[] }) =>
    api.chat.sendMessage(input),
  createSession: (title?: string) => api.chat.createSession(title ? { title } : undefined),
  getSessions: (cursor?: string, limit?: number) => api.chat.getSessions({ cursor, limit }),
  getSession: (id: string) => api.chat.getSession(id),
  deleteSession: (id: string) => api.chat.deleteSession(id),
  searchSessions: (query: string, limit?: number) => api.chat.searchSessions({ query, limit }),
}

export const marketplaceService = {
  list: (params?: { category?: string; search?: string; sort?: string }) =>
    api.marketplace.list(params),
  getById: (id: string) => api.marketplace.getById(id),
  clone: (flowId: string) => api.marketplace.clone(flowId),
  search: (query: string) => api.marketplace.search(query),
}

export const settingsService = {
  updateProfile: (input: { name?: string; timezone?: string; language?: string }) =>
    api.settings.updateProfile(input),
  getApiKeys: () => api.settings.getApiKeys(),
  createApiKey: (input: { name: string; provider: string; key: string }) =>
    api.settings.createApiKey(input),
  deleteApiKey: (id: string) => api.settings.deleteApiKey(id),
  getNotifications: () => api.settings.getNotifications(),
  updateNotification: (id: string, read: boolean) =>
    api.settings.updateNotification({ id, read }),
  updateAppearance: (input: { theme?: string; fontSize?: string; chatDensity?: string }) =>
    api.settings.updateAppearance(input),
  getOrg: () => api.settings.getOrg(),
  updateOrg: (input: { name?: string; slug?: string }) =>
    api.settings.updateOrg(input),
  getOrgMembers: () => api.settings.getOrgMembers(),
  getConnections: () => api.settings.getConnections(),
  deleteConnection: (id: string) => api.settings.deleteConnection(id),
  getApiTokens: () => api.settings.getApiTokens(),
  createApiToken: (input: { name: string; scopes?: string[] }) =>
    api.settings.createApiToken(input),
  deleteApiToken: (id: string) => api.settings.deleteApiToken(id),
  getProfile: () => api.settings.getProfile(),
  getMemories: () => api.settings.getMemories(),
  deleteMemory: (id: string) => api.settings.deleteMemory(id),
  getAuditLog: () => api.settings.getAuditLog(),
  getSubscription: () => api.settings.getSubscription(),
}

export const filesService = {
  list: (dir?: string) => api.files.list(dir),
  read: (file: string) => api.files.read(file),
  delete: (file: string) => api.files.delete(file),
}

export const jobsService = {
  list: () => api.jobs.list(),
  getById: (id: string) => api.jobs.getById(id),
  create: (input: { name: string; expression: string; pipelineId: string }) =>
    api.jobs.create(input),
  update: (input: { id: string; name?: string; expression?: string; isActive?: boolean }) =>
    api.jobs.update(input),
  delete: (id: string) => api.jobs.delete(id),
  toggle: (id: string) => api.jobs.toggle(id),
}

export const toolsService = {
  list: () => api.tools.list(),
  toggle: (id: string) => api.tools.toggle(id),
}

export const mcpService = {
  list: () => api.mcp.list(),
  create: (input: { provider: string; accessToken: string; scope?: string }) =>
    api.mcp.create(input),
  delete: (id: string) => api.mcp.delete(id),
}

export const modelsService = {
  list: () => api.models.list(),
  getProviders: () => api.models.getProviders(),
  pullModel: (name: string) => api.models.pullModel(name),
  searchModels: (query?: string) => api.models.searchModels(query),
  getRuntimeHealth: () => api.models.getRuntimeHealth(),
}

export const knowledgeService = {
  list: () => api.knowledge.list(),
  getById: (id: string) => api.knowledge.getById(id),
  create: (input: { name: string; description?: string; model?: string }) =>
    api.knowledge.create(input),
  delete: (id: string) => api.knowledge.delete(id),
  uploadDocument: (input: { kbId: string; name: string; type: string; content?: string }) =>
    api.knowledge.uploadDocument(input),
  deleteDocument: (id: string) => api.knowledge.deleteDocument(id),
  search: (query: string) => api.knowledge.search(query),
}

export const agentsService = {
  list: () => api.agents.list(),
  getById: (id: string) => api.agents.getById(id),
  create: (input: { name: string; description?: string; model?: string; temperature?: number; maxTokens?: number }) =>
    api.agents.create(input),
  update: (input: { id: string; name?: string; description?: string; model?: string; temperature?: number; maxTokens?: number }) =>
    api.agents.update(input),
  delete: (id: string) => api.agents.delete(id),
  toggle: (id: string) => api.agents.toggle(id),
}
