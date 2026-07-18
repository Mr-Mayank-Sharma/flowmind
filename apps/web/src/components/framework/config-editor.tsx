"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@flowmind/ui"
import { Save, RotateCcw, FileCode, CheckCircle, AlertCircle } from "lucide-react"

const frameworkDefaults: Record<string, Record<string, unknown>> = {
  ollama: {
    host: "127.0.0.1",
    port: 11434,
    model_dir: "/home/user/.ollama/models",
    keep_alive: "5m",
    max_queue: 512,
    num_parallel: 4,
    gpu_layers: 35,
    use_mmap: true,
    temperature: 0.7,
    top_p: 0.9,
    context_length: 4096,
    batch_size: 512,
    log_level: "info",
  },
  "lm-studio": {
    host: "127.0.0.1",
    port: 1234,
    quantization: "auto",
    max_tokens: 4096,
    temperature: 0.7,
    top_p: 0.95,
    gpu_offload: true,
    context_length: 8192,
    batch_size: 1,
  },
  comfyui: {
    host: "127.0.0.1",
    port: 8188,
    output_dir: "./output",
    input_dir: "./input",
    max_workflow_steps: 500,
    preview_method: "auto",
    use_split_cross_attention: true,
    use_punet: false,
    vram_limit: 8192,
  },
  hermes: {
    host: "127.0.0.1",
    port: 3001,
    default_model: "hermes-2-pro-mistral",
    temperature: 0.3,
    max_tokens: 2048,
    tool_use: true,
    memory_enabled: true,
    system_prompt: "You are a helpful AI assistant.",
  },
  localai: {
    host: "127.0.0.1",
    port: 8080,
    model_path: "/models",
    image_dir: "/images/generated",
    upload_dir: "/uploads",
    galleries: ["huggingface", "ollama"],
    debug: false,
    threads: 4,
  },
}

function getDefaults(frameworkId: string): Record<string, unknown> {
  return frameworkDefaults[frameworkId] ?? { host: "127.0.0.1", port: 8080 }
}

export function ConfigEditor({ frameworkId }: { frameworkId: string }) {
  const [config, setConfig] = useState("")
  const [saved, setSaved] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const defaults = getDefaults(frameworkId)
    setConfig(JSON.stringify(defaults, null, 2))
  }, [frameworkId])

  const handleChange = (value: string) => {
    setConfig(value)
    setHasChanges(true)
    setSaved(false)
    setError(null)
    try {
      JSON.parse(value)
      setError(null)
    } catch {
      setError("Invalid JSON")
    }
  }

  const handleSave = () => {
    try {
      JSON.parse(config)
      setSaved(true)
      setHasChanges(false)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError("Cannot save: invalid JSON")
    }
  }

  const handleReset = () => {
    const defaults = getDefaults(frameworkId)
    setConfig(JSON.stringify(defaults, null, 2))
    setHasChanges(false)
    setError(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Configuration</h3>
          <Badge variant="secondary" className="text-[10px] font-mono">JSON</Badge>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle className="h-3 w-3" />
              Saved
            </span>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleReset}>
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave} disabled={!!error}>
            <Save className="h-3 w-3" />
            Save
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      <div className="relative">
        <textarea
          value={config}
          onChange={(e) => handleChange(e.target.value)}
          className={cn(
            "w-full h-72 font-mono text-xs p-4 rounded-lg border bg-background/50 resize-none focus:outline-none focus:ring-1 transition-colors",
            error ? "border-red-500/50 focus:ring-red-500" : "border-border/50 focus:ring-ring"
          )}
          spellCheck={false}
        />
        {hasChanges && (
          <span className="absolute top-2 right-2 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
            Unsaved
          </span>
        )}
      </div>
    </div>
  )
}
