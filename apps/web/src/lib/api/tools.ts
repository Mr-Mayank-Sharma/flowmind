import { tRPCQuery, tRPCMutation } from "./core"

export const toolsApi = {
  list: () => tRPCQuery<any[]>("tools.list"),
  execute: (input: { id: string; args: Record<string, unknown> }) =>
    tRPCMutation<any>("tools.execute", input),
  toggle: (id: string) => tRPCMutation<any>("tools.toggle", { id }),
}

export const toolsV2Api = {
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
}
