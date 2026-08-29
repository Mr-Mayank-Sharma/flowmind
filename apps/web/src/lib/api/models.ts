import { tRPCQuery, tRPCMutation } from "./core"

export interface OllamaModel {
  name: string
  size: number
  modified: string
  digest: string
  parameterSize: string
  quantization: string
  family: string
}

export interface RegistryModel {
  id: string
  name: string
  providerId: string
  context: number
  maxOutput: number
}

export const modelsApi = {
  list: () => tRPCQuery<OllamaModel[]>("models.list"),
  getProviders: () => tRPCQuery<{ id: string; name: string; available: boolean; modelCount: number }[]>("models.getProviders"),
  listModels: (providerId?: string) =>
    tRPCQuery<RegistryModel[]>("toolsV2.listModels", providerId ? { providerId } : undefined),
  pullModel: (name: string) =>
    tRPCMutation<{ status: string; name: string; progress: number }>("models.pullModel", { name }),
  deleteModel: (name: string) =>
    tRPCMutation<{ success: boolean }>("models.deleteModel", { name }),
  searchModels: (query?: string) =>
    tRPCQuery<{ name: string; size: number }[]>("models.searchModels", { query: query ?? "" }),
  getRuntimeHealth: () => tRPCQuery<{ online: boolean; status: string }>("models.getRuntimeHealth"),
  setProviderKey: (providerId: string, apiKey: string) =>
    tRPCMutation<{ success: boolean }>("toolsV2.setProviderKey", { providerId, apiKey }),
  getProviderKeys: () => tRPCQuery<{ providerId: string; hasKey: boolean }[]>("toolsV2.getProviderKeys"),
}
