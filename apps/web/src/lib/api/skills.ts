import { tRPCQuery, tRPCMutation } from "./core"

export const skillsApi = {
  list: (input?: { tag?: string; search?: string }) =>
    tRPCQuery<Array<{ id: string; name: string; description: string; author: string; version: string; tags: string[]; downloads: number; ratingAvg: number; ratingCount: number; createdAt: string }>>("skills.list", input),
  search: (query: string) =>
    tRPCQuery<Array<{ id: string; name: string; description: string; author: string; version: string }>>("skills.search", { query }),
  getById: (name: string) => tRPCQuery<any>("skills.getById", { name }),
  install: (skillId: string) => tRPCMutation<any>("skills.install", { skillId }),
  publish: (input: { manifest: { name: string; description: string; author: string; version: string; tags?: string[]; entryPoint?: string }; code: string }) =>
    tRPCMutation<any>("skills.publish", input),
  run: (input: { skillId: string; args?: Record<string, unknown> }) =>
    tRPCMutation<any>("skills.run", input),
  delete: (id: string) => tRPCMutation<{ success: boolean }>("skills.delete", { id }),
  versions: (skillName: string) =>
    tRPCQuery<any[]>("skills.versions", { name: skillName }),
}
