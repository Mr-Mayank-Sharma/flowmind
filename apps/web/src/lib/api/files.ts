import { tRPCQuery, tRPCMutation } from "./core"

export const filesApi = {
  list: (dir?: string) => tRPCQuery<{ path: string; children: any[] }>("files.list", { dir: dir ?? "/" }),
  read: (file: string) => tRPCQuery<{ content: string; size: number; modifiedAt: string }>("files.read", { file }),
  delete: (file: string) => tRPCMutation<{ success: boolean }>("files.delete", { file }),
}
