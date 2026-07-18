import { tRPCQuery, tRPCMutation } from "./core"

export const contextApi = {
  getSessions: () => tRPCQuery<any[]>("context.getSessions"),
  getSkills: () => tRPCQuery<any[]>("context.getSkills"),
  getMemories: () => tRPCQuery<any[]>("context.getMemories"),
  deleteMemory: (id: string) => tRPCMutation<{ success: boolean }>("context.deleteMemory", { id }),
  deleteSession: (id: string) => tRPCMutation<{ success: boolean }>("context.deleteSession", { id }),
  enableSkill: (id: string, enabled: boolean) => tRPCMutation<{ success: boolean }>("context.enableSkill", { id, enabled }),
}
