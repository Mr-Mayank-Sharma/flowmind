"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Plus, ArrowUpDown, Loader2 } from "lucide-react"
import { api } from "@/lib/api"

export function AiModelsTab() {
  const [models, setModels] = useState<string[]>([])
  const [providers, setProviders] = useState<{ id: string; name: string; available: boolean }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [m, p] = await Promise.all([
          api.models.list().catch(() => []),
          api.models.getProviders().catch(() => []),
        ])
        setModels((Array.isArray(m) ? m : []).map((mm: any) => mm.name ?? mm.id ?? ""))
        setProviders(Array.isArray(p) ? p : [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Default Model</CardTitle>
          <CardDescription>Select the default AI model for new conversations and pipelines</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <Select>
              <SelectTrigger className="w-full"><SelectValue placeholder={models[0] || "No models available"} /></SelectTrigger>
              <SelectContent>
                {models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Temperature</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  defaultValue="0.7"
                  className="flex-1 accent-primary"
                />
                <span className="text-sm font-mono text-muted-foreground w-8 text-right">0.7</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Tokens</label>
              <Input type="number" defaultValue={4096} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provider Priority</CardTitle>
          <CardDescription>Select available providers for model routing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {providers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No providers available</p>
          ) : (
            providers.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border bg-surface px-4 py-3">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium flex-1">{p.name}</span>
                {p.available && <Badge variant="secondary" className="text-xs">Available</Badge>}
                {!p.available && <Badge variant="outline" className="text-xs">Not Configured</Badge>}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost Limits</CardTitle>
          <CardDescription>Set spending caps per provider to control costs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers.filter(p => p.available).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Configure API keys to set cost limits</p>
          ) : (
            providers.filter(p => p.available).map(provider => (
              <div key={provider.id} className="flex items-center justify-between rounded-lg border bg-surface px-4 py-3">
                <span className="text-sm font-medium">{provider.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Monthly cap:</span>
                  <Input
                    type="number"
                    defaultValue={200}
                    className="w-24 h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">USD</span>
                </div>
              </div>
            ))
          )}
          <div className="pt-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              Add Provider Limit
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
