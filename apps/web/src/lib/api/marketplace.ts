import { tRPCQuery, tRPCMutation } from "./core"

export type MarketplaceItemType = "SKILL" | "PIPELINE" | "WORKFLOW" | "PROMPT_PACK" | "AGENT_TEMPLATE" | "MCP_INTEGRATION" | "PLUGIN"

export const marketplaceApi = {
  list: (input?: { type?: MarketplaceItemType; category?: string; search?: string; sort?: string; cursor?: string; limit?: number }) =>
    tRPCQuery<{ listings: any[]; nextCursor?: string }>("marketplace.list", input ?? {}),
  getById: (id: string) => tRPCQuery<any>("marketplace.getById", { id }),
  clone: (listingId: string) =>
    tRPCMutation<any>("marketplace.clone", { listingId }),
  search: (query: string, type?: MarketplaceItemType) =>
    tRPCQuery<any[]>("marketplace.search", type ? { query, type } : { query }),
  publish: (input: { type: MarketplaceItemType; title: string; description: string; category?: string; tags?: string[]; manifest?: any; payloadRef?: any }) =>
    tRPCMutation<any>("marketplace.publish", input),
  rate: (input: { listingId: string; stars: number; body?: string }) =>
    tRPCMutation<any>("marketplace.rate", input),
  getTypes: () =>
    tRPCQuery<MarketplaceItemType[]>("marketplace.getTypes"),
  getByOwner: (ownerId?: string) =>
    tRPCQuery<any[]>("marketplace.getByOwner", { ownerId }),
  createVersion: (input: { listingId: string; manifest?: any; payloadRef?: any; changelog?: string }) =>
    tRPCMutation<any>("marketplace.createVersion", input),
}
