"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Activity, Cpu, MemoryStick, StopCircle, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { useQuery } from "@/hooks/use-query"

const statusBadge: Record<string, { label: string; color: string }> = {
  running: { label: "Running", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  sleeping: { label: "Sleeping", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  stopped: { label: "Stopped", color: "bg-muted text-muted-foreground border-border" },
  zombie: { label: "Zombie", color: "bg-red-500/10 text-red-400 border-red-500/20" },
}

interface Process {
  pid: number
  name: string
  status: string
  cpu: string
  ram: string
  ramBytes: number
  user: string
  uptime: string
  command: string
  port: number | null
}

export default function ProcessesPage() {
  const [search, setSearch] = useState("")
  const [selectedPids, setSelectedPids] = useState<Set<number>>(new Set())
  const [sortBy, setSortBy] = useState<"cpu" | "ram" | "name" | "pid">("cpu")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const { data: allProcesses = [], loading, refetch } = useQuery(
    "processes:list",
    () => api.system.listProcesses(),
    { staleTime: 5_000 },
  )

  useEffect(() => {
    const interval = setInterval(refetch, 5_000)
    return () => clearInterval(interval)
  }, [refetch])

  const filtered = allProcesses
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.command.toLowerCase().includes(search.toLowerCase()))
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

  const handleKill = async (pid: number) => {
    try {
      const result = await api.system.killProcess(pid)
      if (result.success) refetch()
    } catch {}
  }

  const handleKillSelected = async () => {
    for (const pid of selectedPids) {
      try { await api.system.killProcess(pid) } catch {}
    }
    setSelectedPids(new Set())
    refetch()
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
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" disabled={selectedPids.size === 0} onClick={handleKillSelected}>
                <StopCircle className="h-3 w-3" />
                Kill ({selectedPids.size})
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={refetch} disabled={loading}>
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
                      <td className="px-3 py-2.5 font-mono text-xs">{proc.cpu}%</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{proc.ram}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{proc.user}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{proc.uptime}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">
                        {proc.port ? `:${proc.port}` : "-"}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
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
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading processes...</div>
          ) : filtered.length === 0 && (
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
        </div>
      </div>
    </div>
  )
}
