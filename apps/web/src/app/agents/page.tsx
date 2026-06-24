"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Search, Bot, Plus, Play, Square, Settings, MessageSquare, BarChart3, Cpu, Trash2, ExternalLink, Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface Agent {
  id: string
  name: string
  description: string
  model: string
  status: "running" | "stopped" | "error" | "deploying"
  tools: number
  memory: string
  temperature: number
  maxTokens: number
  lastActive: string
  messages: number
  successRate: number
}

const initialAgents: Agent[] = [
  { id: "a1", name: "Customer Support Agent", description: "Handles customer inquiries, complaints, and returns", model: "mistral:7b", status: "running", tools: 5, memory: "2.1 GB", temperature: 0.3, maxTokens: 2048, lastActive: "2 min ago", messages: 1247, successRate: 94 },
  { id: "a2", name: "Code Reviewer", description: "Reviews pull requests and suggests improvements", model: "codellama:7b", status: "running", tools: 4, memory: "1.8 GB", temperature: 0.2, maxTokens: 4096, lastActive: "5 min ago", messages: 856, successRate: 91 },
  { id: "a3", name: "Data Analyst", description: "Analyzes datasets and generates reports", model: "hermes-2-pro", status: "stopped", tools: 7, memory: "3.2 GB", temperature: 0.4, maxTokens: 8192, lastActive: "1 hour ago", messages: 432, successRate: 88 },
  { id: "a4", name: "Sales Assistant", description: "Qualifies leads and schedules demos", model: "phi-3-mini", status: "running", tools: 3, memory: "0.9 GB", temperature: 0.5, maxTokens: 1024, lastActive: "Just now", messages: 2134, successRate: 96 },
  { id: "a5", name: "Content Writer", description: "Creates blog posts, social media content, and copy", model: "mixtral:8x7b", status: "error", tools: 2, memory: "4.5 GB", temperature: 0.7, maxTokens: 4096, lastActive: "3 hours ago", messages: 678, successRate: 72 },
  { id: "a6", name: "DevOps Bot", description: "Monitors infrastructure and manages deployments", model: "hermes-2-dpo", status: "running", tools: 8, memory: "1.5 GB", temperature: 0.1, maxTokens: 2048, lastActive: "30 sec ago", messages: 3456, successRate: 99 },
]

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  running: { label: "Running", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-500" },
  stopped: { label: "Stopped", color: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
  error: { label: "Error", color: "bg-red-500/10 text-red-400 border-red-500/20", dot: "bg-red-500" },
  deploying: { label: "Deploying", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", dot: "bg-blue-500" },
}

export default function AgentsPage() {
  const [agents, setAgents] = useState(initialAgents)
  const [search, setSearch] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [newAgent, setNewAgent] = useState({ name: "", description: "", model: "mistral:7b", temperature: 0.3, maxTokens: 2048 })

  const filtered = agents.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))

  const handleToggleAgent = (id: string) => {
    setAgents((prev) => prev.map((a) => {
      if (a.id !== id) return a
      const newStatus = a.status === "running" ? "stopped" : "deploying" as const
      return { ...a, status: newStatus }
    }))
    setTimeout(() => {
      setAgents((prev) => prev.map((a) => {
        if (a.id !== id || a.status !== "deploying") return a
        return { ...a, status: "running" as const }
      }))
    }, 2000)
  }

  const handleCreateAgent = () => {
    const id = `a${Date.now()}`
    setAgents((prev) => [{
      id, name: newAgent.name, description: newAgent.description, model: newAgent.model,
      status: "deploying" as const, tools: 0, memory: "0.5 GB", temperature: newAgent.temperature,
      maxTokens: newAgent.maxTokens, lastActive: "Just now", messages: 0, successRate: 100,
    }, ...prev])
    setTimeout(() => {
      setAgents((prev) => prev.map((a) => a.id === id ? { ...a, status: "running" as const } : a))
    }, 2000)
    setShowCreate(false)
    setNewAgent({ name: "", description: "", model: "mistral:7b", temperature: 0.3, maxTokens: 2048 })
  }

  const selectedAgentData = selectedAgent ? agents.find((a) => a.id === selectedAgent) : null

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-surface">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Agent Workspace</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Create, deploy, and monitor AI agents
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{agents.filter((a) => a.status === "running").length}/{agents.length} active</Badge>
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowCreate(!showCreate)}>
                <Plus className="h-3.5 w-3.5" />
                New Agent
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search agents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={cn("space-y-3", selectedAgent && "xl:col-span-2")}>
          {showCreate && (
            <Card className="p-5 border-primary/30 bg-primary/[0.02]">
              <h3 className="text-sm font-semibold mb-4">Create New Agent</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                  <Input value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} placeholder="My Agent" className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                  <Input value={newAgent.description} onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })} placeholder="What does this agent do?" className="h-8 text-sm" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Model</label>
                    <select value={newAgent.model} onChange={(e) => setNewAgent({ ...newAgent, model: e.target.value })} className="h-8 text-sm w-full rounded-md border border-input bg-surface px-3">
                      <option>mistral:7b</option>
                      <option>llama3:8b</option>
                      <option>codellama:7b</option>
                      <option>hermes-2-pro</option>
                      <option>phi-3-mini</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Temperature</label>
                    <input type="number" min="0" max="2" step="0.1" value={newAgent.temperature} onChange={(e) => setNewAgent({ ...newAgent, temperature: parseFloat(e.target.value) })}
                      className="h-8 text-sm w-full rounded-md border border-input bg-surface px-3" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Max Tokens</label>
                    <input type="number" min="256" max="32768" step="256" value={newAgent.maxTokens} onChange={(e) => setNewAgent({ ...newAgent, maxTokens: parseInt(e.target.value) })}
                      className="h-8 text-sm w-full rounded-md border border-input bg-surface px-3" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button size="sm" className="h-8 text-xs" onClick={handleCreateAgent}>Create Agent</Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowCreate(false)}>Cancel</Button>
                </div>
              </div>
            </Card>
          )}

          {filtered.map((agent) => {
            const sc = statusConfig[agent.status] ?? { label: agent.status, color: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" }
            return (
              <div key={agent.id}
                className={cn(
                  "rounded-lg border border-border/50 bg-surface p-4 transition-all cursor-pointer card-hover",
                  selectedAgent === agent.id && "ring-1 ring-primary/30"
                )}
                onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", agent.status === "running" ? "bg-emerald-500/10" : agent.status === "error" ? "bg-red-500/10" : "bg-muted")}>
                      <Bot className={cn("h-4 w-4", agent.status === "running" ? "text-emerald-400" : agent.status === "error" ? "text-red-400" : "text-muted-foreground")} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{agent.name}</h3>
                      <p className="text-xs text-muted-foreground">{agent.description}</p>
                    </div>
                  </div>
                  <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium", sc.color)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot, agent.status === "running" && "animate-pulse")} />
                    {sc.label}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span>{agent.model}</span>
                  <span>{agent.tools} tools</span>
                  <span>{agent.messages} msgs</span>
                  <span className={cn(agent.successRate >= 90 ? "text-emerald-400" : agent.successRate >= 75 ? "text-amber-400" : "text-red-400")}>
                    {agent.successRate}% success
                  </span>
                  <span className="ml-auto">{agent.lastActive}</span>
                </div>
              </div>
            )
          })}
        </div>

        {selectedAgent && selectedAgentData && (
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                {selectedAgentData.name} — Details
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { label: "Model", value: selectedAgentData.model },
                  { label: "Temperature", value: String(selectedAgentData.temperature) },
                  { label: "Max Tokens", value: String(selectedAgentData.maxTokens) },
                  { label: "Memory Usage", value: selectedAgentData.memory },
                  { label: "Tools Available", value: String(selectedAgentData.tools) },
                  { label: "Messages Processed", value: String(selectedAgentData.messages) },
                  { label: "Success Rate", value: `${selectedAgentData.successRate}%` },
                  { label: "Last Active", value: selectedAgentData.lastActive },
                ].map((item) => (
                  <div key={item.label}>
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <p className="font-mono text-sm mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
                <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => handleToggleAgent(selectedAgentData.id)}>
                  {selectedAgentData.status === "running" ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  {selectedAgentData.status === "running" ? "Stop" : "Start"}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                  <MessageSquare className="h-3 w-3" />
                  Chat
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                  <BarChart3 className="h-3 w-3" />
                  Metrics
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 text-red-400 hover:text-red-400 ml-auto">
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                Resource Usage
              </h3>
              <div className="space-y-3">
                {[
                  { label: "CPU", value: 34, color: "bg-blue-500" },
                  { label: "RAM", value: 56, color: "bg-emerald-500" },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{m.label}</span>
                      <span className="font-mono">{m.value}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", m.color)} style={{ width: `${m.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3">Recent Activity</h3>
              <div className="space-y-2">
                {[
                  { type: "success" as const, msg: "Processed 15 support tickets", time: "2 min ago" },
                  { type: "info" as const, msg: "Context window at 72% capacity", time: "15 min ago" },
                  { type: "warning" as const, msg: "Response time exceeded 3s threshold", time: "1 hour ago" },
                ].map((act, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    {act.type === "success" ? <CheckCircle className="h-3 w-3 text-emerald-400 mt-0.5" /> :
                     act.type === "warning" ? <AlertTriangle className="h-3 w-3 text-amber-400 mt-0.5" /> :
                     <Loader2 className="h-3 w-3 text-blue-400 mt-0.5 animate-spin-slow" />}
                    <span className="text-foreground/80">{act.msg}</span>
                    <span className="text-muted-foreground ml-auto shrink-0">{act.time}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
