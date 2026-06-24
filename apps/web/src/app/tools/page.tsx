"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  Search, Wrench, Code, FileCode, Globe, Database, GitBranch, Mail, MessageSquare, Image,
  Terminal, Webhook, Link, Lock, Unlock, Play, CheckCircle, XCircle, ExternalLink, Sliders
} from "lucide-react"

interface Tool {
  id: string
  name: string
  description: string
  category: "filesystem" | "code" | "web" | "database" | "communication" | "ai" | "integration"
  enabled: boolean
  auth: boolean
  usage: number
  lastUsed: string
  icon: any
}

const initialTools: Tool[] = [
  { id: "t1", name: "Read File", description: "Read contents of a file from the filesystem", category: "filesystem", enabled: true, auth: false, usage: 1245, lastUsed: "2 min ago", icon: FileCode },
  { id: "t2", name: "Write File", description: "Write content to a file on the filesystem", category: "filesystem", enabled: true, auth: false, usage: 892, lastUsed: "5 min ago", icon: FileCode },
  { id: "t3", name: "Search Files", description: "Search for files matching a pattern", category: "filesystem", enabled: true, auth: false, usage: 567, lastUsed: "15 min ago", icon: Search },
  { id: "t4", name: "Execute Code", description: "Run code in a sandboxed environment (Python, JS, Go)", category: "code", enabled: true, auth: true, usage: 2341, lastUsed: "1 min ago", icon: Terminal },
  { id: "t5", name: "Lint & Format", description: "Lint and auto-format source code files", category: "code", enabled: true, auth: false, usage: 678, lastUsed: "1 hour ago", icon: Code },
  { id: "t6", name: "Git Diff", description: "Show git diff for staged/unstaged changes", category: "code", enabled: true, auth: false, usage: 456, lastUsed: "3 hours ago", icon: GitBranch },
  { id: "t7", name: "Git Commit", description: "Create a git commit with a message", category: "code", enabled: true, auth: true, usage: 234, lastUsed: "1 day ago", icon: GitBranch },
  { id: "t8", name: "Web Fetch", description: "Fetch content from a URL", category: "web", enabled: true, auth: false, usage: 3456, lastUsed: "30 sec ago", icon: Globe },
  { id: "t9", name: "Web Search", description: "Search the web for information", category: "web", enabled: true, auth: true, usage: 2890, lastUsed: "10 sec ago", icon: Search },
  { id: "t10", name: "Database Query", description: "Execute SQL queries against connected databases", category: "database", enabled: false, auth: true, usage: 123, lastUsed: "1 week ago", icon: Database },
  { id: "t11", name: "Send Email", description: "Send an email via SMTP", category: "communication", enabled: true, auth: true, usage: 567, lastUsed: "2 hours ago", icon: Mail },
  { id: "t12", name: "Slack Message", description: "Send a message to a Slack channel", category: "communication", enabled: false, auth: true, usage: 89, lastUsed: "2 weeks ago", icon: MessageSquare },
  { id: "t13", name: "Image Generation", description: "Generate images using Stable Diffusion", category: "ai", enabled: true, auth: false, usage: 456, lastUsed: "10 min ago", icon: Image },
  { id: "t14", name: "Webhook", description: "Trigger a webhook URL", category: "integration", enabled: true, auth: true, usage: 234, lastUsed: "1 hour ago", icon: Webhook },
]

const categoryIcons: Record<string, any> = {
  filesystem: FileCode, code: Code, web: Globe, database: Database,
  communication: MessageSquare, ai: Image, integration: Link,
}

export default function ToolsPage() {
  const [tools, setTools] = useState(initialTools)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string>("All")
  const [selectedTool, setSelectedTool] = useState<string | null>(null)

  const categories = ["All", "filesystem", "code", "web", "database", "communication", "ai", "integration"] as const

  const filtered = tools.filter((t) => {
    if (category !== "All" && t.category !== category) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const toggleTool = (id: string) => {
    setTools((prev) => prev.map((t) => t.id === id ? { ...t, enabled: !t.enabled } : t))
  }

  const currentTool = selectedTool ? tools.find((t) => t.id === selectedTool) : null

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-surface">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Tool Registry</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage tools available to AI agents and pipelines
              </p>
            </div>
            <Badge variant="secondary" className="text-xs gap-1">
              <Wrench className="h-3 w-3" />
              {tools.filter((t) => t.enabled).length}/{tools.length} enabled
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search tools..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
            </div>
            <div className="flex items-center gap-1">
              {categories.map((cat) => (
                <button key={cat} onClick={() => setCategory(cat)}
                  className={cn("px-2 py-1.5 text-[10px] rounded-md transition-colors capitalize",
                    category === cat ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >{cat === "All" ? "All" : cat}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={cn(!selectedTool && "xl:col-span-3")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((tool) => {
              const Icon = tool.icon
              return (
                <div key={tool.id}
                  className={cn(
                    "rounded-lg border p-4 transition-all cursor-pointer",
                    tool.enabled ? "border-border/50 bg-surface card-hover" : "border-border/30 bg-muted/30 opacity-60",
                    selectedTool === tool.id && "ring-1 ring-primary/30"
                  )}
                  onClick={() => setSelectedTool(selectedTool === tool.id ? null : tool.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", tool.enabled ? "bg-primary/10" : "bg-muted")}>
                        <Icon className={cn("h-4 w-4", tool.enabled ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">{tool.name}</h3>
                        <p className="text-xs text-muted-foreground">{tool.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <Badge className="text-[10px] capitalize bg-muted text-muted-foreground">{tool.category}</Badge>
                    {tool.auth && <span className="flex items-center gap-0.5"><Lock className="h-3 w-3" /> Auth</span>}
                    <span>{tool.usage} uses</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleTool(tool.id) }}
                      className={cn("ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors border",
                        tool.enabled ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground border-border"
                      )}
                    >
                      {tool.enabled ? <Unlock className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                      {tool.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {selectedTool && currentTool && (
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  {(() => { const I = currentTool.icon; return <I className="h-5 w-5 text-primary" /> })()}
                </div>
                <div>
                  <h3 className="font-semibold">{currentTool.name}</h3>
                  <p className="text-xs text-muted-foreground">{currentTool.description}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  { label: "Category", value: currentTool.category },
                  { label: "Total Usage", value: String(currentTool.usage) },
                  { label: "Last Used", value: currentTool.lastUsed },
                  { label: "Requires Auth", value: currentTool.auth ? "Yes" : "No" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-1">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className="text-xs font-medium capitalize">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
                <Button size="sm" className={cn("h-7 text-xs gap-1.5", currentTool.enabled ? "" : "")}
                  onClick={() => toggleTool(currentTool.id)}>
                  {currentTool.enabled ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  {currentTool.enabled ? "Disable" : "Enable"}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                  <Play className="h-3 w-3" /> Test
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                  <Sliders className="h-3 w-3" /> Configure
                </Button>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3">Quick Test</h3>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground block">Input Parameters (JSON)</label>
                <textarea className="w-full h-24 text-xs font-mono p-3 rounded-lg border border-border/50 bg-background/50 resize-none" placeholder='{"path": "/home/flowmind/test.txt"}' />
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full">
                  <Play className="h-3 w-3" /> Execute Test
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
