"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Trash2, Download, Loader2, HardDrive, RefreshCw, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, type OllamaModel } from "@/lib/api"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

export function ModelManager({ frameworkId }: { frameworkId: string }) {
  const [models, setModels] = useState<OllamaModel[]>([])
  const [loading, setLoading] = useState(true)
  const [pulling, setPulling] = useState<string | null>(null)
  const [pullProgress, setPullProgress] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pullInput, setPullInput] = useState("")
  const [showPullInput, setShowPullInput] = useState(false)

  const fetchModels = useCallback(async () => {
    try {
      if (frameworkId === "ollama") {
        const data = await api.models.list()
        setModels(data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load models")
    } finally {
      setLoading(false)
    }
  }, [frameworkId])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  const handlePull = async (modelName: string) => {
    if (!modelName.trim()) return
    setPulling(modelName.trim())
    setPullProgress(0)
    setError(null)

    try {
      const res = await api.models.pullModel(modelName.trim())
      setPullProgress(res.progress ?? 100)
      await fetchModels()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pull failed")
    } finally {
      setTimeout(() => {
        setPulling(null)
        setPullProgress(0)
      }, 1500)
    }
  }

  const handleDelete = async (name: string) => {
    setDeleting(name)
    setError(null)
    try {
      await api.models.deleteModel(name)
      setConfirmDelete(null)
      await fetchModels()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setDeleting(null)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`
    return `${(bytes / 1_000).toFixed(0)} KB`
  }

  const formatDate = (iso: string): string => {
    try {
      const d = new Date(iso)
      const now = new Date()
      const diffMs = now.getTime() - d.getTime()
      const diffH = Math.floor(diffMs / 3600000)
      if (diffH < 1) return "just now"
      if (diffH < 24) return `${diffH}h ago`
      const diffD = Math.floor(diffH / 24)
      if (diffD < 7) return `${diffD}d ago`
      return d.toLocaleDateString()
    } catch {
      return "unknown"
    }
  }

  const totalSize = models.reduce((acc, m) => acc + m.size, 0)

  if (frameworkId !== "ollama") {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Model management is only available for Ollama. Detected framework: {frameworkId}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium">Installed Models</h3>
          <Badge variant="secondary" className="text-[10px]">{loading ? "--" : models.length} models</Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <HardDrive className="h-3 w-3" />
            <span>{formatBytes(totalSize)} total</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => fetchModels()}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {showPullInput ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              placeholder="Model name (e.g. llama3.2, qwen2.5-coder:latest)"
              value={pullInput}
              onChange={(e) => setPullInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePull(pullInput)
                if (e.key === "Escape") { setShowPullInput(false); setPullInput("") }
              }}
              className="h-8 text-xs"
              autoFocus
            />
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => handlePull(pullInput)}
              disabled={!pullInput.trim() || pulling !== null}
            >
              {pulling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              Pull
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => { setShowPullInput(false); setPullInput("") }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowPullInput(true)}
          >
            <Download className="h-3 w-3" />
            Pull Model
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : models.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No models installed. Pull a model to get started.
          </div>
        ) : (
          models.map((model) => (
            <div
              key={model.name}
              className="flex items-center gap-4 px-3 py-2.5 rounded-lg border border-border/50 bg-background/30 hover:bg-accent/20 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{model.name}</span>
                  {model.parameterSize !== "unknown" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-emerald-500/10 text-emerald-400">
                      {model.parameterSize}
                    </span>
                  )}
                  {model.quantization !== "unknown" && (
                    <span className="text-[10px] text-muted-foreground font-mono">{model.quantization}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                  <span>{formatBytes(model.size)}</span>
                  <span>{formatDate(model.modified)}</span>
                  {model.family !== "unknown" && <span>{model.family}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                  onClick={() => setConfirmDelete(model.name)}
                  disabled={deleting === model.name}
                >
                  {deleting === model.name ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {pulling && (
        <div className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Pulling {pulling}...</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {pullProgress > 0 ? `${Math.round(pullProgress)}%` : "working"}
            </span>
          </div>
          <Progress value={pullProgress > 0 ? pullProgress : 100} variant="default" className={cn("h-1.5", pullProgress === 0 && "animate-pulse")} />
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete model"
        description={`Delete "${confirmDelete}"? This cannot be undone. You can pull it again later.`}
        confirmLabel="Delete"
        destructive
        busy={deleting !== null}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
