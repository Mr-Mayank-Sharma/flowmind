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
} from "lucide-react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"

interface Template {
  id: string
  name: string
  description: string
  icon: LucideIcon
  category: string
  nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }>
  edges: Array<{ id: string; source: string; target: string }>
}

const templates: Template[] = [
  {
    id: "email-automation",
    name: "Email Automation",
    description: "Trigger on schedule, generate content with AI, and send via email",
    icon: Mail,
    category: "Communication",
    nodes: [
      { id: "1", type: "cronTrigger", position: { x: 50, y: 200 }, data: { label: "Daily Schedule", cron: "0 9 * * *" } },
      { id: "2", type: "contentWriter", position: { x: 300, y: 200 }, data: { label: "Write Email", prompt: "Write a professional daily update email" } },
      { id: "3", type: "sendEmail", position: { x: 550, y: 200 }, data: { label: "Send Email", to: "", subject: "Daily Update" } },
    ],
    edges: [
      { id: "e1-2", source: "1", target: "2" },
      { id: "e2-3", source: "2", target: "3" },
    ],
  },
  {
    id: "web-research",
    name: "Web Research Pipeline",
    description: "Research a topic, summarize findings, and save to database",
    icon: Globe,
    category: "Research",
    nodes: [
      { id: "1", type: "manualTrigger", position: { x: 50, y: 200 }, data: { label: "Start Research" } },
      { id: "2", type: "webResearcher", position: { x: 300, y: 200 }, data: { label: "Research Topic", topic: "" } },
      { id: "3", type: "summarizer", position: { x: 550, y: 200 }, data: { label: "Summarize" } },
      { id: "4", type: "databaseQuery", position: { x: 800, y: 200 }, data: { label: "Save Results", query: "INSERT INTO research ..." } },
    ],
    edges: [
      { id: "e1-2", source: "1", target: "2" },
      { id: "e2-3", source: "2", target: "3" },
      { id: "e3-4", source: "3", target: "4" },
    ],
  },
  {
    id: "ai-content-factory",
    name: "AI Content Factory",
    description: "Generate content, classify it, and branch based on type",
    icon: FileText,
    category: "Content",
    nodes: [
      { id: "1", type: "manualTrigger", position: { x: 50, y: 200 }, data: { label: "Generate Content" } },
      { id: "2", type: "contentWriter", position: { x: 300, y: 200 }, data: { label: "Write Content", prompt: "" } },
      { id: "3", type: "classifier", position: { x: 550, y: 200 }, data: { label: "Classify" } },
      { id: "4", type: "condition", position: { x: 800, y: 200 }, data: { label: "Route by Type", condition: "type === 'blog'" } },
    ],
    edges: [
      { id: "e1-2", source: "1", target: "2" },
      { id: "e2-3", source: "2", target: "3" },
      { id: "e3-4", source: "3", target: "4" },
    ],
  },
  {
    id: "data-pipeline",
    name: "Data Processing Pipeline",
    description: "Extract data from API, transform with code, and store in database",
    icon: Database,
    category: "Data",
    nodes: [
      { id: "1", type: "webhookTrigger", position: { x: 50, y: 200 }, data: { label: "Webhook" } },
      { id: "2", type: "httpRequest", position: { x: 300, y: 200 }, data: { label: "Fetch Data", method: "GET", url: "" } },
      { id: "3", type: "dataExtractor", position: { x: 550, y: 200 }, data: { label: "Extract Fields" } },
      { id: "4", type: "databaseQuery", position: { x: 800, y: 200 }, data: { label: "Store Data", query: "" } },
    ],
    edges: [
      { id: "e1-2", source: "1", target: "2" },
      { id: "e2-3", source: "2", target: "3" },
      { id: "e3-4", source: "3", target: "4" },
    ],
  },
  {
    id: "branching-workflow",
    name: "Branching Workflow",
    description: "Classify input and route to different processing branches",
    icon: GitBranch,
    category: "Flow Control",
    nodes: [
      { id: "1", type: "channelTrigger", position: { x: 50, y: 200 }, data: { label: "Incoming Message" } },
      { id: "2", type: "classifier", position: { x: 300, y: 200 }, data: { label: "Classify Intent" } },
      { id: "3", type: "switch", position: { x: 550, y: 200 }, data: { label: "Route", branches: ["support", "sales", "general"] } },
      { id: "4", type: "aiAgent", position: { x: 800, y: 100 }, data: { label: "Support Agent" } },
      { id: "5", type: "aiAgent", position: { x: 800, y: 300 }, data: { label: "Sales Agent" } },
    ],
    edges: [
      { id: "e1-2", source: "1", target: "2" },
      { id: "e2-3", source: "2", target: "3" },
      { id: "e3-4", source: "3", target: "4" },
      { id: "e3-5", source: "3", target: "5" },
    ],
  },
  {
    id: "parallel-processing",
    name: "Parallel Processing",
    description: "Fork into parallel tasks and merge results",
    icon: ArrowRight,
    category: "Flow Control",
    nodes: [
      { id: "1", type: "manualTrigger", position: { x: 50, y: 200 }, data: { label: "Start" } },
      { id: "2", type: "parallelFork", position: { x: 300, y: 200 }, data: { label: "Fork", branches: 2 } },
      { id: "3", type: "contentWriter", position: { x: 550, y: 100 }, data: { label: "Task A" } },
      { id: "4", type: "webResearcher", position: { x: 550, y: 300 }, data: { label: "Task B" } },
      { id: "5", type: "merge", position: { x: 800, y: 200 }, data: { label: "Merge" } },
    ],
    edges: [
      { id: "e1-2", source: "1", target: "2" },
      { id: "e2-3", source: "2", target: "3" },
      { id: "e2-4", source: "2", target: "4" },
      { id: "e3-5", source: "3", target: "5" },
      { id: "e4-5", source: "4", target: "5" },
    ],
  },
]

export default function TemplatesPage() {
  const router = useRouter()

  const handleUseTemplate = async (template: Template) => {
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
            const Icon = template.icon
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
