"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card } from "@/components/ui/card"
import { Cpu, MemoryStick, Monitor, HardDrive, Activity, Gauge, Thermometer, Users, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, type SystemMetrics as ApiSystemMetrics } from "@/lib/api"

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

function mapMetrics(m: ApiSystemMetrics): SystemMetrics {
  return {
    cpu: m.cpuPercent,
    ram: m.ramPercent,
    ramUsed: m.ramUsedGb + " GB",
    ramTotal: m.ramTotalGb + " GB",
    gpu: m.gpuPercent,
    gpuTemp: m.gpuTemp,
    disk: m.diskPercent,
    diskUsed: m.diskUsedGb + " GB",
    diskTotal: m.diskTotalGb + " GB",
    networkUp: m.networkUpMbps + " Mbps",
    networkDown: m.networkDownMbps + " Mbps",
    processes: m.processes,
    uptime: m.uptime,
    loadAvg: m.loadAvg,
    services: { running: m.servicesRunning, total: m.servicesTotal },
  }
}

const defaultMetrics: SystemMetrics = {
  cpu: 0, ram: 0, ramUsed: "0 GB", ramTotal: "0 GB",
  gpu: null, gpuTemp: null, disk: 0, diskUsed: "0 GB", diskTotal: "0 GB",
  networkUp: "0 Mbps", networkDown: "0 Mbps", processes: 0,
  uptime: "0h 0m", loadAvg: "0.00, 0.00, 0.00",
  services: { running: 0, total: 0 },
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

interface SystemProcess {
  name: string
  pid: number | null
  status: string
  port: number
  version: string
}

export default function SystemPage() {
  const [metrics, setMetrics] = useState<SystemMetrics>(defaultMetrics)
  const [frameworks, setFrameworks] = useState<SystemProcess[]>([])

  const fetchMetrics = async () => {
    try {
      const [m, fws] = await Promise.all([
        api.system.getMetrics(),
        api.system.getFrameworks(),
      ])
      setMetrics(mapMetrics(m))
      setFrameworks(fws.map((fw) => ({
        name: fw.name,
        pid: fw.pid,
        status: fw.status,
        port: fw.port,
        version: fw.version,
      })))
    } catch {}
  }

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 5000)
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

        {/* Running Services */}
        <section>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            Running Services
            <Badge variant="outline" className="text-[10px] font-normal">{frameworks.length} services</Badge>
          </h2>
          <div className="rounded-lg border border-border/50 bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">PID</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Port</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Version</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {frameworks.map((fw) => (
                    <tr key={fw.name} className="border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-sm">{fw.name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{fw.pid ?? "-"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">:{fw.port}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{fw.version}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="secondary" className={cn(
                          "text-[10px]",
                          fw.status === "running" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground border-border"
                        )}>
                          {fw.status}
                        </Badge>
                      </td>
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
