import { z } from "zod"

export const RuntimeCapabilitySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  supportedNodeTypes: z.array(z.string()).optional(),
  supportedInputTypes: z.array(z.string()).optional(),
  maxConcurrent: z.number().int().positive().default(1),
})

export type RuntimeCapability = z.infer<typeof RuntimeCapabilitySchema>

export const RuntimeManifestSchema = z.object({
  name: z.string().min(1),
  endpoint: z.string().url(),
  description: z.string().optional(),
  version: z.string().default("1.0.0"),
  capabilities: z.array(RuntimeCapabilitySchema).default([]),
  healthCheckPath: z.string().default("/health"),
  authHeader: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export type RuntimeManifest = z.infer<typeof RuntimeManifestSchema>

export interface RegisteredRuntime {
  id: string
  manifest: RuntimeManifest
  status: "online" | "offline" | "degraded"
  registeredAt: Date
  lastHealthCheck: Date | null
  currentLoad: number
}

export interface DispatchResult {
  runtimeId: string
  endpoint: string
  authHeader: string | null
  latencyMs: number
}

export class RuntimeRegistry {
  private runtimes = new Map<string, RegisteredRuntime>()
  private healthCheckIntervals = new Map<string, ReturnType<typeof setInterval>>()

  register(manifest: RuntimeManifest): RegisteredRuntime {
    const existing = this.findByEndpoint(manifest.endpoint)
    if (existing) {
      existing.manifest = manifest
      existing.status = "online"
      existing.lastHealthCheck = new Date()
      return existing
    }

    const id = `rt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const runtime: RegisteredRuntime = {
      id,
      manifest,
      status: "online",
      registeredAt: new Date(),
      lastHealthCheck: null,
      currentLoad: 0,
    }

    this.runtimes.set(id, runtime)
    this.startHealthCheck(runtime)
    return runtime
  }

  unregister(id: string): boolean {
    const interval = this.healthCheckIntervals.get(id)
    if (interval) {
      clearInterval(interval)
      this.healthCheckIntervals.delete(id)
    }
    return this.runtimes.delete(id)
  }

  get(id: string): RegisteredRuntime | undefined {
    return this.runtimes.get(id)
  }

  list(): RegisteredRuntime[] {
    return Array.from(this.runtimes.values())
  }

  findByEndpoint(endpoint: string): RegisteredRuntime | undefined {
    return Array.from(this.runtimes.values()).find(
      (r) => r.manifest.endpoint === endpoint
    )
  }

  dispatch(task: {
    nodeType: string
    inputType?: string
  }): DispatchResult | null {
    const candidates = this.list().filter((r) => {
      if (r.status !== "online") return false
      if (r.manifest.capabilities.length === 0) return true
      return r.manifest.capabilities.some((cap) => {
        const nodeMatch =
          !cap.supportedNodeTypes ||
          cap.supportedNodeTypes.includes(task.nodeType)
        const inputMatch =
          !cap.supportedInputTypes ||
          !task.inputType ||
          cap.supportedInputTypes.includes(task.inputType)
        return nodeMatch && inputMatch
      })
    })

    if (candidates.length === 0) return null

    candidates.sort((a, b) => a.currentLoad - b.currentLoad)
    const best = candidates[0]!

    return {
      runtimeId: best.id,
      endpoint: best.manifest.endpoint,
      authHeader: best.manifest.authHeader ?? null,
      latencyMs: Date.now() - best.registeredAt.getTime(),
    }
  }

  updateLoad(id: string, load: number): void {
    const runtime = this.runtimes.get(id)
    if (runtime) {
      runtime.currentLoad = load
    }
  }

  private startHealthCheck(runtime: RegisteredRuntime): void {
    const interval = setInterval(async () => {
      try {
        const url = `${runtime.manifest.endpoint}${runtime.manifest.healthCheckPath}`
        const headers: Record<string, string> = {}
        if (runtime.manifest.authHeader) {
          headers["Authorization"] = runtime.manifest.authHeader
        }
        const res = await fetch(url, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(5000),
        })
        runtime.status = res.ok ? "online" : "degraded"
        runtime.lastHealthCheck = new Date()
      } catch {
        runtime.status = "offline"
        runtime.lastHealthCheck = new Date()
      }
    }, 30_000)

    this.healthCheckIntervals.set(runtime.id, interval)
  }

  destroy(): void {
    for (const [, interval] of this.healthCheckIntervals) {
      clearInterval(interval)
    }
    this.healthCheckIntervals.clear()
    this.runtimes.clear()
  }
}

export const runtimeRegistry = new RuntimeRegistry()
