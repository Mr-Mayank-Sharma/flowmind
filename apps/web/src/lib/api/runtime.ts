import { tRPCQuery, tRPCMutation } from "./core"

export const runtimeApi = {
  list: () => tRPCQuery<Array<{ id: string; name: string; endpoint: string; description: string; version: string; status: string; capabilities: any[]; registeredAt: string; lastHealthCheck: string | null; currentLoad: number }>>("runtime.list"),
  register: (input: { name: string; endpoint: string; description?: string; version?: string; capabilities?: any[] }) =>
    tRPCMutation<{ id: string; name: string; status: string }>("runtime.register", input),
  unregister: (id: string) => tRPCMutation<{ success: boolean }>("runtime.unregister", { id }),
  dispatch: (input: { nodeType: string; inputType?: string }) =>
    tRPCQuery<{ runtimeId: string; endpoint: string; authHeader: string | null } | { error: string }>("runtime.dispatch", input),
  healthCheck: (id: string) =>
    tRPCQuery<{ online: boolean; latency: number; status: string }>("runtime.healthCheck", { id }),
}
