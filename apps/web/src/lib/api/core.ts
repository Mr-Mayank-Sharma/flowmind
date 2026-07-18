export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export function getToken(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|;\s*)flowmind_token=([^;]*)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

export function setToken(token: string) {
  document.cookie = `flowmind_token=${encodeURIComponent(token)};path=/;max-age=900;SameSite=Lax`
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

export async function tRPCMutation<T>(procedure: string, input: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const token = getToken()
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${API_URL}/trpc/${procedure}`, {
    method: "POST",
    headers,
    body: JSON.stringify(input ?? {}),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message || json.error.code || "Request failed")
  return json.result?.data as T
}

export async function tRPCQuery<T>(procedure: string, input?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers["Authorization"] = `Bearer ${token}`
  const query = input ? `?input=${encodeURIComponent(JSON.stringify(input))}` : "?input={}"
  const res = await fetch(`${API_URL}/trpc/${procedure}${query}`, { headers })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message || json.error.code || "Request failed")
  return json.result?.data as T
}
