import { tRPCMutation } from "./core"

export const playgroundApi = {
  execute: (input: { method: string; url: string; headers?: Record<string, string>; body?: string }) =>
    tRPCMutation<any>("playground.execute", input),
}
