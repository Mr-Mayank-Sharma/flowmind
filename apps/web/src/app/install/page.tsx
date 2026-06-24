"use client"

import { useState, useCallback } from "react"
import { Terminal, Copy, Check, Download, Server, Globe, Cpu, ArrowRight, Github, Package, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const INSTALL_CMD = "curl -fsSL https://flowmind.ai/install.sh | bash"

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  )
}

const platforms = {
  linux: {
    name: "Linux",
    icon: Terminal,
    install: INSTALL_CMD,
    steps: [
      "Open a terminal",
      "Run the one-command install",
      "The script detects your distro (Ubuntu/Debian/Fedora/Arch) and installs everything",
      "Access FlowMind at http://localhost:3000",
      "Or run: flowmind (CLI) or flowmind-desktop.sh (Desktop app)",
    ],
  },
  macos: {
    name: "macOS",
    icon: Terminal,
    install: INSTALL_CMD,
    steps: [
      "Open Terminal",
      "Run the one-command install",
      "The script installs Homebrew dependencies, sets up PostgreSQL, and builds FlowMind",
      "Access FlowMind at http://localhost:3000",
      "Or run: flowmind (CLI) or flowmind-desktop.sh (Desktop app)",
    ],
  },
  windows: {
    name: "Windows",
    icon: Terminal,
    install: "wsl --install -d Ubuntu && curl -fsSL https://flowmind.ai/install.sh | bash",
    steps: [
      "Install WSL 2 with Ubuntu from Microsoft Store",
      "Open Ubuntu terminal",
      "Run the one-command install (curl | bash)",
      "Access FlowMind at http://localhost:3000",
      "Desktop app: run flowmind-desktop.sh in WSL",
    ],
  },
}

const whatsIncluded = [
  { icon: Server, title: "Web Dashboard", desc: "Full AI infrastructure management UI" },
  { icon: Cpu, title: "AI Model Hub", desc: "23 models across 5 providers (Ollama, OpenAI, Anthropic, etc.)" },
  { icon: Terminal, title: "CLI Tool", desc: "8 commands + interactive REPL for AI agent management" },
  { icon: Globe, title: "API Server", desc: "Type-safe tRPC API with JWT auth and real-time streaming" },
  { icon: Package, title: "Agent Runtime", desc: "Real AI inference with Python FastAPI (port 8001)" },
  { icon: Github, title: "Open Source", desc: "MIT licensed — fork, modify, deploy anywhere" },
]

const requirements = [
  { name: "Node.js", ver: "22+", desc: "JavaScript runtime" },
  { name: "pnpm", ver: "9+", desc: "Fast package manager" },
  { name: "PostgreSQL", ver: "16", desc: "Database" },
  { name: "Python", ver: "3.11+", desc: "For AI agent runtime" },
  { name: "Git", ver: "Any", desc: "Source control" },
  { name: "Ollama", ver: "Latest", desc: "Local LLMs (optional)" },
]

export default function InstallPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/50 bg-surface/50 px-4 pt-24 pb-16">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-6">
            <Download className="h-3.5 w-3.5" />
            One-Command Install
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            Install <span className="gradient-text">FlowMind</span> in One Command
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Get the full AI Operating System running on your machine in seconds.
            Local LLMs, cloud providers, agents, pipelines — everything included.
          </p>

          <div className="max-w-2xl mx-auto">
            <div className="rounded-xl border border-primary/20 bg-background p-1">
              <div className="flex items-center justify-between bg-surface rounded-lg px-5 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <Terminal className="h-5 w-5 text-emerald-500 shrink-0" />
                  <code className="text-sm md:text-base font-mono text-emerald-400 truncate">
                    {INSTALL_CMD}
                  </code>
                </div>
                <CopyButton text={INSTALL_CMD} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              Linux & macOS
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              No root required
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              MIT License
            </span>
          </div>
        </div>
      </section>

      {/* Platform Tabs */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">Platform Guides</h2>
        <Tabs defaultValue="linux" className="w-full">
          <TabsList className="w-full justify-center mb-8">
            {Object.entries(platforms).map(([key, platform]) => {
              const Icon = platform.icon
              return (
                <TabsTrigger key={key} value={key} className="gap-2">
                  <Icon className="h-4 w-4" />
                  {platform.name}
                </TabsTrigger>
              )
            })}
          </TabsList>
          {Object.entries(platforms).map(([key, platform]) => (
            <TabsContent key={key} value={key}>
              <div className="rounded-xl border border-border/50 bg-surface p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Terminal className="h-5 w-5 text-emerald-500" />
                  <h3 className="font-semibold">Install on {platform.name}</h3>
                </div>
                <div className="rounded-lg bg-background p-4 font-mono text-sm mb-6 flex items-center justify-between gap-4">
                  <code className="text-emerald-400 truncate text-xs md:text-sm">{platform.install}</code>
                  <CopyButton text={platform.install} />
                </div>
                <ol className="space-y-3">
                  {platform.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </section>

      {/* What's Included */}
      <section className="border-t border-border/50 bg-surface/30 py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8 text-center">What&apos;s Included</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {whatsIncluded.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="rounded-xl border border-border/50 bg-surface p-5 hover:border-primary/20 transition-colors">
                  <Icon className="h-5 w-5 text-primary mb-3" />
                  <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">Requirements</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {requirements.map((req) => (
            <div key={req.name} className="rounded-lg border border-border/50 bg-surface p-4 flex items-start gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
                <span className="text-xs font-bold text-primary">{req.ver}</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm">{req.name}</h3>
                <p className="text-xs text-muted-foreground">{req.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/50 bg-surface/50 py-16 text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-3">Ready to get started?</h2>
          <p className="text-muted-foreground mb-6">
            Join the AI infrastructure revolution. Run everything locally, own your data.
          </p>
          <div className="flex items-center justify-center gap-4">
            <a href="/docs" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
              <BookOpen className="h-4 w-4" />
              Read the Docs
            </a>
            <a href="https://github.com/Mr-Mayank-Sharma/flowmind" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border bg-background font-medium hover:bg-accent transition-colors"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 px-4 text-center text-xs text-muted-foreground">
        <p>FlowMind AI OS v0.1.0 — Open source under MIT License</p>
      </footer>
    </div>
  )
}

function BookOpen(props: React.ComponentProps<"svg">) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}
