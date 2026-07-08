"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Cpu,
  Cloud,
  HardDrive,
  Key,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Search,
  Download,
  Trash2,
  Loader2,
  Wifi,
  WifiOff,
  Brain,
  Bot,
  Sparkles,
  Microscope,
  Wind,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

const providerIcons: Record<string, React.ElementType> = {
  ollama: Bot,
  huggingface: Sparkles,
  openai: Brain,
  anthropic: Sparkles,
  google: Microscope,
  mistral: Wind,
  groq: Zap,
}

const providerColors: Record<string, string> = {
  ollama: "border-emerald-500/30",
  huggingface: "border-amber-500/30",
  openai: "border-green-500/30",
  anthropic: "border-purple-500/30",
  google: "border-blue-500/30",
  mistral: "border-cyan-500/30",
  groq: "border-orange-500/30",
}

export default function ModelsPage() {
  const [models, setModels] = useState<any[]>([])
  const [providers, setProviders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [runtimeOnline, setRuntimeOnline] = useState(false)
  const [pulling, setPulling] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [apiKeys, setApiKeys] = useState<Record<string, { key: string; visible: boolean }>>({})
  const [showKeyInput, setShowKeyInput] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [m, p, h] = await Promise.all([
        api.models.list().catch(() => [] as any[]),
        api.models.getProviders().catch(() => [] as any[]),
        api.models.getRuntimeHealth().catch(() => ({ online: false, status: "error" })),
      ])
      setModels(m)
      setProviders(p)
      setRuntimeOnline(h.online)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const groupedByProvider = providers.reduce((acc: Record<string, any[]>, p: any) => {
    acc[p.id] = models.filter((m: any) => m.provider === p.id)
    return acc
  }, {} as Record<string, any[]>)

  const pulledModels = models.filter((m: any) => m.available && m.local)
  const availableModels = models.filter((m: any) => !m.available && m.local)

  const handlePull = async (modelName: string) => {
    setPulling(modelName)
    try {
      const res = await api.models.pullModel(modelName)
      toast({ title: res.status || `${modelName} pulled successfully`, variant: "success" })
      await fetchData()
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Pull failed", variant: "error" })
    } finally {
      setPulling(null)
    }
  }

  const handleSearch = async (q: string) => {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const results = await api.models.searchModels(q)
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const toggleKeyVisibility = (providerId: string) => {
    setApiKeys(prev => {
      const existing = prev[providerId] ?? { key: "", visible: false }
      return { ...prev, [providerId]: { ...existing, visible: !existing.visible } }
    })
  }

  const saveApiKey = (providerId: string, key: string) => {
    setApiKeys(prev => ({ ...prev, [providerId]: { key, visible: false } }))
    setShowKeyInput(null)
    toast({ title: `API key saved for ${providerId}`, variant: "success" })
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(id)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Model Hub</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loading ? "Loading..." : `${models.length} models across ${providers.length} providers`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              {runtimeOnline ? (
                <Badge variant="secondary" className="gap-1">
                  <Wifi className="h-3 w-3 text-emerald-500" /> Runtime Online
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <WifiOff className="h-3 w-3" /> Runtime Offline
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchData}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="providers" className="space-y-6">
          <TabsList>
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="local">Local Models {pulledModels.length > 0 && `(${pulledModels.length})`}</TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
          </TabsList>

          {/* Providers Tab */}
          <TabsContent value="providers" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-5 w-32 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-20 w-full" />
                      </CardContent>
                    </Card>
                  ))
                : providers.map((provider: any) => {
                    const providerModels = groupedByProvider[provider.id] || []
                    const hasApiKey = providerModels.some((m: any) => m.available)
                    const ProviderIcon = (providerIcons as Record<string, React.ElementType>)[provider.id] || Bot
                    const color = providerColors[provider.id] || "border-border"

                    return (
                      <Card key={provider.id} className={cn("hover:border-primary/40 transition-colors", color)}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <ProviderIcon className="h-6 w-6 text-foreground" />
                              <div>
                                <CardTitle className="text-base capitalize">{provider.name}</CardTitle>
                                <CardDescription className="text-xs mt-0.5">
                                  {providerModels.length} models
                                </CardDescription>
                              </div>
                            </div>
                            {hasApiKey ? (
                              <Badge variant="default" className="text-[10px] h-5 gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Ready
                              </Badge>
                            ) : provider.id === "ollama" || provider.id === "huggingface" ? (
                              <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                                <HardDrive className="h-3 w-3" />
                                Local
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-5 gap-1 text-muted-foreground">
                                <XCircle className="h-3 w-3" />
                                No Key
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                            {providerModels.slice(0, 8).map((model: any) => (
                              <div key={`${model.provider}-${model.id}`} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-accent/50 transition-colors text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  {model.local ? (
                                    <HardDrive className="h-3 w-3 shrink-0 text-muted-foreground" />
                                  ) : (
                                    <Cloud className="h-3 w-3 shrink-0 text-muted-foreground" />
                                  )}
                                  <span className="font-medium truncate">{model.name}</span>
                                  <span className="text-muted-foreground shrink-0">
                                    {model.contextLength >= 1000000
                                      ? `${(model.contextLength / 1000).toFixed(0)}K`
                                      : model.contextLength >= 1000
                                      ? `${(model.contextLength / 1000).toFixed(0)}K`
                                      : model.contextLength}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {model.pricing ? (
                                    <span className="text-muted-foreground">{model.pricing}</span>
                                  ) : (
                                    <Badge variant="secondary" className="text-[9px] px-1 h-4">Free</Badge>
                                  )}
                                  <div className="flex gap-0.5">
                                    {model.capabilities?.slice(0, 2).map((cap: string) => (
                                      <Badge key={cap} variant="outline" className="text-[9px] px-1 h-4 capitalize">
                                        {cap.slice(0, 2)}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                            {providerModels.length > 8 && (
                              <p className="text-[10px] text-muted-foreground text-center pt-1">
                                +{providerModels.length - 8} more models
                              </p>
                            )}
                          </div>

                          {provider.id !== "ollama" && provider.id !== "huggingface" && (
                            <div className="pt-2 border-t border-border">
                              {showKeyInput === provider.id ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    placeholder="Enter API key..."
                                    className="h-8 text-xs"
                                    type={apiKeys[provider.id]?.visible ? "text" : "password"}
                                    onChange={e => {
                                      setApiKeys(prev => {
                                        const existing = prev[provider.id] ?? { key: "", visible: false }
                                        return { ...prev, [provider.id]: { ...existing, key: e.target.value } }
                                      })
                                    }}
                                    onKeyDown={e => {
                                      const key = apiKeys[provider.id]?.key
                                      if (e.key === "Enter" && key) saveApiKey(provider.id, key)
                                    }}
                                  />
                                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => toggleKeyVisibility(provider.id)}>
                                    {apiKeys[provider.id]?.visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                  </Button>
                                  <Button variant="secondary" size="sm" className="h-7 text-xs shrink-0" onClick={() => {
                                    const key = apiKeys[provider.id]?.key
                                    if (key) saveApiKey(provider.id, key)
                                  }}>
                                    Save
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setShowKeyInput(provider.id)}
                                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                                >
                                  <Key className="h-3.5 w-3.5" />
                                  {apiKeys[provider.id]?.key ? "Update API Key" : "Configure API Key"}
                                </button>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
            </div>

            {!loading && providers.length === 0 && (
              <Card className="p-12 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Agent runtime is offline. Start the Python runtime to discover models.</p>
                <p className="text-xs text-muted-foreground mt-1">Run: <code className="text-amber-400">cd packages/agent-runtime && uvicorn src.main:app --reload --port 8000</code></p>
              </Card>
            )}
          </TabsContent>

          {/* Local Models Tab */}
          <TabsContent value="local">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Local Models</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {pulledModels.length} pulled models — {availableModels.length} available for pull
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <HardDrive className="h-3 w-3" /> Ollama
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {pulledModels.length === 0 && availableModels.length === 0 && (
                      <p className="text-sm text-muted-foreground py-8 text-center">No local models found. Pull one from the list below.</p>
                    )}

                    {pulledModels.map((model: any) => (
                      <div key={model.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-accent/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-emerald-500" />
                          <div>
                            <p className="text-sm font-medium">{model.name}</p>
                            <p className="text-[11px] text-muted-foreground">{model.size} — {model.description}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">Pulled</Badge>
                      </div>
                    ))}

                    {availableModels.length > 0 && (
                      <>
                        <div className="pt-4 pb-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Available for Pull</p>
                        </div>
                        {availableModels.map((model: any) => (
                          <div key={model.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-accent/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                              <div>
                                <p className="text-sm font-medium">{model.name}</p>
                                <p className="text-[11px] text-muted-foreground">{model.size} — {model.description}</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => handlePull(model.id)}
                              disabled={pulling === model.id}
                            >
                              {pulling === model.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Download className="h-3 w-3" />
                              )}
                              {pulling === model.id ? "Pulling..." : "Pull"}
                            </Button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Search Tab */}
          <TabsContent value="search">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Search Models</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Browse and pull models from the Ollama library
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search models (e.g., llama, mistral, phi)..."
                    className="pl-9 h-10"
                    value={searchQuery}
                    onChange={e => handleSearch(e.target.value)}
                  />
                </div>

                {searching && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!searching && searchResults.length > 0 && (
                  <div className="space-y-1">
                    {searchResults.map((model: any) => (
                      <div key={model.name} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-accent/30 transition-colors">
                        <div>
                          <p className="text-sm font-medium">{model.name}</p>
                          {model.description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{model.description}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => handlePull(model.name)}
                          disabled={pulling === model.name}
                        >
                          {pulling === model.name ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3" />
                          )}
                          {pulling === model.name ? "Pulling..." : "Pull"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No models found. The Ollama runtime may be offline.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
