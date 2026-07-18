import { tRPCQuery, tRPCMutation } from "./core"

export const jobsApi = {
  list: () => tRPCQuery<any[]>("jobs.list"),
  getById: (id: string) => tRPCQuery<any>("jobs.getById", { id }),
  create: (input: { name: string; expression: string; pipelineId: string; channel?: string }) =>
    tRPCMutation<any>("jobs.create", input),
  update: (input: { id: string; name?: string; expression?: string; isActive?: boolean; channel?: string }) =>
    tRPCMutation<any>("jobs.update", input),
  delete: (id: string) =>
    tRPCMutation<{ success: boolean }>("jobs.delete", { id }),
  toggle: (id: string) =>
    tRPCMutation<any>("jobs.toggle", { id }),
}
