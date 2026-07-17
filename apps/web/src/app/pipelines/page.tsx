"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Badge, Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@flowmind/ui"
import { Plus, Workflow, Clock, Play, Trash2, Store } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { api } from "@/lib/api"

const statusColors: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  ARCHIVED: "outline",
}

function timeAgo(date: string | null): string {
  if (!date) return ""
  const ms = Date.now() - new Date(date).getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return "just now"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 30) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)

  useEffect(() => {
    api.pipeline.list().then((res) => {
      setPipelines(res.pipelines ?? [])
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDeletingId(id)
    try {
      await api.pipeline.delete(id)
      setPipelines((prev) => prev.filter(p => p.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const handleNew = async () => {
    setCreating(true)
    try {
      const created = await api.pipeline.create({ name: "New Pipeline", description: "Start building your workflow", graph: { nodes: [], edges: [] } })
      setPipelines((prev) => [{ ...created, nodeCount: 0 }, ...prev])
    } finally {
      setCreating(false)
    }
  }

  const handleTrigger = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setRunningId(id)
    try {
      await api.pipeline.trigger(id, {})
    } catch (err) {
      console.error("Trigger failed:", err)
    } finally {
      setRunningId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pipelines</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your workflow pipelines
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/marketplace">
              <Button variant="outline" className="gap-2">
                <Store className="h-4 w-4" />
                Marketplace
              </Button>
            </Link>
            <Button onClick={handleNew} disabled={creating} className="gap-2">
              <Plus className="h-4 w-4" />
              {creating ? "Creating..." : "New Pipeline"}
            </Button>
          </div>
        </div>
        {!loaded ? (
          <div className="text-center py-16 text-muted-foreground">
            <Workflow className="h-12 w-12 mx-auto mb-4 opacity-30 animate-pulse" />
            <p className="text-sm">Loading pipelines...</p>
          </div>
        ) : pipelines.length === 0 ? (
          <EmptyState
            icon={Workflow}
            title="No pipelines yet"
            description="Create your first workflow to get started"
            action={{ label: "New Pipeline", onClick: handleNew }}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pipelines.map((pipeline) => (
              <div key={pipeline.id} className="group relative">
                <div className="absolute top-2 right-2 z-10 flex gap-1">
                  <button
                    onClick={(e) => handleTrigger(pipeline.id, e)}
                    disabled={runningId === pipeline.id}
                    className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
                    title="Run pipeline"
                  >
                    <Play className={`h-3.5 w-3.5 ${runningId === pipeline.id ? "animate-pulse" : ""}`} />
                  </button>
                  <button
                    onClick={(e) => handleDelete(pipeline.id, e)}
                    disabled={deletingId === pipeline.id}
                    className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Link href={`/pipelines/${pipeline.id}`}>
                  <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base">{pipeline.name}</CardTitle>
                          <CardDescription className="text-xs">
                            {pipeline.description}
                          </CardDescription>
                        </div>
                        <Badge variant={statusColors[pipeline.status]}>
                          {pipeline.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Workflow className="h-3 w-3" />
                          {pipeline.nodeCount} nodes
                        </span>
                        {pipeline.lastRunAt ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timeAgo(pipeline.lastRunAt)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Play className="h-3 w-3" />
                            Never run
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
