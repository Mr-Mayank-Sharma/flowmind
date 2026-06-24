"use client"

import { useState } from "react"
import {
  Server,
  Plus,
  Trash2,
  Plug,
  Wifi,
  WifiOff,
  Wrench,
  RefreshCw,
  Clock,
  Activity,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface MCPServer {
  id: string
  name: string
  description: string
  type: "stdio" | "sse" | "built-in"
  status: "connected" | "disconnected" | "error"
  tools: string[]
  lastActive: string
  command?: string
  url?: string
}

interface MCPWrench {
  name: string
  serverId: string
  serverName: string
  description: string
  inputSchema: string
}

const defaultServers: MCPServer[] = [
  { id: "s1", name: "Filesystem", description: "Read, write, and manage files", type: "built-in", status: "connected", tools: ["read_file", "write_file", "list_dir", "search_files"], lastActive: "just now", command: "built-in" },
  { id: "s2", name: "GitHub", description: "Repository management and code review", type: "sse", status: "connected", tools: ["get_repo", "list_issues", "create_pr", "review_code", "search_code"], lastActive: "2 min ago", url: "https://mcp.github.com/v1" },
  { id: "s3", name: "PostgreSQL", description: "Query and manage databases", type: "stdio", status: "connected", tools: ["query", "execute", "list_tables", "describe_table"], lastActive: "15 min ago", command: "npx mcp-postgres" },
  { id: "s4", name: "Slack", description: "Messaging and channel management", type: "sse", status: "connected", tools: ["send_message", "list_channels", "search_messages", "get_thread"], lastActive: "1 hour ago", url: "https://mcp.slack.com/v1" },
  { id: "s5", name: "Web Search", description: "Web search and content extraction", type: "built-in", status: "disconnected", tools: ["search", "fetch_url", "extract_text"], lastActive: "1 day ago" },
  { id: "s6", name: "Browser Automation", description: "Headless browser control", type: "stdio", status: "error", tools: ["navigate", "click", "type", "screenshot", "extract"], lastActive: "3 hours ago", command: "npx playwright-mcp" },
  { id: "s7", name: "Redis Cache", description: "In-memory data store operations", type: "stdio", status: "disconnected", tools: ["get", "set", "delete", "keys", "publish"], lastActive: "2 days ago", command: "npx mcp-redis" },
  { id: "s8", name: "Jira", description: "Issue tracking and project management", type: "sse", status: "connected", tools: ["get_issue", "create_issue", "search_issues", "list_projects"], lastActive: "30 min ago", url: "https://mcp.jira.com/v1" },
]

const defaultWrenchs: MCPWrench[] = [
  { name: "read_file", serverId: "s1", serverName: "Filesystem", description: "Read contents of a file at specified path", inputSchema: "{ path: string }" },
  { name: "write_file", serverId: "s1", serverName: "Filesystem", description: "Write content to a file", inputSchema: "{ path: string, content: string }" },
  { name: "list_dir", serverId: "s1", serverName: "Filesystem", description: "List directory contents", inputSchema: "{ path: string }" },
  { name: "get_repo", serverId: "s2", serverName: "GitHub", description: "Get repository details", inputSchema: "{ owner: string, repo: string }" },
  { name: "create_pr", serverId: "s2", serverName: "GitHub", description: "Create a pull request", inputSchema: "{ owner: string, repo: string, title: string, body: string, head: string, base: string }" },
  { name: "query", serverId: "s3", serverName: "PostgreSQL", description: "Execute SQL query", inputSchema: "{ query: string }" },
  { name: "send_message", serverId: "s4", serverName: "Slack", description: "Send message to channel", inputSchema: "{ channel: string, text: string }" },
  { name: "search", serverId: "s5", serverName: "Web Search", description: "Search the web", inputSchema: "{ query: string }" },
  { name: "navigate", serverId: "s6", serverName: "Browser Automation", description: "Navigate to URL", inputSchema: "{ url: string }" },
  { name: "get", serverId: "s7", serverName: "Redis Cache", description: "Get value by key", inputSchema: "{ key: string }" },
  { name: "get_issue", serverId: "s8", serverName: "Jira", description: "Get issue details", inputSchema: "{ issueKey: string }" },
]

// status icons removed - rendered inline below
const statusColors: Record<string, "default" | "secondary" | "destructive"> = { connected: "default", disconnected: "secondary", error: "destructive" }
const typeColors: Record<string, "default" | "secondary" | "outline"> = { stdio: "secondary", sse: "default", "built-in": "outline" }

export default function MCPPage() {
  const [servers, setServers] = useState(defaultServers)
  const [tools] = useState(defaultWrenchs)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState("")
  const [newUrl, setNewUrl] = useState("")

  const handleDelete = (id: string) => {
    setServers(prev => prev.filter(s => s.id !== id))
  }

  const handleAdd = () => {
    if (!newName.trim()) return
    const id = "s" + Date.now()
    const newServer: MCPServer = {
      id,
      name: newName.trim(),
      description: "Custom MCP server connection",
      type: newUrl ? "sse" : "built-in",
      status: "disconnected",
      tools: [],
      lastActive: "never",
      url: newUrl || undefined,
    }
    setServers(prev => [newServer, ...prev])
    setNewName("")
    setNewUrl("")
    setShowNew(false)
  }

  const connected = servers.filter(s => s.status === "connected").length
  const totalWrenchs = servers.reduce((sum, s) => sum + s.tools.length, 0)

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">MCP Hub</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Model Context Protocol server registry and tools
            </p>
          </div>
          <Button onClick={() => setShowNew(!showNew)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Server
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Server className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold font-mono">{servers.length}</p>
                <p className="text-xs text-muted-foreground">Total Servers</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Activity className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold font-mono">{connected}/{servers.length}</p>
                <p className="text-xs text-muted-foreground">Connected</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Wrench className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold font-mono">{totalWrenchs}</p>
                <p className="text-xs text-muted-foreground">Available Wrenchs</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="servers" className="mb-8">
          <TabsList className="mb-6">
            <TabsTrigger value="servers" className="gap-2">
              <Server className="h-4 w-4" />
              Servers
            </TabsTrigger>
            <TabsTrigger value="tools" className="gap-2">
              <Wrench className="h-4 w-4" />
              Wrench Browser
            </TabsTrigger>
          </TabsList>

          <TabsContent value="servers">
            {showNew && (
              <Card className="mb-6 border-primary/30">
                <CardHeader>
                  <CardTitle className="text-base">Add Server</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Name</label>
                      <Input placeholder="e.g. My Database" value={newName} onChange={e => setNewName(e.target.value)} />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">URL (optional)</label>
                      <Input placeholder="https://mcp.example.com/v1" value={newUrl} onChange={e => setNewUrl(e.target.value)} />
                    </div>
                    <Button onClick={handleAdd} size="sm">Add</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {servers.map(server => {
                return (
                  <Card key={server.id} className="group hover:border-primary/40 hover:-translate-y-0.5 transition-all">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                            server.status === "connected" ? "bg-emerald-500/10" :
                            server.status === "error" ? "bg-destructive/10" : "bg-muted"
                          }`}>
                            <Server className={`h-4 w-4 ${
                              server.status === "connected" ? "text-emerald-500" :
                              server.status === "error" ? "text-destructive" : "text-muted-foreground"
                            }`} />
                          </div>
                          <div>
                            <CardTitle className="text-sm">{server.name}</CardTitle>
                            <CardDescription className="text-xs mt-0.5">{server.description}</CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={statusColors[server.status]} className="text-[10px] h-5 gap-1">
                          {server.status === "connected" ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                          {server.status}
                        </Badge>
                        <Badge variant={typeColors[server.type]} className="text-[10px] h-5">
                          {server.type}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Wrench className="h-3 w-3" />
                          {server.tools.length} tools
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {server.lastActive}
                        </span>
                      </div>
                      {server.url && (
                        <p className="text-[10px] font-mono text-muted-foreground truncate mt-1.5">{server.url}</p>
                      )}
                      {server.command && (
                        <p className="text-[10px] font-mono text-muted-foreground truncate mt-1.5">{server.command}</p>
                      )}
                      <div className="mt-3 pt-2 border-t border-border flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDelete(server.id)}
                          className="p-1 rounded hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="tools">
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {tools.map(tool => {
                    const server = servers.find(s => s.id === tool.serverId)
                    return (
                      <div key={tool.name} className="flex items-start justify-between px-4 py-3 hover:bg-accent/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono text-primary">{tool.name}</code>
                            <Badge variant="outline" className="text-[10px] h-4">{server?.name || tool.serverName}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
                          <code className="text-[10px] font-mono text-muted-foreground block mt-1">
                            {tool.inputSchema}
                          </code>
                        </div>
                        <Badge variant={server?.status === "connected" ? "default" : "secondary"} className="text-[10px] h-5 shrink-0 ml-4">
                          {server?.status || "unknown"}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
