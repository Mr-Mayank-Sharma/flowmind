import { tRPCQuery, tRPCMutation, getRefreshToken, type AuthResponse, type User } from "./core"

export const authApi = {
  login: (input: { email: string; password: string }) =>
    tRPCMutation<AuthResponse>("auth.login", input),
  register: (input: { email: string; password: string; name?: string }) =>
    tRPCMutation<AuthResponse>("auth.register", input),
  me: () => tRPCQuery<User>("auth.me"),
  refresh: () => tRPCMutation<{ token: string; refreshToken: string; user: User }>("auth.refresh", { refreshToken: getRefreshToken() }),
  ssoUrl: (provider: string) =>
    tRPCQuery<{ url: string }>("auth.ssoUrl", { provider }),
  ssoCallback: (input: { provider: string; code: string; state: string }) =>
    tRPCMutation<AuthResponse>("auth.ssoCallback", input),
  ssoProviders: () =>
    tRPCQuery<Array<{ id: string; name: string; icon: string }>>("auth.ssoProviders"),
  requestPasswordReset: (input: { email: string }) =>
    tRPCMutation<{ success: boolean; message: string }>("auth.requestPasswordReset", input),
  resetPassword: (input: { token: string; newPassword: string }) =>
    tRPCMutation<{ success: boolean }>("auth.resetPassword", input),
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    tRPCMutation<{ success: boolean }>("auth.changePassword", input),
  getMfaStatus: () =>
    tRPCQuery<{ enabled: boolean }>("auth.getMfaStatus"),
  setupMfa: () =>
    tRPCMutation<{ secret: string; qrCodeUrl: string }>("auth.setupMfa", {}),
  confirmMfa: (token: string) =>
    tRPCMutation<boolean>("auth.confirmMfa", { token }),
  disableMfa: () =>
    tRPCMutation<{ success: boolean }>("auth.disableMfa", {}),
}
