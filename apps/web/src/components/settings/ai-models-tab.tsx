"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { ArrowUpDown, Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

export function AiModelsTab() {
  const [models, setModels] = useState<string[]>([])
  const [providers, setProviders] = useState<{ id: string; name: string; available: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [defaultModel, setDefaultModel] = useState("")
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    async function load() {
      try {
        const [m, p, profile] = await Promise.all([
          api.models.list().catch(() => []),
          api.models.getProviders().catch(() => []),
          api.settings.getProfile().catch(() => null),
        ])
        setModels((Array.isArray(m) ? m : []).map((mm: any) => mm.name ?? mm.id ?? "").filter(Boolean))
        setProviders(Array.isArray(p) ? p : [])
        setDefaultModel((profile as any)?.defaultModel ?? "")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const saveDefaultModel = async () => {
    setSaving(true)
    try {
      await api.settings.updateProfile({ defaultModel })
      toast.success("Default model updated")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update default model")
    } finally {
      setSaving(false)
    }
  }

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
            <Select value={defaultModel} onValueChange={setDefaultModel}>
              <SelectTrigger className="w-full"><SelectValue placeholder="No model selected" /></SelectTrigger>
              <SelectContent>
                {models.length === 0 && <SelectItem value="" disabled>No models available</SelectItem>}
                {models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={saveDefaultModel} disabled={saving || !defaultModel}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Default Model
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provider Priority</CardTitle>
          <CardDescription>Available providers for model routing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {providers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No providers available</p>
          ) : (
            providers.map((p) => (
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
    </div>
  )
}
