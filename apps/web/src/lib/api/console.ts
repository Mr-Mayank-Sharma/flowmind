import { tRPCQuery, tRPCMutation } from "./core"

export const consoleApi = {
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
}
