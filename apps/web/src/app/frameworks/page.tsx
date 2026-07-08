"use client"

import Link from "next/link"
import { useState, useMemo, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Play, Square, RotateCcw, AlertCircle, Server, Wifi, WifiOff, Bot, Sparkles, Brush, Shield, Zap, Keyboard, Image, Brain, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "../../lib/api"

interface Framework {
  id: string
  name: string
  icon: string
  status: "running" | "stopped" | "error"
  port: number
  version: string
  pid: number | null
  models: number
  description: string
  category: string
}

const frameworkIcons: Record<string, React.ElementType> = {
  ollama: Bot,
  "lm-studio": Bot,
  comfyui: Brush,
  openclaw: Shield,
  hermes: Zap,
  opencode: Keyboard,
  sd: Image,
  localai: Brain,
}

const categories = ["All", "LLM", "Image", "Agent", "Dev Tools"] as const
const statusFilters = ["All", "running", "stopped", "error"] as const

export default function FrameworksPage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string>("All")
  const [statusFilter, setStatusFilter] = useState<string>("All")

  useEffect(() => {
    api.system.getFrameworks()
      .then((data: any) => {
        const fws = data?.result?.data?.data ?? data?.result?.data ?? data?.data ?? data ?? []
        setFrameworks(Array.isArray(fws) ? fws : [])
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const filtered = useMemo(() => {
    return frameworks.filter((fw) => {
      if (statusFilter !== "All" && fw.status !== statusFilter) return false
      if (category !== "All" && fw.category !== category) return false
      if (search && !fw.name.toLowerCase().includes(search.toLowerCase()) && !fw.id.includes(search.toLowerCase())) return false
      return true
    })
  }, [search, category, statusFilter, frameworks])

  const statusBadge = (status: string) => {
    switch (status) {
      case "running": return { label: "Running", dot: "bg-emerald-500", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" }
      case "stopped": return { label: "Stopped", dot: "bg-muted-foreground", bg: "bg-muted text-muted-foreground border-border" }
      case "error": return { label: "Error", dot: "bg-red-500", bg: "bg-red-500/10 text-red-400 border-red-500/20" }
      default: return { label: status, dot: "bg-muted-foreground", bg: "" }
    }
  }

  const runningCount = frameworks.filter((f) => f.status === "running").length

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
              {loading ? "..." : runningCount}/{loading ? "..." : frameworks.length} running
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
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 mb-2 animate-spin" />
            <p className="text-sm">Scanning for AI frameworks...</p>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2 text-red-400" />
            <p className="text-sm text-red-400">Failed to load: {error}</p>
          </div>
        )}
        {!loading && !error && (
          <>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p className="text-sm">No frameworks match your filters</p>
              </div>
            ) : (
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
                        {(() => {
                          const FwIcon = frameworkIcons[fw.icon] || Bot
                          return <FwIcon className="h-6 w-6 text-foreground" />
                        })()}
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
            )}
          </>
        )}
      </div>
    </div>
  )
}
