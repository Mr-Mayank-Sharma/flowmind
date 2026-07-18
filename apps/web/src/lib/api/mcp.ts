import { tRPCQuery, tRPCMutation } from "./core"

export const mcpApi = {
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
}
