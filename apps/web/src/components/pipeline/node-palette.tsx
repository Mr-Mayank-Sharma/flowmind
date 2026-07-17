"use client"

import { useState, useEffect } from "react"
import { cn } from "@flowmind/ui"
import { ScrollArea } from "@flowmind/ui"
import {
  Clock,
  Webhook,
  MessageSquare,
  MousePointerClick,
  Zap,
  FileText,
  Database,
  Mail,
  Globe,
  Image,
  Code,
  SplitSquareHorizontal,
  Merge,
  Repeat,
  GitBranch,
  ArrowRight,
  GripVertical,
  Puzzle,
} from "lucide-react"

interface PaletteItem {
  type: string
  label: string
  icon: React.ElementType
  category: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

function getToken(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|;\s*)flowmind_token=([^;]*)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

const paletteItems: PaletteItem[] = [
  { type: "cronTrigger", label: "Cron Trigger", icon: Clock, category: "Triggers" },
  { type: "webhookTrigger", label: "Webhook Trigger", icon: Webhook, category: "Triggers" },
  { type: "channelTrigger", label: "Channel Trigger", icon: MessageSquare, category: "Triggers" },
  { type: "manualTrigger", label: "Manual Trigger", icon: MousePointerClick, category: "Triggers" },
  { type: "aiAgent", label: "AI Agent", icon: Zap, category: "AI Nodes" },
  { type: "contentWriter", label: "Content Writer", icon: FileText, category: "AI Nodes" },
  { type: "dataExtractor", label: "Data Extractor", icon: Database, category: "AI Nodes" },
  { type: "classifier", label: "Classifier", icon: GitBranch, category: "AI Nodes" },
  { type: "summarizer", label: "Summarizer", icon: FileText, category: "AI Nodes" },
  { type: "webResearcher", label: "Web Researcher", icon: Globe, category: "AI Nodes" },
  { type: "imageGenerator", label: "Image Generator", icon: Image, category: "AI Nodes" },
  { type: "httpRequest", label: "HTTP Request", icon: Globe, category: "Actions" },
  { type: "databaseQuery", label: "Database Query", icon: Database, category: "Actions" },
  { type: "sendEmail", label: "Send Email", icon: Mail, category: "Actions" },
  { type: "sendMessage", label: "Send Message", icon: MessageSquare, category: "Actions" },
  { type: "codeExecute", label: "Code Execute", icon: Code, category: "Actions" },
  { type: "condition", label: "Condition", icon: GitBranch, category: "Flow Control" },
  { type: "switch", label: "Switch", icon: SplitSquareHorizontal, category: "Flow Control" },
  { type: "parallelFork", label: "Parallel Fork", icon: ArrowRight, category: "Flow Control" },
  { type: "merge", label: "Merge", icon: Merge, category: "Flow Control" },
  { type: "loop", label: "Loop", icon: Repeat, category: "Flow Control" },
  { type: "wait", label: "Wait", icon: Clock, category: "Flow Control" },
]

const categories = ["Triggers", "AI Nodes", "Actions", "Flow Control", "Integrations", "Skills"]

const nodeColors: Record<string, string> = {
  Triggers: "border-l-emerald-500",
  "AI Nodes": "border-l-violet-500",
  Actions: "border-l-blue-500",
  "Flow Control": "border-l-orange-500",
  Integrations: "border-l-gray-500",
  Skills: "border-l-pink-500",
}

const categoryIcons: Record<string, React.ElementType> = {
  Triggers: MousePointerClick,
  "AI Nodes": Zap,
  Actions: Code,
  "Flow Control": GitBranch,
  Integrations: Globe,
  Skills: Puzzle,
}

export function NodePalette() {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories)
  )
  const [skillItems, setSkillItems] = useState<PaletteItem[]>([])

  useEffect(() => {
    const token = getToken()
    fetch(`${API_URL}/trpc/skills.list?input=${JSON.stringify({})}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(5000),
    })
      .then((res) => res.json())
      .then((json: { result?: { data?: Array<{ name: string; description: string }> } }) => {
        const skills = json.result?.data ?? []
        setSkillItems(
          skills.map((s) => ({
            type: `skill.${s.name}`,
            label: s.name,
            icon: Puzzle,
            category: "Skills",
          }))
        )
      })
      .catch(() => {})
  }, [])

  const allItems = [...paletteItems, ...skillItems]

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData("application/reactflow-type", nodeType)
    event.dataTransfer.setData("application/reactflow-label", label)
    event.dataTransfer.effectAllowed = "move"
  }

  return (
    <div
      className={cn(
        "h-full bg-surface border-r border flex flex-col transition-all duration-200",
        collapsed ? "w-12" : "w-60"
      )}
    >
      <div className="flex items-center justify-between px-3 h-10 border-b shrink-0">
        {!collapsed && (
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Nodes
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-accent rounded-md transition-colors"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      {!collapsed && (
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {categories.map((category) => {
              const items = allItems.filter((i) => i.category === category)
              const CatIcon = categoryIcons[category]
              const isExpanded = expandedCategories.has(category)
              return (
                <div key={category}>
                  <button
                    onClick={() => toggleCategory(category)}
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-accent transition-colors",
                      nodeColors[category]
                    )}
                  >
                    {CatIcon && <CatIcon className="h-3.5 w-3.5" />}
                    <span className="flex-1 text-left">{category}</span>
                    <span
                      className={cn(
                        "text-[10px] transition-transform",
                        isExpanded && "rotate-90"
                      )}
                    >
                      ›
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="ml-1 space-y-0.5 mt-0.5">
                      {items.map((item) => {
                        const Icon = item.icon
                        return (
                          <div
                            key={item.type}
                            draggable
                            onDragStart={(e) => onDragStart(e, item.type, item.label)}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors group"
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0 group-hover:text-foreground transition-colors" />
                            <span>{item.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
