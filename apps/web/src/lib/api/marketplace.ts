import { tRPCQuery, tRPCMutation } from "./core"

export const marketplaceApi = {
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
}
