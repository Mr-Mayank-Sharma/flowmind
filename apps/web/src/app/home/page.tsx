"use client"

import { useState, useEffect, useCallback } from "react"
import { SystemOverview } from "@/components/home/system-overview"
import { FrameworkCard } from "@/components/home/framework-card"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Activity, Cpu, Zap, GitBranch, Bot, AlertTriangle, Clock, ArrowUpRight, CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, Framework, SystemMetrics, ActivityEntry, GPUMetrics } from "@/lib/api"

const metricSchema = [
  { label: "Pipelines Running", key: "pipelines", icon: GitBranch, color: "text-blue-500 bg-blue-500/10", format: (v: number) => String(v) },
  { label: "Agents Active", key: "agents", icon: Bot, color: "text-emerald-500 bg-emerald-500/10", format: (v: number) => String(v) },
  { label: "Services Running", key: "services", icon: AlertTriangle, color: "text-amber-500 bg-amber-500/10", format: (v: number) => String(v) },
  { label: "Avg Latency", key: "latency", icon: Clock, color: "text-purple-500 bg-purple-500/10", format: (v: number) => `${v}ms` },
]

const statusIcon = {
  success: CheckCircle,
  info: Loader2,
  warning: AlertTriangle,
  error: XCircle,
}

const statusColor = {
  success: "text-emerald-500",
  info: "text-blue-500",
  warning: "text-amber-500",
  error: "text-red-500",
}

export default function HomePage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [gpus, setGPUs] = useState<GPUMetrics[]>([])
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const [runtimeStatus, setRuntimeStatus] = useState<{ online: boolean }>({ online: false })

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const [fw, m, g, a, rh] = await Promise.all([
        api.system.getFrameworks(),
        api.system.getMetrics(),
        api.system.getGPUMetrics(),
        api.system.getRecentActivity(8),
        api.models.getRuntimeHealth().catch(() => ({ online: false, status: "error" })),
      ])
      setRuntimeStatus(rh)
      setFrameworks(fw)
      setMetrics(m)
      setGPUs(g)
      setActivity(a)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    fetchData()
  }, [fetchData])

  const runningCount = frameworks.filter((f) => f.status === "running").length
  const stoppedCount = frameworks.filter((f) => f.status === "stopped").length
  const errorCount = frameworks.filter((f) => f.status === "error").length

  const derivedMetrics = [
    { label: "Pipelines Running", value: "12", change: "+2", trend: "up" as const, icon: GitBranch, color: "text-blue-500 bg-blue-500/10" },
    { label: "Agents Active", value: `${runningCount}`, change: `+${runningCount}`, trend: "up" as const, icon: Bot, color: "text-emerald-500 bg-emerald-500/10" },
    { label: "Errors Today", value: `${errorCount}`, change: `-${stoppedCount}`, trend: "down" as const, icon: AlertTriangle, color: "text-red-500 bg-red-500/10" },
    { label: "CPU Load", value: metrics ? `${metrics.cpuPercent}%` : "--", change: metrics ? `${metrics.cpuPercent > 60 ? "▲" : "▼"} ${metrics.cpuPercent}%` : "", trend: metrics && metrics.cpuPercent > 60 ? "up" as const : "down" as const, icon: Activity, color: "text-amber-500 bg-amber-500/10" },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-surface">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Control Center</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Monitor and manage your AI infrastructure
              </p>
            </div>
            <div className="flex items-center gap-3">
              {error && (
                <button
                  onClick={fetchData}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </button>
              )}
              <Badge variant="secondary" className={cn("text-xs gap-1.5", error && "border-red-500/50")}>
                <span className={cn("h-1.5 w-1.5 rounded-full", error ? "bg-red-500" : "bg-emerald-500", !error && "animate-pulse")} />
                {error ? "Connection error" : "All systems nominal"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {error ? (
          <Card className="p-12 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </Card>
        ) : (
          <>
            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i} className="p-4">
                      <Skeleton className="h-9 w-9 rounded-lg mb-3" />
                      <Skeleton className="h-7 w-20 mb-1" />
                      <Skeleton className="h-4 w-24" />
                    </Card>
                  ))
                : derivedMetrics.map((metric, i) => {
                    const Icon = metric.icon
                    return (
                      <div
                        key={metric.label}
                        className={cn(
                          "rounded-lg border border-border/50 bg-surface p-4 transition-all",
                          "card-hover",
                          mounted && "animate-fade-in-up"
                        )}
                        style={{ animationDelay: `${i * 50}ms`, animationFillMode: "backwards" as any }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", metric.color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[10px] font-mono",
                              metric.trend === "up" ? "text-emerald-500" : "text-red-500"
                            )}
                          >
                            {metric.change}
                          </Badge>
                        </div>
                        <p className="text-2xl font-bold">{metric.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{metric.label}</p>
                      </div>
                    )
                  })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                <SystemOverview metrics={metrics} loading={loading} />

                {/* Frameworks */}
                <section>
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    Detected Frameworks
                    <Badge variant="outline" className="text-[10px] font-normal">{loading ? "--" : frameworks.length} total</Badge>
                  </h2>
                  {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} className="p-4 space-y-3">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-8 w-8 rounded" />
                            <div className="space-y-1.5">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-3 w-16" />
                            </div>
                          </div>
                          <Skeleton className="h-3 w-40" />
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {frameworks.map((fw) => (
                        <FrameworkCard
                          key={fw.id}
                          framework={fw}
                          onStatusChange={(id, status) => {
                            setFrameworks((prev) => prev.map((f) => f.id === id ? { ...f, status } : f))
                          }}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* GPU Dashboard */}
                <section>
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-sm font-semibold flex items-center gap-2">
                        <Zap className="h-4 w-4 text-yellow-500" />
                        GPU Dashboard
                      </h2>
                      <Badge variant="secondary" className="text-[10px]">
                        {loading ? "--" : gpus.length} GPUs detected
                      </Badge>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      {loading
                        ? Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="space-y-3 rounded-lg border border-border/50 bg-background p-4">
                              <Skeleton className="h-4 w-40" />
                              <div className="space-y-1">
                                <Skeleton className="h-3 w-28" />
                                <Skeleton className="h-2 rounded-full" />
                              </div>
                              <div className="space-y-1">
                                <Skeleton className="h-3 w-28" />
                                <Skeleton className="h-2 rounded-full" />
                              </div>
                            </div>
                          ))
                        : gpus.map((gpu) => (
                            <div key={gpu.id} className="space-y-3 rounded-lg border border-border/50 bg-background p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Cpu className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium text-sm">{gpu.name}</span>
                                </div>
                                <span className="text-[11px] text-muted-foreground">{gpu.temperature}°C</span>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Compute</span>
                                  <span className="font-mono">{gpu.utilization}%</span>
                                </div>
                                <Progress value={gpu.utilization} variant={gpu.utilization > 80 ? "warning" : "success"} />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Memory</span>
                                  <span className="font-mono">{gpu.memoryUtil}%</span>
                                </div>
                                <Progress value={gpu.memoryUtil} variant={gpu.memoryUtil > 80 ? "warning" : "default"} />
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Activity className="h-3 w-3" />
                                <span>VRAM: {gpu.vramUsed} / {gpu.vramTotal}</span>
                              </div>
                            </div>
                          ))}
                    </div>
                  </Card>
                </section>
              </div>

              {/* Activity Feed */}
              <div className="space-y-4">
                <div className="rounded-lg border border-border/50 bg-surface">
                  <div className="px-4 py-3 border-b border-border/50">
                    <h2 className="text-sm font-semibold">Activity Feed</h2>
                  </div>
                  <div className="divide-y divide-border/50">
                    {loading
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="flex items-start gap-3 px-4 py-3">
                            <Skeleton className="h-4 w-4 rounded-full mt-0.5 shrink-0" />
                            <div className="flex-1 space-y-1">
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-3 w-20" />
                            </div>
                          </div>
                        ))
                      : activity.map((item) => {
                          const Icon = statusIcon[item.type]
                          return (
                            <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                              <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", statusColor[item.type], item.type === "info" && "animate-spin-slow")} />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm">{item.message}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{item.time}</p>
                              </div>
                            </div>
                          )
                        })}
                  </div>
                  <div className="px-4 py-2.5 border-t border-border/50">
                    <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <ArrowUpRight className="h-3 w-3" />
                      View all activity
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
