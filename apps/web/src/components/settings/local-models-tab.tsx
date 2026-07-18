"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Plus, RefreshCw } from "lucide-react"
import { api } from "@/lib/api"
import { useQuery } from "@/hooks/use-query"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ui/error-state"

export function LocalModelsTab() {
  const [pulling, setPulling] = useState(false)

  const { data: modelsList = [], loading: modelsLoading, error: modelsError, refetch: refetchModels } = useQuery(
    "settings:models",
    () => api.models.list(),
  )

  const handlePullModel = async () => {
    const name = prompt("Enter model name to pull (e.g. llama3:8b):")
    if (!name) return
    setPulling(true)
    try {
      await api.models.pullModel(name)
      refetchModels()
      alert(`Model "${name}" pulled successfully`)
    } catch (e: any) {
      alert(`Failed: ${e.message}`)
    } finally {
      setPulling(false)
    }
  }

  const handleTestConnection = async () => {
    try {
      const health = await api.models.getRuntimeHealth()
      alert(health.online ? "Connection OK" : "Runtime offline")
    } catch (e: any) {
      alert(`Connection failed: ${e.message}`)
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
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
            <div className="flex-1">
              <p className="text-sm font-medium">Connected to Ollama</p>
              <p className="text-xs text-muted-foreground">http://localhost:11434</p>
            </div>
            <Badge variant="secondary">Online</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Host</label>
              <Input defaultValue="http://localhost:11434" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Timeout (seconds)</label>
              <Input type="number" defaultValue={60} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="gap-2" onClick={handleTestConnection}><RefreshCw className="h-3.5 w-3.5" />Reconnect</Button>
            <Button variant="outline" size="sm" onClick={handleTestConnection}>Test Connection</Button>
          </div>
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
              <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${model.status === "loaded" ? "bg-green-500" : "bg-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{model.name}</p>
                <p className="text-xs text-muted-foreground">{model.size ?? "Unknown"}</p>
              </div>
              <Badge variant={model.status === "loaded" ? "default" : "secondary"} className="text-xs shrink-0">
                {model.status === "loaded" ? "Loaded" : "Unloaded"}
              </Badge>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Button size="sm" className="gap-2" onClick={handlePullModel} disabled={pulling}>
              <Plus className="h-3.5 w-3.5" />{pulling ? "Pulling..." : "Pull Model"}
            </Button>
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
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="space-y-2">
            <label className="text-sm font-medium">Fallback Provider</label>
            <Select>
              <SelectTrigger><SelectValue placeholder="OpenAI" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="google">Google AI</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
