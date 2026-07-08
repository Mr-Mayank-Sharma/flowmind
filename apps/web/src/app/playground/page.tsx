"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Search, Play, Code, Server, Database, Bot, Globe, Shield, Cpu, Webhook, AlertTriangle, CheckCircle, Loader2, Copy, Terminal, ArrowRight, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"

interface Endpoint {
  id: string
  method: "GET" | "POST" | "PUT" | "DELETE"
  path: string
  description: string
  category: string
  auth: boolean
}

const endpoints: Endpoint[] = [
  { id: "e1", method: "GET", path: "/api/health", description: "Health check endpoint", category: "System", auth: false },
  { id: "e2", method: "POST", path: "/api/auth/login", description: "Authenticate user", category: "Auth", auth: false },
  { id: "e3", method: "POST", path: "/api/auth/register", description: "Create new account", category: "Auth", auth: false },
  { id: "e4", method: "GET", path: "/api/auth/me", description: "Get current user profile", category: "Auth", auth: true },
  { id: "e5", method: "POST", path: "/api/chat/send", description: "Send message to agent", category: "Chat", auth: true },
  { id: "e6", method: "GET", path: "/api/chat/sessions", description: "List chat sessions", category: "Chat", auth: true },
  { id: "e7", method: "POST", path: "/api/pipelines/trigger", description: "Trigger a pipeline run", category: "Pipelines", auth: true },
  { id: "e8", method: "GET", path: "/api/pipelines/list", description: "List all pipelines", category: "Pipelines", auth: true },
  { id: "e9", method: "GET", path: "/api/marketplace/list", description: "List marketplace flows", category: "Marketplace", auth: false },
  { id: "e10", method: "GET", path: "/api/frameworks/list", description: "List AI frameworks", category: "System", auth: true },
  { id: "e11", method: "GET", path: "/api/system/metrics", description: "Get system metrics", category: "System", auth: true },
  { id: "e12", method: "POST", path: "/api/agents/deploy", description: "Deploy a new agent", category: "Agents", auth: true },
]

const methodColors: Record<string, string> = {
  GET: "text-emerald-400 bg-emerald-500/10",
  POST: "text-blue-400 bg-blue-500/10",
  PUT: "text-amber-400 bg-amber-500/10",
  DELETE: "text-red-400 bg-red-500/10",
}

export default function PlaygroundPage() {
  const [search, setSearch] = useState("")
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>("e4")
  const [requestBody, setRequestBody] = useState("{\n  \"email\": \"admin@flowmind.ai\",\n  \"password\": \"admin123\"\n}")
  const [response, setResponse] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showResponse, setShowResponse] = useState(false)

  const currentEndpoint = endpoints.find((e) => e.id === selectedEndpoint)

  const filtered = endpoints.filter((e) => {
    if (search && !e.path.toLowerCase().includes(search.toLowerCase()) && !e.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const groupedEndpoints = filtered.reduce<Record<string, Endpoint[]>>((acc, ep) => {
    const group = acc[ep.category] ?? []
    group.push(ep)
    acc[ep.category] = group
    return acc
  }, {})

  const handleSend = async () => {
    if (!currentEndpoint) return
    setLoading(true)
    setShowResponse(true)
    setResponse(null)
    try {
      const ep = currentEndpoint
      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}${ep.path.replace("/api", "/trpc")}`
      const result = await api.playground.execute({
        method: ep.method,
        url,
        body: ep.method !== "GET" ? requestBody : undefined,
      })
      setResponse(JSON.stringify(result, null, 2))
    } catch (e: any) {
      setResponse(JSON.stringify({ error: e.message || "Request failed" }, null, 2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-surface">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">API Playground</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Explore and test API endpoints interactively</p>
            </div>
            <Badge variant="secondary" className="text-xs">{endpoints.length} endpoints</Badge>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-9.5rem)]">
        {/* Sidebar */}
        <div className="w-64 shrink-0 border-r border-border/50 bg-surface/50 overflow-y-auto">
          <div className="p-2">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input placeholder="Search endpoints..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 text-xs pl-7" />
            </div>
            {Object.entries(groupedEndpoints).map(([category, eps]) => (
              <div key={category} className="mb-2">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1">{category}</div>
                {eps.map((ep) => (
                  <button key={ep.id} onClick={() => { setSelectedEndpoint(ep.id); setShowResponse(false) }}
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded transition-colors text-left",
                      selectedEndpoint === ep.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <span className={cn("text-[9px] font-mono font-bold px-1 py-0.5 rounded", methodColors[ep.method])}>{ep.method}</span>
                    <span className="truncate font-mono text-[11px]">{ep.path.split("/").pop()}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {currentEndpoint && (
            <>
              {/* Endpoint Header */}
              <div className="px-6 py-4 border-b border-border/30 bg-surface/30">
                <div className="flex items-center gap-3">
                  <span className={cn("text-xs font-mono font-bold px-2 py-0.5 rounded", methodColors[currentEndpoint.method])}>
                    {currentEndpoint.method}
                  </span>
                  <span className="text-sm font-mono">{currentEndpoint.path}</span>
                  <Badge className="text-[10px] ml-auto" variant={currentEndpoint.auth ? "secondary" : "outline"}>
                    {currentEndpoint.auth ? "Auth Required" : "Public"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{currentEndpoint.description}</p>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Request Builder */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Code className="h-4 w-4 text-muted-foreground" />
                    Request Body
                    <Badge variant="secondary" className="text-[10px] font-mono ml-auto">JSON</Badge>
                  </h3>
                  <textarea
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    className="w-full h-40 text-xs font-mono p-4 rounded-lg border border-border/50 bg-background/50 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    spellCheck={false}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleSend} disabled={loading}>
                      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      {loading ? "Sending..." : "Send Request"}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => {
                      if (!currentEndpoint) return
                      const curl = `curl -X ${currentEndpoint.method} "${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}${currentEndpoint.path}" ${currentEndpoint.method !== "GET" ? `-d '${requestBody}'` : ""} -H "Content-Type: application/json"`
                      navigator.clipboard.writeText(curl)
                    }}>
                      <Copy className="h-3.5 w-3.5" /> Copy cURL
                    </Button>
                  </div>
                </div>

                {/* Response */}
                {showResponse && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-muted-foreground" />
                        Response
                      </h3>
                      {!loading && response && (
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-400">Response</Badge>
                          <Copy className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => navigator.clipboard.writeText(response || "")} />
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background/80 overflow-hidden">
                      {loading ? (
                        <div className="flex items-center justify-center h-32 text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          Waiting for response...
                        </div>
                      ) : response ? (
                        <pre className="p-4 text-xs font-mono leading-5 overflow-x-auto text-foreground/80">{response}</pre>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
