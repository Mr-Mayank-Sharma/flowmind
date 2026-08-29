"use client"

import { useRouter } from "next/navigation"
import { Button } from "@flowmind/ui"
import {
  Zap,
  Mail,
  Database,
  FileText,
  Globe,
  GitBranch,
  ArrowRight,
  Shield,
  Search,
  Code,
  Webhook,
  Clock,
  MessageSquare,
  AlertTriangle,
  Merge,
  SplitSquareHorizontal,
  Bot,
  MousePointerClick,
} from "lucide-react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { pipelineTemplates, type PipelineTemplate } from "@/lib/pipeline-templates"

const templateIconMap: Record<string, LucideIcon> = {
  Zap,
  Mail,
  Database,
  FileText,
  Globe,
  GitBranch,
  ArrowRight,
  Shield,
  Search,
  Code,
  Webhook,
  Clock,
  MessageSquare,
  AlertTriangle,
  Merge,
  SplitSquareHorizontal,
  Bot,
  MousePointerClick,
}

const templates = pipelineTemplates.filter((t) => t.id !== "blank")

export default function TemplatesPage() {
  const router = useRouter()

  const handleUseTemplate = async (template: PipelineTemplate) => {
    try {
      const { api } = await import("@/lib/api")
      const created = await api.pipeline.create({
        name: template.name,
        description: template.description,
        graph: { nodes: template.nodes, edges: template.edges },
      })
      router.push(`/pipelines/${created.id}`)
    } catch (err) {
      console.error("Failed to create from template:", err)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-surface">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/pipelines" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pipelines
            </Link>
            <span className="text-muted-foreground text-sm">/</span>
            <h1 className="text-sm font-semibold">Templates</h1>
          </div>
          <Link href="/pipelines">
            <Button variant="ghost" size="sm" className="text-xs">
              Back to Pipelines
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-lg font-semibold">Pipeline Templates</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Start with a pre-built workflow and customize it for your needs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => {
            const Icon = templateIconMap[template.icon] ?? FileText
            return (
              <div
                key={template.id}
                className="border rounded-lg p-4 bg-surface hover:border-foreground/20 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium">{template.name}</h3>
                    <span className="text-[10px] text-muted-foreground">{template.category}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
                  {template.description}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {template.nodes.length} nodes
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleUseTemplate(template)}
                  >
                    Use Template
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}