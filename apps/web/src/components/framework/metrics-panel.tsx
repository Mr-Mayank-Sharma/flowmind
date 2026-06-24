"use client"

import { useState, useEffect } from "react"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Cpu, MemoryStick, Monitor, Activity, Clock, ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface FrameworkMetrics {
  cpu: number
  ram: number
  gpu: number | null
  uptime: string
  requestsPerMin: number
  avgLatency: string
  activeConnections: number
}

function generateMetrics(frameworkId: string): FrameworkMetrics {
  const base = frameworkId === "ollama" ? 0.7 : frameworkId === "comfyui" ? 0.8 : 0.5
  return {
    cpu: Math.round((30 + Math.random() * 50) * base),
    ram: Math.round((40 + Math.random() * 40) * base),
    gpu: frameworkId === "ollama" || frameworkId === "comfyui" || frameworkId === "localai"
      ? Math.round((20 + Math.random() * 60) * base)
      : null,
    uptime: `${Math.floor(Math.random() * 72 + 1)}h ${Math.floor(Math.random() * 60)}m`,
    requestsPerMin: Math.floor(Math.random() * 120 + 10),
    avgLatency: `${Math.floor(Math.random() * 800 + 100)}ms`,
    activeConnections: Math.floor(Math.random() * 8 + 1),
  }
}

export function MetricsPanel({ frameworkId }: { frameworkId: string }) {
  const [metrics, setMetrics] = useState<FrameworkMetrics>(generateMetrics(frameworkId))

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(generateMetrics(frameworkId))
    }, 3000)
    return () => clearInterval(interval)
  }, [frameworkId])

  const gaugeColor = (value: number) => {
    if (value < 50) return "success"
    if (value < 80) return "warning"
    return "error"
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        Resource Usage
        <Badge variant="secondary" className="text-[10px] font-normal ml-auto">Live</Badge>
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-3 rounded-lg border border-border/50 bg-background/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-medium">CPU</span>
            </div>
            <span className="font-mono text-sm">{metrics.cpu}%</span>
          </div>
          <Progress value={metrics.cpu} variant={gaugeColor(metrics.cpu)} className="h-2" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>4 cores allocated</span>
            <span className="flex items-center gap-0.5">
              <ArrowUp className="h-2.5 w-2.5" />
              {metrics.cpu > 60 ? "High" : "Normal"}
            </span>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border/50 bg-background/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MemoryStick className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-medium">RAM</span>
            </div>
            <span className="font-mono text-sm">{metrics.ram}%</span>
          </div>
          <Progress value={metrics.ram} variant={gaugeColor(metrics.ram)} className="h-2" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>8 GB / 16 GB</span>
            <span className="flex items-center gap-0.5">
              <ArrowUp className="h-2.5 w-2.5" />
              {metrics.ram > 70 ? "High" : "Normal"}
            </span>
          </div>
        </div>

        {metrics.gpu !== null && (
          <div className="space-y-3 rounded-lg border border-border/50 bg-background/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-purple-400" />
                <span className="text-xs font-medium">GPU</span>
              </div>
              <span className="font-mono text-sm">{metrics.gpu}%</span>
            </div>
            <Progress value={metrics.gpu} variant={gaugeColor(metrics.gpu)} className="h-2" />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>NVIDIA RTX 4090</span>
              <span>{metrics.gpu > 70 ? "72°C" : "61°C"}</span>
            </div>
          </div>
        )}

        <div className="space-y-3 rounded-lg border border-border/50 bg-background/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-medium">Requests</span>
            </div>
            <span className="font-mono text-sm">{metrics.requestsPerMin}/min</span>
          </div>
          <Progress value={Math.min(metrics.requestsPerMin / 2, 100)} variant="default" className="h-2" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Avg latency: {metrics.avgLatency}</span>
            <span>{metrics.activeConnections} active</span>
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
          Active connections: {metrics.activeConnections}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Avg latency: {metrics.avgLatency}
        </div>
      </div>
    </div>
  )
}
