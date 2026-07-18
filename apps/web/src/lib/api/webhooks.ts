import { tRPCQuery, tRPCMutation } from "./core"

export const webhooksApi = {
  whatsapp: (input: Record<string, unknown>) =>
    tRPCMutation<any>("webhooks.whatsapp", input),
  ingest: (input: Record<string, unknown>) =>
    tRPCMutation<any>("webhooks.ingest", input),
  telegram: (input: Record<string, unknown>) =>
    tRPCMutation<any>("webhooks.telegram", input),
  slack: (input: Record<string, unknown>) =>
    tRPCMutation<any>("webhooks.slack", input),
  discord: (input: Record<string, unknown>) =>
    tRPCMutation<any>("webhooks.discord", input),
}
