"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Trash2, Download, CheckCircle, Loader2, HardDrive } from "lucide-react"
import { cn } from "@/lib/utils"

interface Model {
  name: string
  size: string
  bytes: number
  modified: string
  quantization?: string
  status: "loaded" | "unloaded" | "downloading"
  downloadProgress?: number
}

const frameworkModels: Record<string, Model[]> = {
  ollama: [
    { name: "mistral:7b", size: "4.1 GB", bytes: 4_100_000_000, modified: "2 days ago", quantization: "Q4_K_M", status: "loaded" },
    { name: "llama3:8b", size: "4.7 GB", bytes: 4_700_000_000, modified: "5 days ago", quantization: "Q4_K_M", status: "unloaded" },
    { name: "codellama:7b", size: "3.8 GB", bytes: 3_800_000_000, modified: "1 week ago", quantization: "Q5_K_M", status: "unloaded" },
    { name: "mixtral:8x7b", size: "26 GB", bytes: 26_000_000_000, modified: "3 weeks ago", quantization: "Q2_K", status: "loaded" },
    { name: "nomic-embed-text", size: "274 MB", bytes: 274_000_000, modified: "1 month ago", quantization: "F16", status: "loaded" },
  ],
  "lm-studio": [
    { name: "phi-3-mini-4k", size: "2.3 GB", bytes: 2_300_000_000, modified: "1 day ago", quantization: "Q4_K_M", status: "loaded" },
    { name: "phi-3-medium-128k", size: "7.5 GB", bytes: 7_500_000_000, modified: "3 days ago", quantization: "Q4_K_M", status: "unloaded" },
    { name: "nemotron-mini-4k", size: "3.1 GB", bytes: 3_100_000_000, modified: "1 week ago", quantization: "Q4_K_M", status: "unloaded" },
  ],
  comfyui: [
    { name: "sdxl-base-1.0", size: "6.9 GB", bytes: 6_900_000_000, modified: "2 days ago", quantization: "fp16", status: "loaded" },
    { name: "sd3.5-medium", size: "5.2 GB", bytes: 5_200_000_000, modified: "5 days ago", quantization: "fp16", status: "unloaded" },
    { name: "realvisxl-v4.0", size: "6.9 GB", bytes: 6_900_000_000, modified: "1 week ago", quantization: "fp16", status: "loaded" },
    { name: "dreamshaper-xl", size: "6.9 GB", bytes: 6_900_000_000, modified: "2 weeks ago", quantization: "fp16", status: "unloaded" },
  ],
  hermes: [
    { name: "hermes-2-pro-mistral", size: "4.1 GB", bytes: 4_100_000_000, modified: "3 days ago", quantization: "Q4_K_M", status: "loaded" },
    { name: "hermes-2-dpo-mistral", size: "4.1 GB", bytes: 4_100_000_000, modified: "1 week ago", quantization: "Q4_K_M", status: "unloaded" },
  ],
  localai: [
    { name: "gpt-4-vision-local", size: "8.2 GB", bytes: 8_200_000_000, modified: "2 days ago", quantization: "Q4_K_M", status: "loaded" },
    { name: "whisper-local", size: "1.5 GB", bytes: 1_500_000_000, modified: "5 days ago", quantization: "fp16", status: "unloaded" },
    { name: "stable-diffusion-local", size: "5.8 GB", bytes: 5_800_000_000, modified: "1 week ago", quantization: "fp16", status: "unloaded" },
  ],
}

export function ModelManager({ frameworkId }: { frameworkId: string }) {
  const [models, setModels] = useState<Model[]>([])
  const [pulling, setPulling] = useState<string | null>(null)
  const [pullProgress, setPullProgress] = useState(0)

  useEffect(() => {
    const initial = frameworkModels[frameworkId] ?? []
    setModels(initial)
  }, [frameworkId])

  const handlePull = async (modelName: string) => {
    setPulling(modelName)
    setPullProgress(0)
    for (let i = 0; i <= 100; i += Math.floor(Math.random() * 15) + 5) {
      await new Promise((r) => setTimeout(r, 400))
      setPullProgress(Math.min(i, 100))
    }
    setPullProgress(100)
    await new Promise((r) => setTimeout(r, 500))
    setModels((prev) => [
      { name: modelName, size: "4.1 GB", bytes: 4_100_000_000, modified: "Just now", quantization: "Q4_K_M", status: "loaded" },
      ...prev,
    ])
    setPulling(null)
    setPullProgress(0)
  }

  const handleDelete = (name: string) => {
    setModels((prev) => prev.filter((m) => m.name !== name))
  }

  const totalSize = models.reduce((acc, m) => acc + m.bytes, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium">Installed Models</h3>
          <Badge variant="secondary" className="text-[10px]">{models.length} models</Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <HardDrive className="h-3 w-3" />
          <span>{formatBytes(totalSize)} total</span>
        </div>
      </div>

      <div className="space-y-1">
        {models.length === 0 ? (
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
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-mono",
                    model.status === "loaded"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : model.status === "downloading"
                      ? "bg-blue-500/10 text-blue-400"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {model.status}
                  </span>
                  {model.quantization && (
                    <span className="text-[10px] text-muted-foreground font-mono">{model.quantization}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                  <span>{model.size}</span>
                  <span>Modified {model.modified}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {model.status !== "loaded" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => handlePull(model.name)}
                    disabled={pulling === model.name}
                  >
                    <Download className="h-3 w-3" />
                    Load
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                  onClick={() => handleDelete(model.name)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
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
            <span className="text-xs text-muted-foreground ml-auto">{pullProgress}%</span>
          </div>
          <Progress value={pullProgress} variant="default" className="h-1.5" />
        </div>
      )}

      {pulling && pullProgress === 100 && (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle className="h-4 w-4" />
          Model {pulling} pulled successfully
        </div>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`
  return `${(bytes / 1_000).toFixed(0)} KB`
}
