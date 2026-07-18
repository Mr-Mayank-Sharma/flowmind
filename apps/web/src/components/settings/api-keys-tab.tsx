"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Eye, EyeOff } from "lucide-react"
import { api } from "@/lib/api"
import { useQuery, useMutation } from "@/hooks/use-query"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ui/error-state"

const providers = ["OpenAI", "Anthropic", "Google AI", "Mistral AI", "Meta", "Groq", "Together AI", "Fireworks"]

export function ApiKeysTab({ showKey, setShowKey }: { showKey: string | null; setShowKey: (v: string | null) => void }) {
  const [showNewKeyForm, setShowNewKeyForm] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyProvider, setNewKeyProvider] = useState("OpenAI")
  const [newKeyValue, setNewKeyValue] = useState("")

  const { data: apiKeys = [], loading, error: keysError, refetch } = useQuery(
    "settings:apiKeys",
    () => api.settings.getApiKeys(),
  )

  const { mutate: createKey } = useMutation(
    (input: { name: string; provider: string; key: string }) => api.settings.createApiKey(input),
    { onSuccess: () => { setShowNewKeyForm(false); setNewKeyName(""); setNewKeyValue(""); refetch() } },
  )

  const { mutate: deleteKey } = useMutation(
    (id: string) => api.settings.deleteApiKey(id),
    { onSuccess: refetch },
  )

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage API keys for external providers</CardDescription>
            </div>
            <Button size="sm" className="gap-2" onClick={() => setShowNewKeyForm(!showNewKeyForm)}><Plus className="h-3.5 w-3.5" />Add Key</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showNewKeyForm && (
            <div className="rounded-lg border border-primary/30 bg-primary/[0.02] p-4 space-y-3">
              <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key name" className="h-8 text-sm" />
              <select value={newKeyProvider} onChange={(e) => setNewKeyProvider(e.target.value)} className="h-8 text-sm w-full rounded-md border border-input bg-surface px-3">
                {providers.map(p => <option key={p}>{p}</option>)}
              </select>
              <Input value={newKeyValue} onChange={(e) => setNewKeyValue(e.target.value)} placeholder="API key" className="h-8 text-sm font-mono" />
              <div className="flex gap-2">
                <Button size="sm" className="h-8 text-xs" onClick={() => createKey({ name: newKeyName, provider: newKeyProvider, key: newKeyValue })} disabled={!newKeyName || !newKeyValue}>Save</Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowNewKeyForm(false)}>Cancel</Button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="space-y-3 py-4">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-48" /></div></div>))}</div>
          ) : keysError ? (
            <ErrorState message={keysError.message} onRetry={refetch} />
          ) : apiKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No API keys yet</p>
          ) : apiKeys.map((ak: any) => (
            <div key={ak.id} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{ak.name}</p>
                  <Badge variant={ak.isActive ? "default" : "secondary"}>
                    {ak.isActive ? "active" : "inactive"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{ak.provider}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1.5">
                    <code className="text-xs text-muted-foreground font-mono">
                      {showKey === ak.id ? ak.keyHash?.slice(0, 16) + "..." : "••••" + ak.lastFour}
                    </code>
                    <button onClick={() => setShowKey(showKey === ak.id ? null : ak.id)} className="text-muted-foreground hover:text-foreground">
                      {showKey === ak.id ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Created {new Date(ak.createdAt).toLocaleDateString()} &middot; Last used {ak.lastUsedAt ? new Date(ak.lastUsedAt).toLocaleDateString() : "Never"}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteKey(ak.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
