"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card } from "@/components/ui/card"
import { Cpu, MemoryStick, Monitor, HardDrive, Activity, Gauge, Thermometer, Users, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface SystemMetrics {
  cpu: number
  ram: number
  ramUsed: string
  ramTotal: string
  gpu: number | null
  gpuTemp: number | null
  disk: number
  diskUsed: string
  diskTotal: string
  networkUp: string
  networkDown: string
  processes: number
  uptime: string
  loadAvg: string
  services: { running: number; total: number }
}

function generateMetrics(): SystemMetrics {
  return {
    cpu: 30 + Math.round(Math.random() * 50),
    ram: 40 + Math.round(Math.random() * 40),
    ramUsed: `${(8 + Math.random() * 8).toFixed(1)} GB`,
    ramTotal: "16 GB",
    gpu: Math.random() > 0.3 ? 20 + Math.round(Math.random() * 60) : null,
    gpuTemp: Math.random() > 0.3 ? 55 + Math.round(Math.random() * 25) : null,
    disk: 40 + Math.round(Math.random() * 30),
    diskUsed: `${(200 + Math.random() * 300).toFixed(0)} GB`,
    diskTotal: "512 GB",
    networkUp: `${(1 + Math.random() * 10).toFixed(1)} Mbps`,
    networkDown: `${(5 + Math.random() * 50).toFixed(1)} Mbps`,
    processes: 120 + Math.round(Math.random() * 80),
    uptime: `${Math.floor(24 + Math.random() * 48)}h ${Math.floor(Math.random() * 60)}m`,
    loadAvg: `${(1 + Math.random() * 3).toFixed(2)}, ${(1 + Math.random() * 2).toFixed(2)}, ${(0.5 + Math.random() * 1.5).toFixed(2)}`,
    services: { running: 4 + Math.round(Math.random() * 2), total: 8 },
  }
}

const gaugeColor = (value: number) => {
  if (value < 50) return "success"
  if (value < 80) return "warning"
  return "error"
}

const metricCards = [
  { id: "cpu", label: "CPU", icon: Cpu, color: "text-blue-400 bg-blue-500/10" },
  { id: "ram", label: "RAM", icon: MemoryStick, color: "text-emerald-400 bg-emerald-500/10" },
  { id: "gpu", label: "GPU", icon: Monitor, color: "text-purple-400 bg-purple-500/10" },
  { id: "disk", label: "Disk", icon: HardDrive, color: "text-amber-400 bg-amber-500/10" },
]

const processes = [
  { name: "ollama", pid: 28491, cpu: "2.3%", ram: "1.2 GB", status: "running" as const, user: "flowmind" },
  { name: "lm-studio", pid: 28512, cpu: "0.8%", ram: "2.1 GB", status: "running" as const, user: "flowmind" },
  { name: "comfyui", pid: 28534, cpu: "5.1%", ram: "3.4 GB", status: "running" as const, user: "flowmind" },
  { name: "node", pid: 28567, cpu: "1.2%", ram: "0.4 GB", status: "running" as const, user: "flowmind" },
  { name: "postgres", pid: 1234, cpu: "0.3%", ram: "0.8 GB", status: "running" as const, user: "postgres" },
  { name: "redis-server", pid: 5678, cpu: "0.1%", ram: "0.1 GB", status: "running" as const, user: "redis" },
  { name: "nginx", pid: 9012, cpu: "0.0%", ram: "0.05 GB", status: "running" as const, user: "www-data" },
  { name: "dockerd", pid: 3456, cpu: "0.5%", ram: "0.3 GB", status: "running" as const, user: "root" },
]

export default function SystemPage() {
  const [metrics, setMetrics] = useState<SystemMetrics>(generateMetrics())

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(generateMetrics())
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-surface">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">System Monitor</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Real-time system resource monitoring and process management
              </p>
            </div>
            <Badge variant="secondary" className="text-xs gap-1.5">
              <Gauge className="h-3 w-3" />
              Uptime: {metrics.uptime}
            </Badge>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Metric Gauges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricCards.map((mc) => {
            const Icon = mc.icon
            const isGpu = mc.id === "gpu"
            const value = isGpu ? (metrics.gpu ?? 0) : metrics[mc.id as keyof typeof metrics] as number
            if (isGpu && metrics.gpu === null) return null
            return (
              <div key={mc.id} className="rounded-lg border border-border/50 bg-surface p-4 card-hover">
                <div className="flex items-center justify-between mb-3">
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", mc.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {isGpu && metrics.gpuTemp && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Thermometer className="h-2.5 w-2.5" />
                      {metrics.gpuTemp}°C
                    </Badge>
                  )}
                </div>
                <p className="text-2xl font-bold">{value}%</p>
                <Progress value={value} variant={gaugeColor(value)} className="h-1.5 mt-2" />
                <p className="text-xs text-muted-foreground mt-1.5">{mc.label} Usage</p>
              </div>
            )
          })}
        </div>

        {/* Secondary metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Activity className="h-3.5 w-3.5" />
              <span className="text-xs">Load Average</span>
            </div>
            <p className="text-sm font-mono font-semibold">{metrics.loadAvg}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-3.5 w-3.5" />
              <span className="text-xs">Processes</span>
            </div>
            <p className="text-sm font-mono font-semibold">{metrics.processes}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ArrowDown className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-xs">Network Down</span>
            </div>
            <p className="text-sm font-mono font-semibold">{metrics.networkDown}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ArrowUp className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs">Network Up</span>
            </div>
            <p className="text-sm font-mono font-semibold">{metrics.networkUp}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <HardDrive className="h-3.5 w-3.5" />
              <span className="text-xs">RAM</span>
            </div>
            <p className="text-sm font-semibold">{metrics.ramUsed} / {metrics.ramTotal}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <HardDrive className="h-3.5 w-3.5" />
              <span className="text-xs">Disk</span>
            </div>
            <p className="text-sm font-semibold">{metrics.diskUsed} / {metrics.diskTotal}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Activity className="h-3.5 w-3.5" />
              <span className="text-xs">Services</span>
            </div>
            <p className="text-sm font-semibold">
              {metrics.services.running} / {metrics.services.total} running
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Gauge className="h-3.5 w-3.5" />
              <span className="text-xs">System Uptime</span>
            </div>
            <p className="text-sm font-mono font-semibold">{metrics.uptime}</p>
          </Card>
        </div>

        {/* Process List */}
        <section>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            Running Processes
            <Badge variant="outline" className="text-[10px] font-normal">{processes.length} processes</Badge>
          </h2>
          <div className="rounded-lg border border-border/50 bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">PID</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">CPU</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Memory</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">User</th>
                  </tr>
                </thead>
                <tbody>
                  {processes.map((proc) => (
                    <tr key={proc.pid} className="border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-sm">{proc.name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{proc.pid}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{proc.cpu}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{proc.ram}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          {proc.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{proc.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
