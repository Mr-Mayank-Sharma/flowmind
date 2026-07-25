"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Play, Square, RotateCcw, Globe, GitBranch, Server, Activity, ExternalLink, Bot, Sparkles, Brush, Shield, Zap, Keyboard, Image as ImageIcon, Brain, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, type Framework } from "@/lib/api"
import type { ReactNode } from "react"

const frameworkIconMap: Record<string, ReactNode> = {
  ollama: <Bot className="h-8 w-8 text-foreground" />,
  "lm-studio": <Bot className="h-8 w-8 text-foreground" />,
  comfyui: <Brush className="h-8 w-8 text-foreground" />,
  openclaw: <Shield className="h-8 w-8 text-foreground" />,
  hermes: <Zap className="h-8 w-8 text-foreground" />,
  opencode: <Keyboard className="h-8 w-8 text-foreground" />,
  sd: <ImageIcon className="h-8 w-8 text-foreground" />,
  localai: <Brain className="h-8 w-8 text-foreground" />,
}

const frameworkDescriptions: Record<string, { description: string; homepage: string; docs: string }> = {
  ollama: {
    description: "Local LLM inference server. Run, manage, and serve open-source language models locally with GPU acceleration.",
    homepage: "https://ollama.ai",
    docs: "https://github.com/ollama/ollama",
  },
  "lm-studio": {
    description: "Desktop application for running local LLMs. Provides an OpenAI-compatible API for model inference.",
    homepage: "https://lmstudio.ai",
    docs: "https://lmstudio.ai/docs",
  },
  comfyui: {
    description: "Powerful node-based Stable Diffusion workflow editor and inference engine.",
    homepage: "https://github.com/comfyanonymous/ComfyUI",
    docs: "https://comfyui-wiki.com",
  },
  openclaw: {
    description: "Open-source agent framework for building and orchestrating AI agents with tool-use capabilities.",
    homepage: "#",
    docs: "#",
  },
  hermes: {
    description: "General-purpose AI agent runtime with tool registry, memory store, and multi-model support.",
    homepage: "#",
    docs: "#",
  },
  opencode: {
    description: "AI coding assistant that integrates with your editor for code generation, refactoring, and review.",
    homepage: "https://opencode.ai",
    docs: "https://opencode.ai/docs",
  },
  sd: {
    description: "Text-to-image generation using Stable Diffusion models with LoRA and ControlNet support.",
    homepage: "https://github.com/AUTOMATIC1111/stable-diffusion-webui",
    docs: "#",
  },
  localai: {
    description: "Open-source OpenAI alternative. Run LLMs, image generation, and audio models locally.",
    homepage: "https://localai.io",
    docs: "https://localai.io/docs",
  },
}

export function OverviewPanel({ frameworkId }: { frameworkId: string }) {
  const [framework, setFramework] = useState<Framework | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchFramework = useCallback(async () => {
    try {
      const frameworks = await api.system.getFrameworks()
      const fw = frameworks.find((f) => f.id === frameworkId)
      setFramework(fw ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load framework")
    } finally {
      setLoading(false)
    }
  }, [frameworkId])

  useEffect(() => {
    fetchFramework()
  }, [fetchFramework])

  const handleAction = async (action: "start" | "stop" | "restart") => {
    setActionLoading(true)
    try {
      if (action === "start") {
        await api.system.startFramework(frameworkId)
      } else if (action === "stop") {
        await api.system.stopFramework(frameworkId)
      } else {
        await api.system.stopFramework(frameworkId)
        await new Promise((r) => setTimeout(r, 1000))
        await api.system.startFramework(frameworkId)
      }
      await fetchFramework()
    } catch (e) {
      setError(e instanceof Error ? e.message : `${action} failed`)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!framework) {
    return <div className="text-muted-foreground text-sm py-8 text-center">Framework not found. It may not be detected on this system.</div>
  }

  const meta = frameworkDescriptions[frameworkId] ?? { description: framework.description, homepage: "#", docs: "#" }
  const icon = frameworkIconMap[frameworkId] ?? <Bot className="h-8 w-8 text-foreground" />

  const statusColor = {
    running: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    stopped: "text-muted-foreground bg-muted border-border",
    error: "text-red-400 bg-red-500/10 border-red-500/30",
  }

  const statusBadge = {
    running: { label: "Running", dot: "bg-emerald-500" },
    stopped: { label: "Stopped", dot: "bg-muted-foreground" },
    error: { label: "Error", dot: "bg-red-500" },
  }

  const s = statusBadge[framework.status]

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">{error}</div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="text-3xl">{icon}</div>
          <div>
            <h2 className="text-xl font-bold">{framework.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-lg">{meta.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn("h-8 text-xs gap-1.5", framework.status === "running" ? "text-amber-400 border-amber-500/30" : "text-emerald-400 border-emerald-500/30")}
            onClick={() => handleAction(framework.status === "running" ? "stop" : "start")}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : framework.status === "running" ? (
              <Square className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {framework.status === "running" ? "Stop" : "Start"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => handleAction("restart")}
            disabled={actionLoading}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restart
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={cn("rounded-lg border px-4 py-3", statusColor[framework.status])}>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("h-2 w-2 rounded-full", s.dot, framework.status === "running" && "animate-pulse")} />
            <span className="text-xs font-medium">Status</span>
          </div>
          <span className="text-sm font-semibold">{s.label}</span>
        </div>

        <InfoCard icon={<Server className="h-3.5 w-3.5" />} label="Port" value={String(framework.port)} />
        <InfoCard icon={<GitBranch className="h-3.5 w-3.5" />} label="Version" value={framework.version} />
        <InfoCard icon={<Activity className="h-3.5 w-3.5" />} label="PID" value={framework.pid ? String(framework.pid) : "N/A"} />

        {framework.models > 0 && (
          <InfoCard icon={<Sparkles className="h-3.5 w-3.5" />} label="Models" value={`${framework.models} installed`} />
        )}

        {meta.homepage !== "#" && (
          <InfoCard
            icon={<Globe className="h-3.5 w-3.5" />}
            label="Homepage"
            value={meta.homepage}
            href={meta.homepage}
          />
        )}
        {meta.docs !== "#" && (
          <InfoCard
            icon={<ExternalLink className="h-3.5 w-3.5" />}
            label="Documentation"
            value="View docs"
            href={meta.docs}
          />
        )}
      </div>
    </div>
  )
}

function InfoCard({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const content = (
    <div className="rounded-lg border border-border/50 bg-background/30 px-4 py-3 hover:bg-accent/20 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-mono font-semibold">{value}</span>
    </div>
  )
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer">{content}</a>
  return content
}
