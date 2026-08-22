export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export function getToken(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|;\s*)flowmind_token=([^;]*)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

export function setToken(token: string) {
  document.cookie = `flowmind_token=${encodeURIComponent(token)};path=/;max-age=900;SameSite=Lax`
}

export function getRefreshToken(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|;\s*)flowmind_refresh=([^;]*)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

export function setRefreshToken(token: string) {
  document.cookie = `flowmind_refresh=${encodeURIComponent(token)};path=/;max-age=604800;SameSite=Lax`
}

export function setUserCookie(user: User) {
  const encoded = encodeURIComponent(JSON.stringify(user))
  document.cookie = `flowmind_user=${encoded};path=/;max-age=900;SameSite=Lax`
}

export function clearAuth() {
  document.cookie = "flowmind_token=;path=/;max-age=0"
  document.cookie = "flowmind_refresh=;path=/;max-age=0"
  document.cookie = "flowmind_user=;path=/;max-age=0"
  document.cookie = "flowmind_session=;path=/;max-age=0"
  localStorage.removeItem("flowmind_user")
}

export interface User {
  id: string
  email: string
  name: string | null
  role: string
  tier: string
}

export interface AuthResponse {
  user: User
  token: string
  refreshToken: string
}

export interface Framework {
  id: string
  name: string
  icon: string
  status: "running" | "stopped" | "error"
  port: number
  version: string
  pid: number | null
  models: number
  description: string
  category: string
}

export interface SystemMetrics {
  cpuPercent: number
  ramPercent: number
  ramUsedGb: string
  ramTotalGb: string
  gpuPercent: number | null
  gpuTemp: number | null
  vramUsedGb: string | null
  vramTotalGb: string
  diskPercent: number
  diskUsedGb: string
  diskTotalGb: string
  networkUpMbps: string
  networkDownMbps: string
  processes: number
  loadAvg: string
  uptime: string
  servicesRunning: number
  servicesTotal: number
}

export interface ActivityEntry {
  id: string
  type: "success" | "info" | "warning" | "error"
  message: string
  time: string
  timestamp: string
}

export interface GPUMetrics {
  id: string
  name: string
  utilization: number
  memoryUtil: number
  temperature: number
  vramTotal: string
  vramUsed: string
}

interface TrpcJsonError {
  message?: string
  code?: string
  data?: { code?: string; httpStatus?: number }
}

interface TrpcErrorEnvelope {
  error?: TrpcJsonError | string
}

function extractErrorMessage(json: TrpcErrorEnvelope): string {
  const err = json?.error
  if (!err) return "Request failed"
  if (typeof err === "string") return err
  const nested = (err as any)?.json as TrpcJsonError | undefined
  const target = nested ?? err
  if (target?.message) return target.message
  if (target?.data?.code) return target.data.code
  if (target?.code) return target.code
  return "Request failed"
}

export class ApiError extends Error {
  readonly code: string
  readonly httpStatus: number

  constructor(message: string, code = "UNKNOWN", httpStatus = 0) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.httpStatus = httpStatus
  }
}

async function parseResponse(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError(`Unexpected response from server (HTTP ${res.status})`, "PARSE_ERROR", res.status)
  }
}

interface CallOptions {
  retry?: boolean
  token?: string
}

async function trpcCall<T>(method: "GET" | "POST", procedure: string, body?: unknown, opts?: CallOptions, baseUrl?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const token = opts?.token ?? getToken()
  if (token) headers["Authorization"] = `Bearer ${token}`

  const apiUrl = baseUrl?.trim() ? baseUrl.trim().replace(/\/+$/, "") : API_URL
  const url = method === "GET" ? `${apiUrl}/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify(body ?? {}))}` : `${apiUrl}/trpc/${procedure}`

  let res: Response
  try {
    res = await fetch(url, { method, headers, body: method === "POST" ? JSON.stringify(body ?? {}) : undefined })
  } catch {
    throw new ApiError("Network error — cannot reach server", "NETWORK_ERROR", 0)
  }

  if (res.status === 401 && opts?.retry !== false) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      return trpcCall<T>(method, procedure, body, { retry: false }, baseUrl)
    }
    throw new ApiError("Session expired — please sign in again", "UNAUTHORIZED", 401)
  }

  const json = (await parseResponse(res)) as TrpcErrorEnvelope & { result?: { data?: T } }
  if (!res.ok || json.error) {
    const message = extractErrorMessage(json)
    const nested = typeof json.error === "object" ? ((json.error as any)?.json ?? json.error) : undefined
    const code = typeof nested === "object" ? nested.code ?? "ERROR" : "ERROR"
    throw new ApiError(message, code, res.status)
  }
  return json.result?.data as T
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    clearAuth()
    return false
  }
  try {
    const res = await fetch(`${API_URL}/trpc/auth.refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
    const json = (await parseResponse(res)) as TrpcErrorEnvelope & { result?: { data?: AuthResponse } }
    if (!res.ok || json.error || !json.result?.data) return false
    const data = json.result.data
    setToken(data.token)
    setRefreshToken(data.refreshToken)
    setUserCookie(data.user)
    localStorage.setItem("flowmind_user", JSON.stringify(data.user))
    return true
  } catch {
    return false
  }
}

export async function tRPCMutation<T>(procedure: string, input: unknown): Promise<T> {
  return trpcCall<T>("POST", procedure, input)
}

export async function tRPCQuery<T>(procedure: string, input?: unknown): Promise<T> {
  return trpcCall<T>("GET", procedure, input ?? {})
}

export async function tRPCQueryAs<T>(procedure: string, token: string, input?: unknown): Promise<T> {
  return trpcCall<T>("GET", procedure, input ?? {}, { token, retry: false })
}

export async function tRPCMutationAs<T>(procedure: string, token: string, input: unknown): Promise<T> {
  return trpcCall<T>("POST", procedure, input, { token, retry: false })
}

export async function tRPCQueryAsHost<T>(procedure: string, hostUrl: string, token: string, input?: unknown): Promise<T> {
  return trpcCall<T>("GET", procedure, input ?? {}, { token, retry: false }, hostUrl)
}

export async function tRPCMutationAsHost<T>(procedure: string, hostUrl: string, token: string, input: unknown): Promise<T> {
  return trpcCall<T>("POST", procedure, input, { token, retry: false }, hostUrl)
}
