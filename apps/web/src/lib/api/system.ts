import { tRPCQuery, tRPCMutation, type Framework, type SystemMetrics, type ActivityEntry, type GPUMetrics } from "./core"

export const systemApi = {
  getFrameworks: () => tRPCQuery<Framework[]>("system.getFrameworks"),
  getMetrics: () => tRPCQuery<SystemMetrics>("system.getMetrics"),
  getRecentActivity: (limit?: number) =>
    tRPCQuery<ActivityEntry[]>("system.getRecentActivity", { limit: limit ?? 8 }),
  getGPUMetrics: () => tRPCQuery<GPUMetrics[]>("system.getGPUMetrics"),
  startFramework: (id: string) =>
    tRPCMutation<{ success: boolean; message: string }>("system.startFramework", { id }),
  stopFramework: (id: string) =>
    tRPCMutation<{ success: boolean; message: string }>("system.stopFramework", { id }),
  listProcesses: () =>
    tRPCQuery<{ pid: number; name: string; status: string; cpu: string; ram: string; ramBytes: number; user: string; uptime: string; command: string; port: number | null }[]>("system.listProcesses"),
  killProcess: (pid: number, signal?: string) =>
    tRPCMutation<{ success: boolean; message: string }>("system.killProcess", { pid, signal: signal ?? "SIGTERM" }),
}
