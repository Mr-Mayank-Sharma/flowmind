import { tRPCQuery, tRPCMutation, type AuthResponse, type User } from "./core"

export const authApi = {
  login: (input: { email: string; password: string }) =>
    tRPCMutation<AuthResponse>("auth.login", input),
  register: (input: { email: string; password: string; name?: string }) =>
    tRPCMutation<AuthResponse>("auth.register", input),
  me: () => tRPCQuery<User>("auth.me"),
  refresh: () => tRPCMutation<{ token: string; refreshToken: string }>("auth.refresh", {}),
  ssoUrl: (provider: string) =>
    tRPCQuery<{ url: string }>("auth.ssoUrl", { provider }),
  ssoCallback: (input: { provider: string; code: string; state: string }) =>
    tRPCMutation<AuthResponse>("auth.ssoCallback", input),
  ssoProviders: () =>
    tRPCQuery<Array<{ id: string; name: string; icon: string }>>("auth.ssoProviders"),
}
