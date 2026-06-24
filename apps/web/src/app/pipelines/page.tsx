"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Badge, Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@flowmind/ui"
import { Plus, Workflow, Clock, Play, Trash2 } from "lucide-react"

interface PipelineItem {
  id: string
  name: string
  description: string
  status: "DRAFT" | "ACTIVE" | "ARCHIVED"
  lastRunAt: string | null
  nodeCount: number
}

const STORAGE_KEY = "flowmind_pipelines"

const defaultPipelines: PipelineItem[] = [
  { id: "p1", name: "Customer Support Agent", description: "Automated customer inquiry handling with AI escalation", status: "ACTIVE", lastRunAt: "2 hours ago", nodeCount: 8 },
  { id: "p2", name: "Content Rewriter Pipeline", description: "Rewrite blog posts with different tones and formats", status: "DRAFT", lastRunAt: null, nodeCount: 5 },
  { id: "p3", name: "Daily Data Sync", description: "Sync data from multiple sources every 6 hours", status: "ACTIVE", lastRunAt: "15 minutes ago", nodeCount: 12 },
  { id: "p4", name: "Social Media Monitor", description: "Monitor brand mentions across platforms", status: "DRAFT", lastRunAt: "1 day ago", nodeCount: 6 },
  { id: "p5", name: "Research Summarizer", description: "Fetch and summarize research papers weekly", status: "ARCHIVED", lastRunAt: "1 month ago", nodeCount: 4 },
]

function loadPipelines(): PipelineItem[] {
  if (typeof window === "undefined") return defaultPipelines
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return defaultPipelines
}

function savePipelines(pipelines: PipelineItem[]) {
  if (typeof window === "undefined") return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pipelines)) } catch {}
}

const statusColors: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  ARCHIVED: "outline",
}

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<PipelineItem[]>([])

  useEffect(() => {
    setPipelines(loadPipelines())
  }, [])

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const next = pipelines.filter(p => p.id !== id)
    setPipelines(next)
    savePipelines(next)
  }

  const handleNew = () => {
    const id = "p" + Date.now()
    const newPipeline: PipelineItem = {
      id,
      name: "New Pipeline",
      description: "Start building your workflow",
      status: "DRAFT",
      lastRunAt: null,
      nodeCount: 0,
    }
    const next = [newPipeline, ...pipelines]
    setPipelines(next)
    savePipelines(next)
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
          <Button onClick={handleNew} className="gap-2">
            <Plus className="h-4 w-4" />
            New Pipeline
          </Button>
        </div>
        {pipelines.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Workflow className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-1">No pipelines yet</p>
            <p className="text-sm">Create your first pipeline to get started</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pipelines.map((pipeline) => (
              <Link key={pipeline.id} href={`/pipelines/${pipeline.id}`} className="group relative">
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
                          {pipeline.lastRunAt}
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
                <button
                  onClick={(e) => handleDelete(pipeline.id, e)}
                  className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
