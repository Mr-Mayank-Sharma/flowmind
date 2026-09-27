import { tRPCQuery, tRPCMutation } from "./core"

export const agentsApi = {
  list: () => tRPCQuery<any[]>("agents.list"),
  getById: (id: string) => tRPCQuery<any>("agents.getById", { id }),
  create: (input: { name: string; description?: string; model?: string; temperature?: number; maxTokens?: number }) =>
    tRPCMutation<any>("agents.create", input),
  update: (input: { id: string; name?: string; description?: string; model?: string; temperature?: number; maxTokens?: number }) =>
    tRPCMutation<any>("agents.update", input),
  delete: (id: string) => tRPCMutation<{ success: boolean }>("agents.delete", { id }),
  toggle: (id: string) => tRPCMutation<any>("agents.toggle", { id }),
  health: () =>
    tRPCQuery<{
      runtime: { reachable: boolean; checkedAt: string; error?: string }
      total: number
      counts: Record<string, number>
    }>("agents.health"),
}
