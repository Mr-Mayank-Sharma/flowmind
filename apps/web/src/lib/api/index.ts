export { API_URL, getToken, setToken, setRefreshToken, setUserCookie, clearAuth } from "./core"
export type { User, AuthResponse, Framework, SystemMetrics, ActivityEntry, GPUMetrics } from "./core"

import { authApi } from "./auth"
import { pipelineApi } from "./pipeline"
import { systemApi } from "./system"
import { chatApi } from "./chat"
import { settingsApi } from "./settings"
import { modelsApi } from "./models"
import { filesApi } from "./files"
import { marketplaceApi } from "./marketplace"
import { knowledgeApi } from "./knowledge"
import { agentsApi } from "./agents"
import { mcpApi } from "./mcp"
import { toolsApi, toolsV2Api } from "./tools"
import { jobsApi } from "./jobs"
import { skillsApi } from "./skills"
import { runtimeApi } from "./runtime"
import { notificationsApi } from "./notifications"
import { billingApi } from "./billing"
import { webhooksApi } from "./webhooks"
import { consoleApi } from "./console"
import { contextApi } from "./context"
import { playgroundApi } from "./playground"

export const api = {
  auth: authApi,
  pipeline: pipelineApi,
  system: systemApi,
  chat: chatApi,
  settings: settingsApi,
  models: modelsApi,
  files: filesApi,
  marketplace: marketplaceApi,
  knowledge: knowledgeApi,
  agents: agentsApi,
  mcp: mcpApi,
  tools: toolsApi,
  toolsV2: toolsV2Api,
  jobs: jobsApi,
  skills: skillsApi,
  runtime: runtimeApi,
  notifications: notificationsApi,
  billing: billingApi,
  webhooks: webhooksApi,
  console: consoleApi,
  context: contextApi,
  playground: playgroundApi,
}
