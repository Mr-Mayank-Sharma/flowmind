"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Server,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  Wrench,
  Clock,
  Activity,
  ExternalLink,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/api"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

const statusColors: Record<string, "default" | "secondary" | "destructive"> = {
  connected: "default",
  configured: "secondary",
  expired: "destructive",
}

interface McpServer {
  id: string
  provider: string
  scope: string
  expiresAt: string | null
  updatedAt: string | null
  isActive: boolean
}

function deriveStatus(expiresAt: string | null): "connected" | "configured" | "expired" {
  if (!expiresAt) return "configured"
  return new Date(expiresAt).getTime() > Date.now() ? "connected" : "expired"
}

export default function MCPPage() {
  const [servers, setServers] = useState<McpServer[]>([])
  const [tools, setTools] = useState<{ name: string; category: string; description: string }[]>([])
  const [providers, setProviders] = useState<{ id: string; name: string; authUrl: string }[]>([])
  const [connecting, setConnecting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchServers = useCallback(async () => {
    try {
      const list = await api.mcp.list()
      setServers(list.map((s: any) => ({
        id: s.id,
        provider: s.provider,
        scope: s.scope ?? "",
        expiresAt: s.expiresAt ? new Date(s.expiresAt).toISOString() : null,
        updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
        isActive: s.isActive ?? true,
      })))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load servers")
    }
  }, [])

  useEffect(() => {
    fetchServers()
    api.mcp.tools().then(setTools).catch(() => {})
    api.mcp.providers().then(setProviders).catch(() => {})
  }, [fetchServers])

  const handleDelete = async (id: string) => {
    setDeleting(id)
    setError(null)
    try {
      await api.mcp.delete(id)
      setConfirmDelete(null)
      await fetchServers()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setDeleting(null)
    }
  }

  const handleConnect = async (provider: string) => {
    setConnecting(provider)
    setError(null)
    try {
      const { url } = await api.mcp.oauthInitiate({ provider })
      window.location.href = url
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start OAuth flow")
      setConnecting(null)
    }
  }

  const handleToggle = async (id: string) => {
    setError(null)
    try {
      await api.mcp.toggle(id)
      await fetchServers()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toggle failed")
    }
  }

  const connected = servers.filter((s) => deriveStatus(s.expiresAt) === "connected").length

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
          {providers.length > 0 && (
            <div className="flex items-center gap-2">
              {providers.map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  className="gap-2"
                  onClick={() => handleConnect(p.id)}
                  disabled={connecting !== null}
                >
                  <ExternalLink className="h-4 w-4" />
                  {connecting === p.id ? "Connecting..." : `Connect ${p.name}`}
                </Button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-8 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Server className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold font-mono">{servers.length}</p>
                <p className="text-xs text-muted-foreground">Total Connections</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Activity className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold font-mono">{connected}/{servers.length}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Wrench className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold font-mono">{tools.length}</p>
                <p className="text-xs text-muted-foreground">Available Tools</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="servers" className="mb-8">
          <TabsList className="mb-6">
            <TabsTrigger value="servers" className="gap-2">
              <Server className="h-4 w-4" />
              Connections
            </TabsTrigger>
            <TabsTrigger value="tools" className="gap-2">
              <Wrench className="h-4 w-4" />
              Tool Browser
            </TabsTrigger>
          </TabsList>

          <TabsContent value="servers">
            {servers.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No MCP connections yet. Connect a provider (GitHub, Slack, Google, Notion) to get started.
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {servers.map(server => {
                const status = deriveStatus(server.expiresAt)
                return (
                  <Card key={server.id} className="group hover:border-primary/40 hover:-translate-y-0.5 transition-all">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                            status === "connected" ? "bg-emerald-500/10" :
                            status === "expired" ? "bg-destructive/10" : "bg-muted"
                          }`}>
                            <Server className={`h-4 w-4 ${
                              status === "connected" ? "text-emerald-500" :
                              status === "expired" ? "text-destructive" : "text-muted-foreground"
                            }`} />
                          </div>
                          <div>
                            <CardTitle className="text-sm capitalize">{server.provider}</CardTitle>
                            <CardDescription className="text-xs mt-0.5">{server.scope || "OAuth connection"}</CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={statusColors[status]} className="text-[10px] h-5 gap-1">
                          {status === "connected" ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                          {status}
                        </Badge>
                        <Badge variant={server.isActive ? "default" : "secondary"} className="text-[10px] h-5 gap-1">
                          {server.isActive ? "enabled" : "disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {server.updatedAt ? new Date(server.updatedAt).toLocaleDateString() : "never"}
                        </span>
                      </div>
                      <div className="mt-3 pt-2 border-t border-border flex items-center justify-end gap-1 opacity-100 transition-opacity">
                        <button
                          onClick={() => handleToggle(server.id)}
                          className="px-2 py-1 rounded text-xs hover:bg-accent/50 transition-colors"
                          title={server.isActive ? "Disable connection" : "Enable connection"}
                        >
                          {server.isActive ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(server.id)}
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
                {tools.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">No tools available.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {tools.map(tool => (
                      <div key={tool.name} className="flex items-start justify-between px-4 py-3 hover:bg-accent/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono text-primary">{tool.name}</code>
                            <Badge variant="outline" className="text-[10px] h-4">{tool.category}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Remove connection"
        description={`Disconnect ${confirmDelete}? The stored token will be deleted.`}
        confirmLabel="Remove"
        destructive
        busy={deleting !== null}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
