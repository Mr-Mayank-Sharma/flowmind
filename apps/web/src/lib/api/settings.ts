import { tRPCQuery, tRPCMutation } from "./core"

export const settingsApi = {
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
}
