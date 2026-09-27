import { tRPCQuery, tRPCMutation } from "./core"

export type MarketplaceItemType = "SKILL" | "PIPELINE" | "WORKFLOW" | "PROMPT_PACK" | "AGENT_TEMPLATE" | "MCP_INTEGRATION" | "PLUGIN"

export type MarketplacePayloadState = "INLINE" | "REFERENCE" | "NONE"
export type CatalogSource = "listing" | "skill" | "flow"
export type CatalogEntry = {
  source: CatalogSource
  id: string
  type: MarketplaceItemType
  title: string
  description: string
  category: string | null
  tags: string[]
  downloads: number
  ratingAvg: number
  ratingCount: number
  version: string
  publishedAt: string
  ownerName: string | null
  isVerified: boolean
  payload: { state: MarketplacePayloadState; executable: boolean; reason?: string }
}

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
  // The unified browse surface: listings, skills and flows normalized into one
  // shape, each carrying an honest statement of whether it can be executed.
  catalog: (input?: { type?: MarketplaceItemType; category?: string; search?: string; sort?: string; limit?: number }) =>
    tRPCQuery<{ entries: CatalogEntry[] }>("marketplace.catalog", input ?? {}),
  catalogEntry: (source: CatalogSource, id: string) =>
    tRPCQuery<{ entry: CatalogEntry; payload: any }>("marketplace.catalogEntry", { source, id }),
}
