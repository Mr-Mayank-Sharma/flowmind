"use client"

import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Monitor, Cpu, HardDrive, Activity } from "lucide-react"
import { SystemMetrics } from "@/lib/api"

interface Props {
  metrics: SystemMetrics | null
  loading: boolean
}

export function SystemOverview({ metrics, loading }: Props) {
  const gaugeColor = (value: number) => {
    if (value < 50) return "success" as const
    if (value < 80) return "warning" as const
    return "error" as const
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold mb-1">System Overview</h2>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading system status..."
              : `Total AI Services: ${metrics?.servicesRunning ?? "--"} running / ${metrics?.servicesTotal ?? "--"} total`
            }
          </p>
        </div>
        <Monitor className="h-8 w-8 text-muted-foreground" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading ? (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-2 rounded-full" />
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Cpu className="h-4 w-4" /> CPU
                </span>
                <span className="font-mono text-xs">{metrics?.cpuPercent ?? "--"}%</span>
              </div>
              <Progress value={metrics?.cpuPercent ?? 0} variant={gaugeColor(metrics?.cpuPercent ?? 0)} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <HardDrive className="h-4 w-4" /> RAM
                </span>
                <span className="font-mono text-xs">{metrics?.ramPercent ?? "--"}% ({metrics?.ramUsedGb ?? "--"} / {metrics?.ramTotalGb ?? "--"} GB)</span>
              </div>
              <Progress value={metrics?.ramPercent ?? 0} variant={gaugeColor(metrics?.ramPercent ?? 0)} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Activity className="h-4 w-4" /> GPU
                </span>
                <span className="font-mono text-xs">
                  {metrics?.gpuPercent != null ? `${metrics.gpuPercent}%` : "--"}
                  {metrics?.gpuTemp != null ? ` (${metrics.gpuTemp}°C)` : ""}
                </span>
              </div>
              <Progress value={metrics?.gpuPercent ?? 0} variant={gaugeColor(metrics?.gpuPercent ?? 0)} />
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
