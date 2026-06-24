"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Play, PowerOff, Server, Activity, ExternalLink, Loader2 } from "lucide-react"
import { api, Framework } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

const statusColors = {
  running: "bg-green-500",
  stopped: "bg-gray-500",
  error: "bg-red-500",
}

interface FrameworkCardProps {
  framework: Framework
  onStatusChange?: (id: string, status: Framework["status"]) => void
}

export function FrameworkCard({ framework, onStatusChange }: FrameworkCardProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setLoading(true)
    try {
      if (framework.status === "running") {
        const res = await api.system.stopFramework(framework.id)
        toast({ title: res.message, variant: "success" })
        onStatusChange?.(framework.id, "stopped")
      } else {
        const res = await api.system.startFramework(framework.id)
        toast({ title: res.message, variant: "success" })
        onStatusChange?.(framework.id, "running")
      }
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Operation failed",
        variant: "error",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-4 hover:bg-accent/30 transition-colors cursor-pointer">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{framework.icon}</span>
          <div>
            <h3 className="font-semibold text-sm">{framework.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-block h-2 w-2 rounded-full ${statusColors[framework.status]}`} />
              <span className="text-xs capitalize text-muted-foreground">{framework.status}</span>
              <Badge variant="outline" className="text-[9px] font-normal">{framework.category}</Badge>
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant={framework.status === "running" ? "secondary" : "default"}
          className="gap-1 text-xs h-7 min-w-[60px]"
          onClick={handleToggle}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : framework.status === "running" ? (
            <><PowerOff className="h-3 w-3" /> Stop</>
          ) : (
            <><Play className="h-3 w-3" /> Start</>
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{framework.description}</p>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Server className="h-3 w-3" /> Port {framework.port}
        </span>
        <span>v{framework.version}</span>
        {framework.pid && (
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" /> PID {framework.pid}
          </span>
        )}
        <span className="flex items-center gap-1 text-blue-400">
          <ExternalLink className="h-3 w-3" /> {framework.models} models
        </span>
      </div>
    </Card>
  )
}
