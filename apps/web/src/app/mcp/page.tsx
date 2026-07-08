"use client"

import { useState, useEffect } from "react"
import {
  Server,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  Wrench,
  Clock,
  Activity,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/api"

const statusColors: Record<string, "default" | "secondary" | "destructive"> = { connected: "default", disconnected: "secondary", error: "destructive" }

const typeColors: Record<string, "default" | "secondary" | "outline"> = { sse: "default", streamable: "secondary", stdio: "outline" }

export default function MCPPage() {
  const [servers, setServers] = useState<any[]>([])
  const [tools, setTools] = useState<any[]>([])
  const [newUrl, setNewUrl] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState("")

  const fetchServers = async () => {
    try {
      const list = await api.mcp.list()
      setServers(list.map((s: any) => ({
        id: s.id,
        name: s.provider,
        description: s.scope ? `Scope: ${s.scope}` : "MCP Server",
        type: "sse",
        status: "disconnected",
        tools: [],
        lastActive: s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : "never",
        url: s.provider,
      })))
    } catch {}
  }

  useEffect(() => { fetchServers() }, [])

  const allTools = servers.flatMap((s: any) =>
    (s.tools || []).map((t: any) => ({ ...t, serverId: s.id, serverName: s.name, status: s.status }))
  )

  const handleDelete = async (id: string) => {
    try {
      await api.mcp.delete(id)
      fetchServers()
    } catch {}
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    try {
      await api.mcp.create({ provider: newName.trim(), accessToken: "manual", scope: "read" })
      setNewName("")
      setNewUrl("")
      setShowNew(false)
      fetchServers()
    } catch {}
  }

  const connected = servers.filter((s: any) => s.status === "connected").length
  const totalTools = servers.reduce((sum: number, s: any) => sum + s.tools.length, 0)

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
                <p className="text-2xl font-bold font-mono">{totalTools}</p>
                <p className="text-xs text-muted-foreground">Available Tools</p>
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
              Tool Browser
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
                  {allTools.map(tool => {
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
