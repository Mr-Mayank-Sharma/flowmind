"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { cn } from "@flowmind/ui"
import { ScrollArea } from "@flowmind/ui"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { api } from "@/lib/api"
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
  Search,
  X,
} from "lucide-react"

interface PaletteItem {
  type: string
  label: string
  icon: React.ElementType
  category: string
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
  { type: "openhumanMessage", label: "OpenHuman Message", icon: MessageSquare, category: "Actions" },
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
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories)
  )
  const [previousExpanded, setPreviousExpanded] = useState<Set<string>>(
    new Set(categories)
  )
  const [skillItems, setSkillItems] = useState<PaletteItem[]>([])
  const [skillsError, setSkillsError] = useState(false)

  const loadSkills = useCallback(async () => {
    try {
      const skills = await api.skills.list()
      setSkillItems(
        skills.map((s) => ({
          type: `skill.${s.name}`,
          label: s.name,
          icon: Puzzle,
          category: "Skills",
        }))
      )
      setSkillsError(false)
    } catch {
      setSkillsError(true)
    }
  }, [])

  useEffect(() => {
    loadSkills()
  }, [loadSkills])

  // Debounce search input by 150ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 150)
    return () => clearTimeout(timer)
  }, [search])

  const allItems = useMemo(() => [...paletteItems, ...skillItems], [skillItems])

  const filteredItems = useMemo(() => {
    if (!debouncedSearch.trim()) return allItems
    const q = debouncedSearch.toLowerCase()
    return allItems.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.type.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
    )
  }, [allItems, debouncedSearch])

  const isSearching = debouncedSearch.trim().length > 0

  // Categories that have matching items when searching
  const visibleCategories = useMemo(() => {
    if (!isSearching) return categories
    const matching = new Set(filteredItems.map((i) => i.category))
    return categories.filter((c) => matching.has(c))
  }, [isSearching, filteredItems])

  // Auto-expand matching categories when search is active
  useEffect(() => {
    if (isSearching) {
      const matching = new Set(filteredItems.map((i) => i.category))
      setExpandedCategories(matching)
    }
  }, [isSearching, filteredItems])

  // Save/restore expanded state when toggling search
  useEffect(() => {
    if (isSearching && previousExpanded.size === expandedCategories.size) {
      setPreviousExpanded(expandedCategories)
    }
  }, [isSearching, expandedCategories, previousExpanded])

  const handleClearSearch = () => {
    setSearch("")
    setDebouncedSearch("")
    // Restore previous expanded state
    setExpandedCategories(previousExpanded)
    searchInputRef.current?.focus()
  }

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
        <div className="px-2 py-1.5 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search nodes..."
              className="h-7 pl-7 pr-7 text-xs"
            />
            {search && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-accent rounded-sm transition-colors"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      )}
      {!collapsed && (
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isSearching && filteredItems.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No matching nodes"
                description="Try a different search term"
                className="py-8"
              />
            ) : (
              visibleCategories.map((category) => {
                const items = filteredItems.filter((i) => i.category === category)
                if (isSearching && items.length === 0) return null
                const CatIcon = categoryIcons[category]
                const isExpanded = expandedCategories.has(category)
                const isSkillsCategory = category === "Skills"
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
                      {isSkillsCategory && skillsError && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            loadSkills()
                          }}
                          className="text-[10px] text-red-500 hover:text-red-400 mr-1"
                          title="Failed to load skills. Click to retry"
                        >
                          retry
                        </button>
                      )}
                      {items.length > 0 && (
                        <span className="text-[10px] text-muted-foreground/60 mr-1">
                          {items.length}
                        </span>
                      )}
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
              })
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
