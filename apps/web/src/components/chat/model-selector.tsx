"use client"

import { useState, useEffect, useCallback } from "react"
import { Check, ChevronDown, Cloud, HardDrive, Key, ExternalLink, Eye, EyeOff, WifiOff, Brain, Bot, Sparkles, Microscope, Wind, Zap } from "lucide-react"
import { Button, Input } from "@flowmind/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

const providerIconMap: Record<string, React.ElementType> = {
  ollama: Bot,
  huggingface: Sparkles,
  openai: Brain,
  anthropic: Sparkles,
  google: Microscope,
  mistral: Wind,
  groq: Zap,
}

interface ModelInfo {
  id: string
  name: string
  provider: string
  available: boolean
  local: boolean
  contextLength?: number
  pricing?: string
}

interface ProviderInfo {
  id: string
  name: string
  available?: boolean
}

interface ModelSelectorProps {
  selectedModel: string
  onModelChange: (model: string) => void
  disabled?: boolean
}

export function ModelSelector({ selectedModel, onModelChange, disabled }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [showCredentialInput, setShowCredentialInput] = useState(false)
  const [credentialKey, setCredentialKey] = useState("")
  const [credentialProvider, setCredentialProvider] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const { toast } = useToast()

  useEffect(() => {
    async function load() {
      try {
        const [m, p] = await Promise.all([
          api.models.list().catch(() => [] as ModelInfo[]),
          api.models.getProviders().catch(() => [] as ProviderInfo[]),
        ])
        setModels(Array.isArray(m) ? m : [])
        setProviders(Array.isArray(p) ? p : [])
      } finally {
        setLoading(false)
      }
    }
    load()
    loadSavedKeys()
  }, [])

  const loadSavedKeys = () => {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem("flowmind_api_keys")
      if (raw) setApiKeys(JSON.parse(raw))
    } catch {}
  }

  const saveKey = (providerId: string, key: string) => {
    const updated = { ...apiKeys, [providerId]: key }
    setApiKeys(updated)
    if (typeof window !== "undefined") {
      localStorage.setItem("flowmind_api_keys", JSON.stringify(updated))
    }
    setCredentialKey("")
    setCredentialProvider(null)
    setShowCredentialInput(false)
    toast({ title: `API key saved for ${providerId}`, variant: "success" })
  }

  const needsApiKey = useCallback((providerId: string) => {
    if (providerId === "ollama" || providerId === "huggingface") return false
    return !apiKeys[providerId]
  }, [apiKeys])

  const localModels = models.filter(m => m.local && m.available)
  const cloudModels = models.filter(m => !m.local)

  const handleSelectModel = useCallback((modelId: string) => {
    const model = models.find(m => m.id === modelId || m.name === modelId)
    if (model && !model.local && !apiKeys[model.provider]) {
      setCredentialProvider(model.provider)
      setShowCredentialInput(true)
      return
    }
    onModelChange(modelId)
    setOpen(false)
  }, [models, apiKeys, onModelChange])

  const selectedModelName = models.find(m => m.id === selectedModel || m.name === selectedModel)?.name || selectedModel

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-md bg-accent text-accent-foreground hover:bg-accent/80 transition-colors disabled:opacity-50"
      >
        {selectedModelName ? (
          <>
            {models.find(m => m.id === selectedModel || m.name === selectedModel)?.local ? (
              <HardDrive className="h-3 w-3" />
            ) : (
              <Cloud className="h-3 w-3" />
            )}
            <span className="max-w-[80px] truncate">{selectedModelName}</span>
          </>
        ) : (
          "Select model"
        )}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && !showCredentialInput && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setShowCredentialInput(false) }} />
          <div className="absolute bottom-full right-0 mb-2 z-20 w-64 max-h-80 rounded-lg border border-border bg-surface shadow-lg overflow-hidden">
            <div className="p-2 border-b border-border">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Select Model</p>
            </div>
            <div className="overflow-y-auto max-h-64">
              {loading ? (
                <div className="py-3 px-2 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                      <Skeleton className="h-3 w-3 rounded shrink-0" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {localModels.length > 0 && (
                    <div className="px-2 py-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 py-1">Local Models</p>
                      {localModels.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleSelectModel(m.id)}
                          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs text-left hover:bg-accent transition-colors"
                        >
                          <HardDrive className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span className="flex-1 truncate">{m.name}</span>
                          {selectedModel === m.id && <Check className="h-3 w-3 text-primary shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                  {cloudModels.length > 0 && (
                    <div className="px-2 py-1 border-t border-border/50">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 py-1">Cloud Models</p>
                      {cloudModels.map((m) => {
                        const ProviderIcon = providerIconMap[m.provider] || Brain
                        const missingKey = needsApiKey(m.provider)
                        return (
                          <button
                            key={m.id}
                            onClick={() => handleSelectModel(m.id)}
                            className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs text-left hover:bg-accent transition-colors"
                          >
                            <ProviderIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="flex-1 truncate">{m.name}</span>
                            {missingKey ? (
                              <Key className="h-3 w-3 text-amber-500 shrink-0" />
                            ) : (
                              selectedModel === m.id && <Check className="h-3 w-3 text-primary shrink-0" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {models.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No models available</p>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {showCredentialInput && credentialProvider && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setShowCredentialInput(false); setCredentialProvider(null) }} />
          <div className="absolute bottom-full right-0 mb-2 z-20 w-72 rounded-lg border border-border bg-surface shadow-lg p-3">
            <p className="text-xs font-medium mb-2">
              Configure API Key for {credentialProvider}
            </p>
            <p className="text-[10px] text-muted-foreground mb-2">
              This model requires an API key. Enter it below to enable cloud model access.
            </p>
            <div className="flex items-center gap-1 mb-2">
              <Input
                placeholder="sk-..."
                className="h-8 text-xs flex-1"
                type={showKey ? "text" : "password"}
                value={credentialKey}
                onChange={(e) => setCredentialKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && credentialKey) {
                    saveKey(credentialProvider, credentialKey)
                  }
                }}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="p-1.5 rounded hover:bg-accent shrink-0"
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={() => saveKey(credentialProvider, credentialKey)}
                disabled={!credentialKey}
              >
                <Key className="h-3 w-3 mr-1" />
                Save Key
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => { setShowCredentialInput(false); setCredentialProvider(null) }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
