import { tRPCQuery, tRPCMutation } from "./core"

export const modelsApi = {
  list: () => tRPCQuery<any[]>("models.list"),
  getProviders: () => tRPCQuery<any[]>("models.getProviders"),
  pullModel: (name: string) =>
    tRPCMutation<{ status: string }>("models.pullModel", { name }),
  searchModels: (query?: string) =>
    tRPCQuery<any[]>("models.searchModels", { query: query ?? "" }),
  getRuntimeHealth: () => tRPCQuery<{ online: boolean; status: string }>("models.getRuntimeHealth"),
}
