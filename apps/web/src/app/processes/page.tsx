"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, RotateCcw, Activity, Cpu, MemoryStick, StopCircle, RefreshCw, Terminal, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

interface Process {
  pid: number
  name: string
  status: "running" | "sleeping" | "stopped" | "zombie"
  cpu: string
  ram: string
  ramBytes: number
  user: string
  uptime: string
  command: string
  port?: number
}

const allProcesses: Process[] = [
  { pid: 28491, name: "ollama", status: "running", cpu: "2.3%", ram: "1.2 GB", ramBytes: 1_200_000_000, user: "flowmind", uptime: "12h 34m", command: "/usr/bin/ollama serve", port: 11434 },
  { pid: 28512, name: "lm-studio", status: "running", cpu: "0.8%", ram: "2.1 GB", ramBytes: 2_100_000_000, user: "flowmind", uptime: "8h 12m", command: "./lm-studio --api --port 1234", port: 1234 },
  { pid: 28534, name: "comfyui", status: "running", cpu: "5.1%", ram: "3.4 GB", ramBytes: 3_400_000_000, user: "flowmind", uptime: "6h 45m", command: "python main.py --listen --port 8188", port: 8188 },
  { pid: 28567, name: "hermes-agent", status: "running", cpu: "1.2%", ram: "0.4 GB", ramBytes: 400_000_000, user: "flowmind", uptime: "4h 20m", command: "node dist/index.js", port: 3001 },
  { pid: 28589, name: "localai", status: "running", cpu: "0.9%", ram: "0.8 GB", ramBytes: 800_000_000, user: "flowmind", uptime: "2h 15m", command: "./local-ai --port 8080", port: 8080 },
  { pid: 1234, name: "postgres", status: "sleeping", cpu: "0.3%", ram: "0.8 GB", ramBytes: 800_000_000, user: "postgres", uptime: "24h 00m", command: "postgres -D /var/lib/postgresql/data", port: 5432 },
  { pid: 5678, name: "redis-server", status: "running", cpu: "0.1%", ram: "0.1 GB", ramBytes: 100_000_000, user: "redis", uptime: "24h 00m", command: "redis-server *:6379", port: 6379 },
  { pid: 9012, name: "nginx", status: "running", cpu: "0.0%", ram: "0.05 GB", ramBytes: 50_000_000, user: "www-data", uptime: "24h 00m", command: "nginx: master process", port: 80 },
  { pid: 3456, name: "dockerd", status: "running", cpu: "0.5%", ram: "0.3 GB", ramBytes: 300_000_000, user: "root", uptime: "24h 00m", command: "dockerd -H unix://" },
  { pid: 7890, name: "python3", status: "stopped", cpu: "0.0%", ram: "0.2 GB", ramBytes: 200_000_000, user: "flowmind", uptime: "0h 30m", command: "python3 train_model.py" },
  { pid: 1111, name: "node", status: "running", cpu: "1.8%", ram: "0.6 GB", ramBytes: 600_000_000, user: "flowmind", uptime: "3h 00m", command: "node server.js" },
  { pid: 2222, name: "opencode", status: "zombie", cpu: "0.0%", ram: "0.01 GB", ramBytes: 10_000_000, user: "flowmind", uptime: "1h 00m", command: "opencode --port 8080" },
]

const statusBadge: Record<string, { label: string; color: string }> = {
  running: { label: "Running", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  sleeping: { label: "Sleeping", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  stopped: { label: "Stopped", color: "bg-muted text-muted-foreground border-border" },
  zombie: { label: "Zombie", color: "bg-red-500/10 text-red-400 border-red-500/20" },
}

export default function ProcessesPage() {
  const [search, setSearch] = useState("")
  const [selectedPids, setSelectedPids] = useState<Set<number>>(new Set())
  const [sortBy, setSortBy] = useState<"cpu" | "ram" | "name" | "pid">("cpu")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const filtered = allProcesses
    .filter((p) => !search || p.name.includes(search.toLowerCase()) || p.command.includes(search))
    .sort((a, b) => {
      let cmp = 0
      if (sortBy === "cpu") cmp = parseFloat(a.cpu) - parseFloat(b.cpu)
      else if (sortBy === "ram") cmp = a.ramBytes - b.ramBytes
      else if (sortBy === "name") cmp = a.name.localeCompare(b.name)
      else if (sortBy === "pid") cmp = a.pid - b.pid
      return sortDir === "desc" ? -cmp : cmp
    })

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    else { setSortBy(field); setSortDir("desc") }
  }

  const sortIndicator = (field: typeof sortBy) => {
    if (sortBy !== field) return ""
    return sortDir === "desc" ? " ↓" : " ↑"
  }

  const totalCPU = allProcesses.reduce((acc, p) => acc + parseFloat(p.cpu), 0).toFixed(1)
  const totalRAMbytes = allProcesses.reduce((acc, p) => acc + p.ramBytes, 0)
  const totalRAM = (totalRAMbytes / 1_000_000_000).toFixed(1)

  const handleKill = (pid: number) => {
    console.log("Kill", pid)
  }

  const handleRestart = (pid: number) => {
    console.log("Restart", pid)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-surface">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Process Manager</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                View and manage running processes on the system
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{allProcesses.length} processes</span>
              <span>CPU: {totalCPU}%</span>
              <span>RAM: {totalRAM} GB</span>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search processes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" disabled={selectedPids.size === 0}>
                <StopCircle className="h-3 w-3" />
                Kill ({selectedPids.size})
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" disabled={selectedPids.size === 0}>
                <RefreshCw className="h-3 w-3" />
                Restart
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="rounded-lg border border-border/50 bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="w-8 px-2 py-2.5">
                    <input
                      type="checkbox"
                      className="rounded border-border"
                      onChange={(e) => {
                        if (e.target.checked) setSelectedPids(new Set(filtered.map((p) => p.pid)))
                        else setSelectedPids(new Set())
                      }}
                    />
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("name")}>
                    Name{sortIndicator("name")}
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("pid")}>
                    PID{sortIndicator("pid")}
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("cpu")}>
                    CPU{sortIndicator("cpu")}
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("ram")}>
                    Memory{sortIndicator("ram")}
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">User</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Uptime</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Port</th>
                  <th className="w-20 px-3 py-2.5 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((proc) => {
                  const sb = statusBadge[proc.status] ?? { label: proc.status, color: "bg-muted text-muted-foreground border-border" }
                  return (
                    <tr
                      key={proc.pid}
                      className={cn(
                        "border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors",
                        selectedPids.has(proc.pid) && "bg-primary/[0.02]"
                      )}
                    >
                      <td className="px-2 py-2.5">
                        <input
                          type="checkbox"
                          className="rounded border-border"
                          checked={selectedPids.has(proc.pid)}
                          onChange={() => {
                            const next = new Set(selectedPids)
                            if (next.has(proc.pid)) next.delete(proc.pid)
                            else next.add(proc.pid)
                            setSelectedPids(next)
                          }}
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-sm">{proc.name}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{proc.pid}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant="secondary" className={cn("text-[10px]", sb.color)}>{sb.label}</Badge>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{proc.cpu}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{proc.ram}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{proc.user}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{proc.uptime}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">
                        {proc.port ? `:${proc.port}` : "-"}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleRestart(proc.pid)} className="p-1 text-muted-foreground hover:text-foreground transition-colors" title="Restart">
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleKill(proc.pid)} className="p-1 text-muted-foreground hover:text-red-400 transition-colors" title="Kill">
                            <StopCircle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              No processes match your search
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {filtered.length} of {allProcesses.length} processes
          </span>
          <span className="flex items-center gap-1">
            <Cpu className="h-3 w-3" />
            Total CPU: {totalCPU}%
          </span>
          <span className="flex items-center gap-1">
            <MemoryStick className="h-3 w-3" />
            Total RAM: {totalRAM} GB
          </span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            Click a process name for details
          </span>
        </div>
      </div>
    </div>
  )
}
