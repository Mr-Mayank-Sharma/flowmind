import { tRPCQuery, tRPCMutation } from "./core"

export const knowledgeApi = {
  list: () => tRPCQuery<any[]>("knowledge.list"),
  getById: (id: string) => tRPCQuery<any>("knowledge.getById", { id }),
  create: (input: { name: string; description?: string; model?: string }) =>
    tRPCMutation<any>("knowledge.create", input),
  delete: (id: string) => tRPCMutation<{ success: boolean }>("knowledge.delete", { id }),
  uploadDocument: (input: { kbId: string; name: string; type: string; content?: string }) =>
    tRPCMutation<any>("knowledge.uploadDocument", input),
  deleteDocument: (id: string) =>
    tRPCMutation<{ success: boolean }>("knowledge.deleteDocument", { id }),
  search: (query: string) =>
    tRPCQuery<{ id: string; content: string; kb: string; score: number; doc: string }[]>("knowledge.search", { query }),
}
