import { tRPCQuery, tRPCMutation } from "./core"

export const chatApi = {
  sendMessage: (input: { sessionId: string; content: string; files?: { url: string; type: string }[]; model?: string; tools?: string[] }) =>
    tRPCMutation<{ message: any; streamUrl: string }>("chat.sendMessage", input),
  createSession: (input?: { title?: string }) =>
    tRPCMutation<{ id: string; title: string }>("chat.createSession", input ?? {}),
  getSessions: (input?: { cursor?: string; limit?: number }) =>
    tRPCQuery<{ sessions: any[]; nextCursor?: string }>("chat.getSessions", input ?? {}),
  getSession: (id: string) =>
    tRPCQuery<{ id: string; title: string; messages: any[] }>("chat.getSession", { id }),
  deleteSession: (id: string) =>
    tRPCMutation<{ success: boolean }>("chat.deleteSession", { id }),
  searchSessions: (input: { query: string; limit?: number }) =>
    tRPCQuery<{ sessions: any[] }>("chat.searchSessions", input),
}
