"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Plus, RefreshCw, Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import { useQuery } from "@/hooks/use-query"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ui/error-state"

export function LocalModelsTab() {
  const [pulling, setPulling] = useState(false)
  const [pullName, setPullName] = useState("")
  const [showPullInput, setShowPullInput] = useState(false)
  const [health, setHealth] = useState<{ online: boolean; status: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const { data: modelsList = [], loading: modelsLoading, error: modelsError, refetch: refetchModels } = useQuery(
    "settings:models",
    () => api.models.list(),
  )

  const fetchHealth = useCallback(async () => {
    try {
      setHealth(await api.models.getRuntimeHealth())
    } catch {
      setHealth({ online: false, status: "unreachable" })
    }
  }, [])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  const handlePullModel = async () => {
    if (!pullName.trim()) return
    setPulling(true)
    setMessage(null)
    try {
      await api.models.pullModel(pullName.trim())
      setPullName("")
      setShowPullInput(false)
      setMessage({ type: "success", text: `Model "${pullName.trim()}" pulled successfully` })
      refetchModels()
    } catch (e: any) {
      setMessage({ type: "error", text: e?.message || "Pull failed" })
    } finally {
      setPulling(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setMessage(null)
    try {
      const h = await api.models.getRuntimeHealth()
      setHealth(h)
      setMessage({ type: h.online ? "success" : "error", text: h.online ? "Connection OK" : "Runtime offline" })
    } catch (e: any) {
      setMessage({ type: "error", text: `Connection failed: ${e?.message}` })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Ollama Connection</CardTitle>
          <CardDescription>Connect to your local Ollama instance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-lg border bg-surface">
            <div className={`h-3 w-3 rounded-full ${health ? (health.online ? "bg-green-500 animate-pulse" : "bg-red-500") : "bg-muted-foreground"}`} />
            <div className="flex-1">
              <p className="text-sm font-medium">{health ? (health.online ? "Connected to Ollama" : "Ollama unreachable") : "Checking connection..."}</p>
              <p className="text-xs text-muted-foreground">http://localhost:11434</p>
            </div>
            <Badge variant={health?.online ? "default" : "secondary"}>{health?.online ? "Online" : "Offline"}</Badge>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="gap-2" onClick={handleTestConnection} disabled={testing}>
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Reconnect
            </Button>
            <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={testing}>Test Connection</Button>
          </div>
          {message && (
            <p className={`text-xs ${message.type === "success" ? "text-emerald-500" : "text-red-500"}`}>{message.text}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Installed Models</CardTitle>
          <CardDescription>Manage locally installed models</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {modelsLoading ? (
            <div className="space-y-3 py-4">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-48" /></div></div>))}</div>
          ) : modelsError ? (
            <ErrorState message={modelsError.message} onRetry={refetchModels} />
          ) : modelsList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No models installed. Pull a model to get started.</p>
          ) : modelsList.map((model: any) => (
            <div key={model.id ?? model.name} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full shrink-0 bg-green-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{model.name}</p>
                <p className="text-xs text-muted-foreground">{model.parameterSize ?? "Unknown"}</p>
              </div>
              <Badge variant="secondary" className="text-xs shrink-0">{model.quantization ?? "unknown"}</Badge>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            {showPullInput ? (
              <>
                <Input
                  placeholder="Model name (e.g. llama3.2, qwen2.5-coder:latest)"
                  value={pullName}
                  onChange={(e) => setPullName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handlePullModel(); if (e.key === "Escape") { setShowPullInput(false); setPullName("") } }}
                  className="h-9 text-xs flex-1"
                  autoFocus
                />
                <Button size="sm" className="gap-2" onClick={handlePullModel} disabled={pulling || !pullName.trim()}>
                  {pulling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}{pulling ? "Pulling..." : "Pull"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setShowPullInput(false); setPullName("") }}>Cancel</Button>
              </>
            ) : (
              <Button size="sm" className="gap-2" onClick={() => setShowPullInput(true)}>
                <Plus className="h-3.5 w-3.5" />Pull Model
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={refetchModels}><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cloud Fallback</CardTitle>
          <CardDescription>When a model is not available locally, fall back to cloud providers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable Cloud Fallback</p>
              <p className="text-xs text-muted-foreground">Route to cloud when local model is unavailable</p>
            </div>
            <Switch checked disabled />
          </div>
          <Separator />
          <div className="space-y-2">
            <label className="text-sm font-medium">Fallback Provider</label>
            <Select disabled>
              <SelectTrigger><SelectValue placeholder="Not configured" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="google">Google AI</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Cloud fallback routing is not available in this build.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
