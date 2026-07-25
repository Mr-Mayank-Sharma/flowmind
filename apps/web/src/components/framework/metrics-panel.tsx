"use client"

import { useState, useEffect, useCallback } from "react"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Cpu, MemoryStick, Monitor, Activity, Clock, ArrowUp, Loader2, HardDrive, Wifi } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, type SystemMetrics, type GPUMetrics } from "@/lib/api"

export function MetricsPanel({ frameworkId }: { frameworkId: string }) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [gpus, setGPUs] = useState<GPUMetrics[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMetrics = useCallback(async () => {
    try {
      const [m, g] = await Promise.all([
        api.system.getMetrics(),
        api.system.getGPUMetrics(),
      ])
      setMetrics(m)
      setGPUs(g)
    } catch {
      // keep previous values on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 5000)
    return () => clearInterval(interval)
  }, [fetchMetrics])

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!metrics) {
    return <div className="text-muted-foreground text-sm py-8 text-center">Unable to load metrics</div>
  }

  const gpu = gpus[0] ?? null

  const gaugeColor = (value: number) => {
    if (value < 50) return "success"
    if (value < 80) return "warning"
    return "error"
  }

  const formatBytes = (gb: string) => {
    const num = parseFloat(gb)
    return isNaN(num) ? gb : `${num.toFixed(1)} GB`
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        System Resources
        <Badge variant="secondary" className="text-[10px] font-normal ml-auto">Live</Badge>
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-3 rounded-lg border border-border/50 bg-background/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-medium">CPU</span>
            </div>
            <span className="font-mono text-sm">{metrics.cpuPercent}%</span>
          </div>
          <Progress value={metrics.cpuPercent} variant={gaugeColor(metrics.cpuPercent)} className="h-2" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Load: {metrics.loadAvg}</span>
            <span className="flex items-center gap-0.5">
              <ArrowUp className="h-2.5 w-2.5" />
              {metrics.cpuPercent > 60 ? "High" : "Normal"}
            </span>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border/50 bg-background/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MemoryStick className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-medium">RAM</span>
            </div>
            <span className="font-mono text-sm">{metrics.ramPercent}%</span>
          </div>
          <Progress value={metrics.ramPercent} variant={gaugeColor(metrics.ramPercent)} className="h-2" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{formatBytes(metrics.ramUsedGb)} / {formatBytes(metrics.ramTotalGb)}</span>
            <span className="flex items-center gap-0.5">
              <ArrowUp className="h-2.5 w-2.5" />
              {metrics.ramPercent > 70 ? "High" : "Normal"}
            </span>
          </div>
        </div>

        {gpu && (
          <div className="space-y-3 rounded-lg border border-border/50 bg-background/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-purple-400" />
                <span className="text-xs font-medium">GPU</span>
              </div>
              <span className="font-mono text-sm">{gpu.utilization}%</span>
            </div>
            <Progress value={gpu.utilization} variant={gaugeColor(gpu.utilization)} className="h-2" />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{gpu.name}</span>
              <span>{gpu.temperature}C</span>
            </div>
          </div>
        )}

        <div className="space-y-3 rounded-lg border border-border/50 bg-background/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-medium">Disk</span>
            </div>
            <span className="font-mono text-sm">{metrics.diskPercent}%</span>
          </div>
          <Progress value={metrics.diskPercent} variant={gaugeColor(metrics.diskPercent)} className="h-2" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{metrics.diskUsedGb} GB / {metrics.diskTotalGb} GB</span>
            <span className="flex items-center gap-0.5">
              <ArrowUp className="h-2.5 w-2.5" />
              {metrics.diskPercent > 80 ? "High" : "Normal"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Uptime: {metrics.uptime}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          Processes: {metrics.processes}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Network: {metrics.networkUpMbps}MB up / {metrics.networkDownMbps}MB down
        </div>
      </div>
    </div>
  )
}
