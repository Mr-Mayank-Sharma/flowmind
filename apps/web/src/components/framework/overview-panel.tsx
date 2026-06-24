"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Play, Square, RotateCcw, Globe, GitBranch, Server, Activity, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface FrameworkDetail {
  id: string
  name: string
  icon: string
  status: "running" | "stopped" | "error"
  port: number
  version: string
  pid: number | null
  description: string
  homepage: string
  docs: string
}

const frameworkDetails: Record<string, FrameworkDetail> = {
  ollama: {
    id: "ollama", name: "Ollama", icon: "🦙", status: "running", port: 11434, version: "0.3.12", pid: 28491,
    description: "Local LLM inference server. Run, manage, and serve open-source language models locally with GPU acceleration.",
    homepage: "https://ollama.ai", docs: "https://github.com/ollama/ollama",
  },
  "lm-studio": {
    id: "lm-studio", name: "LM Studio", icon: "🤖", status: "running", port: 1234, version: "0.2.29", pid: 28512,
    description: "Desktop application for running local LLMs. Provides an OpenAI-compatible API for model inference.",
    homepage: "https://lmstudio.ai", docs: "https://lmstudio.ai/docs",
  },
  comfyui: {
    id: "comfyui", name: "ComfyUI", icon: "🎨", status: "running", port: 8188, version: "0.2.4", pid: 28534,
    description: "Powerful node-based Stable Diffusion workflow editor and inference engine.",
    homepage: "https://github.com/comfyanonymous/ComfyUI", docs: "https://comfyui-wiki.com",
  },
  openclaw: {
    id: "openclaw", name: "OpenClaw", icon: "🦀", status: "stopped", port: 9090, version: "1.2.0", pid: null,
    description: "Open-source agent framework for building and orchestrating AI agents with tool-use capabilities.",
    homepage: "#", docs: "#",
  },
  hermes: {
    id: "hermes", name: "Hermes Agent", icon: "⚡", status: "running", port: 3001, version: "2.1.5", pid: 28567,
    description: "General-purpose AI agent runtime with tool registry, memory store, and multi-model support.",
    homepage: "#", docs: "#",
  },
  opencode: {
    id: "opencode", name: "OpenCode", icon: "⌨️", status: "error", port: 8080, version: "0.8.3", pid: null,
    description: "AI coding assistant that integrates with your editor for code generation, refactoring, and review.",
    homepage: "https://opencode.ai", docs: "https://opencode.ai/docs",
  },
  sd: {
    id: "sd", name: "Stable Diffusion", icon: "🖼️", status: "stopped", port: 7860, version: "1.9.4", pid: null,
    description: "Text-to-image generation using Stable Diffusion models with LoRA and ControlNet support.",
    homepage: "https://github.com/AUTOMATIC1111/stable-diffusion-webui", docs: "#",
  },
  localai: {
    id: "localai", name: "LocalAI", icon: "🧠", status: "running", port: 8080, version: "2.17.1", pid: 28589,
    description: "Open-source OpenAI alternative. Run LLMs, image generation, and audio models locally.",
    homepage: "https://localai.io", docs: "https://localai.io/docs",
  },
}

export function OverviewPanel({ frameworkId }: { frameworkId: string }) {
  const fw = frameworkDetails[frameworkId]

  if (!fw) return <div className="text-muted-foreground text-sm">Framework not found</div>

  const handleAction = (action: "start" | "stop" | "restart") => {
    console.log(`${action} ${fw.name}`)
  }

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

  const s = statusBadge[fw.status]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="text-3xl">{fw.icon}</div>
          <div>
            <h2 className="text-xl font-bold">{fw.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-lg">{fw.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn("h-8 text-xs gap-1.5", fw.status === "running" ? "text-amber-400 border-amber-500/30" : "text-emerald-400 border-emerald-500/30")}
            onClick={() => handleAction(fw.status === "running" ? "stop" : "start")}
          >
            {fw.status === "running" ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {fw.status === "running" ? "Stop" : "Start"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => handleAction("restart")}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restart
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={cn("rounded-lg border px-4 py-3", statusColor[fw.status])}>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("h-2 w-2 rounded-full", s.dot, fw.status === "running" && "animate-pulse")} />
            <span className="text-xs font-medium">Status</span>
          </div>
          <span className="text-sm font-semibold">{s.label}</span>
        </div>

        <InfoCard icon={<Server className="h-3.5 w-3.5" />} label="Port" value={String(fw.port)} />
        <InfoCard icon={<GitBranch className="h-3.5 w-3.5" />} label="Version" value={fw.version} />
        <InfoCard icon={<Activity className="h-3.5 w-3.5" />} label="PID" value={fw.pid ? String(fw.pid) : "N/A"} />

        {fw.homepage !== "#" && (
          <InfoCard
            icon={<Globe className="h-3.5 w-3.5" />}
            label="Homepage"
            value={fw.homepage}
            href={fw.homepage}
          />
        )}
        {fw.docs !== "#" && (
          <InfoCard
            icon={<ExternalLink className="h-3.5 w-3.5" />}
            label="Documentation"
            value="View docs"
            href={fw.docs}
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
