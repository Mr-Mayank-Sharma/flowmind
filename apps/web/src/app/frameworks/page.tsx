"use client"

import Link from "next/link"
import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Play, Square, RotateCcw, AlertCircle, Server, Wifi, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"

const allFrameworks = [
  { id: "ollama", name: "Ollama", icon: "🦙", status: "running" as const, port: 11434, version: "0.3.12", pid: 28491, models: 4, category: "LLM" as const, description: "Local LLM inference server" },
  { id: "lm-studio", name: "LM Studio", icon: "🤖", status: "running" as const, port: 1234, version: "0.2.29", pid: 28512, models: 3, category: "LLM" as const, description: "Desktop LLM runtime" },
  { id: "comfyui", name: "ComfyUI", icon: "🎨", status: "running" as const, port: 8188, version: "0.2.4", pid: 28534, models: 4, category: "Image" as const, description: "Node-based SD workflow engine" },
  { id: "openclaw", name: "OpenClaw", icon: "🦀", status: "stopped" as const, port: 9090, version: "1.2.0", pid: null, models: 0, category: "Agent" as const, description: "Agent orchestration framework" },
  { id: "hermes", name: "Hermes Agent", icon: "⚡", status: "running" as const, port: 3001, version: "2.1.5", pid: 28567, models: 2, category: "Agent" as const, description: "AI agent runtime" },
  { id: "opencode", name: "OpenCode", icon: "⌨️", status: "error" as const, port: 8080, version: "0.8.3", pid: null, models: 0, category: "Dev Tools" as const, description: "AI coding assistant" },
  { id: "sd", name: "Stable Diffusion", icon: "🖼️", status: "stopped" as const, port: 7860, version: "1.9.4", pid: null, models: 0, category: "Image" as const, description: "Text-to-image generation" },
  { id: "localai", name: "LocalAI", icon: "🧠", status: "running" as const, port: 8080, version: "2.17.1", pid: 28589, models: 3, category: "LLM" as const, description: "OpenAI-compatible local API" },
]

const categories = ["All", "LLM", "Image", "Agent", "Dev Tools"] as const
const statusFilters = ["All", "running", "stopped", "error"] as const

export default function FrameworksPage() {
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string>("All")
  const [statusFilter, setStatusFilter] = useState<string>("All")

  const filtered = useMemo(() => {
    return allFrameworks.filter((fw) => {
      if (statusFilter !== "All" && fw.status !== statusFilter) return false
      if (category !== "All" && fw.category !== category) return false
      if (search && !fw.name.toLowerCase().includes(search.toLowerCase()) && !fw.id.includes(search.toLowerCase())) return false
      return true
    })
  }, [search, category, statusFilter])

  const statusBadge = (status: string) => {
    switch (status) {
      case "running": return { label: "Running", dot: "bg-emerald-500", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" }
      case "stopped": return { label: "Stopped", dot: "bg-muted-foreground", bg: "bg-muted text-muted-foreground border-border" }
      case "error": return { label: "Error", dot: "bg-red-500", bg: "bg-red-500/10 text-red-400 border-red-500/20" }
      default: return { label: status, dot: "bg-muted-foreground", bg: "" }
    }
  }

  const runningCount = allFrameworks.filter((f) => f.status === "running").length

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-surface">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Framework Hub</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage all AI frameworks running on this machine
              </p>
            </div>
            <Badge variant="secondary" className="text-xs gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {runningCount}/{allFrameworks.length} running
            </Badge>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search frameworks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "px-2.5 py-1.5 text-xs rounded-md transition-colors",
                    category === cat ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-border/50" />
            <div className="flex items-center gap-1">
              {statusFilters.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "px-2 py-1.5 text-xs rounded-md transition-colors",
                    statusFilter === s ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  {s === "All" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((fw) => {
            const sb = statusBadge(fw.status)
            return (
              <Link
                key={fw.id}
                href={`/frameworks/${fw.id}`}
                className="group rounded-lg border border-border/50 bg-surface p-5 transition-all card-hover"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-2xl">{fw.icon}</div>
                  <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium", sb.bg)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", sb.dot, fw.status === "running" && "animate-pulse")} />
                    {sb.label}
                  </div>
                </div>
                <h3 className="font-semibold text-sm">{fw.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 mb-3 line-clamp-1">{fw.description}</p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Server className="h-3 w-3" />
                    :{fw.port}
                  </span>
                  <span>v{fw.version}</span>
                  {fw.models > 0 && <span>{fw.models} models</span>}
                  {fw.pid && <span>PID {fw.pid}</span>}
                </div>
              </Link>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="text-sm">No frameworks match your filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
