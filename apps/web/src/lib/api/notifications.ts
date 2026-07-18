import { tRPCQuery, tRPCMutation } from "./core"

export const notificationsApi = {
  sendEmail: (input: { to: string; subject: string; body: string }) =>
    tRPCMutation<{ success: boolean }>("notifications.sendEmail", input),
  list: () => tRPCQuery<any[]>("notifications.list"),
  markRead: (id: string) => tRPCMutation<{ success: boolean }>("notifications.markRead", { id }),
  markAllRead: () => tRPCMutation<{ success: boolean }>("notifications.markAllRead", {}),
}
