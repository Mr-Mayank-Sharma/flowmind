"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Badge, Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@flowmind/ui"
import { ArrowLeft, Plus, Trash2, RefreshCw, Server, Wifi, WifiOff, AlertTriangle } from "lucide-react"
import { api } from "@/lib/api"

interface Runtime {
  id: string
  name: string
  endpoint: string
  description: string
  version: string
  status: "online" | "offline" | "degraded"
  capabilities: Array<{ name: string; description?: string; supportedNodeTypes?: string[] }>
  registeredAt: string
  lastHealthCheck: string | null
  currentLoad: number
}

export default function RuntimesPage() {
  const [runtimes, setRuntimes] = useState<Runtime[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [form, setForm] = useState({ name: "", endpoint: "", description: "", version: "1.0.0" })
  const [registering, setRegistering] = useState(false)

  const fetchRuntimes = () => {
    api.runtime.list().then((data) => {
      setRuntimes(data as Runtime[] ?? [])
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }

  useEffect(() => { fetchRuntimes() }, [])

  const handleRegister = async () => {
    if (!form.name || !form.endpoint) return
    setRegistering(true)
    try {
      await api.runtime.register({
        name: form.name,
        endpoint: form.endpoint,
        description: form.description || undefined,
        version: form.version || undefined,
      })
      setForm({ name: "", endpoint: "", description: "", version: "1.0.0" })
      setShowRegister(false)
      fetchRuntimes()
    } catch (err) {
      console.error("Register failed:", err)
    } finally {
      setRegistering(false)
    }
  }

  const handleUnregister = async (id: string) => {
    try {
      await api.runtime.unregister(id)
      fetchRuntimes()
    } catch (err) {
      console.error("Unregister failed:", err)
    }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "online": return <Wifi className="h-4 w-4 text-green-500" />
      case "offline": return <WifiOff className="h-4 w-4 text-red-500" />
      case "degraded": return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default: return <Server className="h-4 w-4 text-muted-foreground" />
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "online": return "bg-green-500/10 text-green-500"
      case "offline": return "bg-red-500/10 text-red-500"
      case "degraded": return "bg-yellow-500/10 text-yellow-500"
      default: return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/settings" className="p-1 hover:bg-accent rounded-md transition-colors">
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Server className="h-6 w-6" />
                Agent Runtimes
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Register and manage external agent runtimes for task dispatch
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchRuntimes}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowRegister(!showRegister)}>
              <Plus className="h-4 w-4 mr-1" />
              Register Runtime
            </Button>
          </div>
        </div>

        {showRegister && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-sm">Register New Runtime</CardTitle>
              <CardDescription className="text-xs">
                Register an external agent runtime that accepts tasks via HTTP
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Python Agent Runtime"
                      className="w-full h-9 mt-1 px-3 rounded-md border bg-surface text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Endpoint URL</label>
                    <input
                      type="url"
                      value={form.endpoint}
                      onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                      placeholder="http://localhost:8001"
                      className="w-full h-9 mt-1 px-3 rounded-md border bg-surface text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Description</label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="What this runtime does"
                      className="w-full h-9 mt-1 px-3 rounded-md border bg-surface text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Version</label>
                    <input
                      type="text"
                      value={form.version}
                      onChange={(e) => setForm({ ...form, version: e.target.value })}
                      placeholder="1.0.0"
                      className="w-full h-9 mt-1 px-3 rounded-md border bg-surface text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowRegister(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleRegister} disabled={registering || !form.name || !form.endpoint}>
                    {registering ? "Registering..." : "Register"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!loaded ? (
          <div className="text-center py-16 text-muted-foreground">
            <Server className="h-12 w-12 mx-auto mb-4 opacity-30 animate-pulse" />
            <p className="text-sm">Loading runtimes...</p>
          </div>
        ) : runtimes.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Server className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-1">No runtimes registered</p>
            <p className="text-sm mb-4">Register an external agent runtime to enable task dispatch</p>
            <Button size="sm" onClick={() => setShowRegister(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Register Your First Runtime
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {runtimes.map((rt) => (
              <Card key={rt.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        {statusIcon(rt.status)}
                        {rt.name}
                        <Badge variant="outline" className="text-[9px] px-1 py-0">v{rt.version}</Badge>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${statusColor(rt.status)}`}>
                          {rt.status}
                        </span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {rt.description || "No description"}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                      onClick={() => handleUnregister(rt.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-mono bg-surface px-2 py-0.5 rounded">{rt.endpoint}</span>
                    {rt.capabilities.length > 0 && (
                      <span>{rt.capabilities.length} capability(ies)</span>
                    )}
                    <span>Load: {rt.currentLoad}</span>
                    {rt.lastHealthCheck && (
                      <span>Last check: {new Date(rt.lastHealthCheck).toLocaleTimeString()}</span>
                    )}
                  </div>
                  {rt.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {rt.capabilities.map((cap) => (
                        <Badge key={cap.name} variant="secondary" className="text-[9px]">
                          {cap.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
