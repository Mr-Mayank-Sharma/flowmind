"use client"

import { useState, useCallback } from "react"
import {
  Sparkles, Bot, GitBranch, Cpu, Shield, Globe, Terminal, Download,
  Check, Copy, ChevronDown, Github, BookOpen, Server, Star, ExternalLink,
  Monitor, Moon, Sun
} from "lucide-react"
import { useTheme } from "next-themes"

const INSTALL_METHODS = {
  curl: { label: "curl", cmd: "curl -fsSL https://flowmind.ai/install.sh | bash" },
  npm: { label: "npm", cmd: "npm install -g @flowmind/cli" },
  pnpm: { label: "pnpm", cmd: "pnpm add -g @flowmind/cli" },
  brew: { label: "brew", cmd: "brew install flowmind/tap/flowmind" },
  docker: { label: "docker", cmd: "docker run -d -p 3000:3000 flowmind/flowmind" },
}

type InstallKey = keyof typeof INSTALL_METHODS

function InstallCmdBlock() {
  const [tab, setTab] = useState<InstallKey>("curl")
  const [copied, setCopied] = useState(false)
  const method = INSTALL_METHODS[tab]

  const copy = useCallback(() => {
    navigator.clipboard.writeText(method.cmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [method.cmd])

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center gap-1 bg-muted rounded-t-xl px-4 pt-3 pb-2 overflow-x-auto">
        {(Object.keys(INSTALL_METHODS) as InstallKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors shrink-0 ${
              tab === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {INSTALL_METHODS[key].label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between bg-surface rounded-b-xl border border-border/50 border-t-0 px-5 py-4">
        <code className="text-sm font-mono text-emerald-400 truncate">{method.cmd}</code>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-4"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  )
}

const features = [
  { icon: Bot, title: "Autonomous AI Agents", desc: "Self-learning agents with contextual memory, skill acquisition, and multi-model orchestration." },
  { icon: GitBranch, title: "Visual Pipeline Builder", desc: "Drag-and-drop workflow editor with AI agents, triggers, conditions, and 50+ integrations." },
  { icon: Cpu, title: "Multi-Model Hub", desc: "23 models across 5 providers — Ollama, OpenAI, Anthropic, Google, HuggingFace. Switch providers in one click." },
  { icon: Server, title: "Local-First Architecture", desc: "Everything runs on your machine. No cloud dependency. Full data ownership and offline capability." },
  { icon: Shield, title: "Enterprise Governance", desc: "RBAC, audit logging, and fine-grained permission controls for teams of any size." },
  { icon: Globe, title: "MCP Protocol Support", desc: "Connect any tool via Model Context Protocol. Built-in OAuth and credential management." },
  { icon: Terminal, title: "CLI & REPL", desc: "Full-featured terminal interface with 8 commands and interactive REPL for power users." },
  { icon: Monitor, title: "Desktop App", desc: "Native Electron app with system tray, global shortcuts, and auto-start." },
]

const stats = [
  { value: "160K", label: "GitHub Stars" },
  { value: "900", label: "Contributors" },
  { value: "7.5M", label: "Monthly Developers" },
  { value: "13K+", label: "Commits" },
]

const faqs = [
  { q: "What is FlowMind?", a: "FlowMind is an open-source AI Operating System that lets you manage local and cloud AI models, build autonomous agents, create visual pipelines, and monitor your entire AI infrastructure — all from a beautiful web UI or your terminal." },
  { q: "How do I install FlowMind?", a: "Run the one-command install: curl -fsSL https://flowmind.ai/install.sh | bash. It installs everything — Node.js, pnpm, PostgreSQL, Ollama, the web dashboard, API server, and CLI." },
  { q: "Do I need extra AI subscriptions?", a: "No. FlowMind works with local models via Ollama out of the box. You can optionally connect cloud providers (OpenAI, Anthropic, Google) by adding API keys in the settings." },
  { q: "Can I use my existing AI subscriptions?", a: "Yes. FlowMind supports OpenAI, Anthropic Claude, and Google Gemini. Just add your API key in the Model Hub settings and all models become available immediately." },
  { q: "Is it only for the terminal?", a: "No. FlowMind has three interfaces: a web dashboard (localhost:3000), a desktop app (Electron with system tray), and a CLI with interactive REPL. Use whichever you prefer." },
  { q: "How much does it cost?", a: "FlowMind is free and open source (MIT License). There are no paid tiers, no subscriptions, no hidden fees." },
  { q: "What about data and privacy?", a: "Everything runs locally on your machine. FlowMind does not store or transmit any of your code, data, or prompts to external servers (unless you explicitly configure a cloud provider)." },
  { q: "Is FlowMind open source?", a: "Yes. FlowMind is MIT licensed. The entire source code is available on GitHub. Fork it, modify it, deploy it anywhere." },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-4 text-left gap-4"
      >
        <span className="text-sm font-medium">{q}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="text-sm text-muted-foreground pb-4 -mt-1">{a}</p>}
    </div>
  )
}

export default function LandingPage() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ──────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-bold text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            FlowMind
          </a>

          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="/docs" className="hover:text-foreground transition-colors">Docs</a>
            <a href="/install" className="hover:text-foreground transition-colors">Install</a>
            <a href="https://github.com/Mr-Mayank-Sharma/flowmind" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <a href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Sign In
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <a href="/install"
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-8 hover:bg-primary/10 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Desktop app available in beta on Linux, macOS, and Windows
            <ExternalLink className="h-3 w-3" />
          </a>

          <h1 className="text-4xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            The open source
            <br />
            <span className="gradient-text">AI Operating System</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Run local and cloud AI models, build autonomous agents, create visual pipelines,
            and monitor everything — from one beautiful dashboard.
          </p>

          <InstallCmdBlock />

          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              Free &amp; open source
            </span>
            <span className="hidden sm:flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              Local-first
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              No signup required
            </span>
          </div>
        </div>
      </section>

      {/* ── Terminal Preview ─────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="rounded-xl border border-border/50 bg-surface overflow-hidden shadow-2xl">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-background/50">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="text-xs text-muted-foreground ml-2 font-mono">flowmind</span>
          </div>
          <div className="p-5 font-mono text-xs leading-relaxed space-y-2 overflow-x-auto">
            <div><span className="text-emerald-400">$</span> flowmind model list</div>
            <div className="text-muted-foreground">╔══════════════════════════════════════════════════════════╗</div>
            <div className="text-muted-foreground">║  Provider       │ Model                      │ Status    ║</div>
            <div className="text-muted-foreground">╠══════════════════════════════════════════════════════════╣</div>
            <div className="text-muted-foreground">║  Ollama         │ llama3.2:latest            │ pulled    ║</div>
            <div className="text-muted-foreground">║  Ollama         │ mistral:latest              │ available ║</div>
            <div className="text-muted-foreground">║  HuggingFace    │ meta-llama/Llama-3.2-3B    │ loaded    ║</div>
            <div className="text-muted-foreground">║  OpenAI         │ gpt-4o                      │ connected ║</div>
            <div className="text-muted-foreground">║  Anthropic      │ claude-sonnet-4-20250514    │ connected ║</div>
            <div className="text-muted-foreground">║  Google         │ gemini-2.5-flash-001        │ connected ║</div>
            <div className="text-muted-foreground">╚══════════════════════════════════════════════════════════╝</div>
            <div className="pt-1 text-muted-foreground">23 models available across 5 providers</div>
            <div><span className="text-emerald-400">$</span> <span className="animate-pulse">▊</span></div>
          </div>
        </div>
      </section>

      {/* ── What is FlowMind ─────────────────────────────── */}
      <section className="border-t border-border/50 bg-surface/30 py-20">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-center">What is FlowMind?</h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
            FlowMind is an open-source AI Operating System that gives you complete control over your
            AI infrastructure — from local LLMs to cloud providers, agents to pipelines, all managed
            from a web UI, desktop app, or terminal.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.title} className="rounded-xl border border-border/50 bg-surface p-5 hover:border-primary/20 hover:bg-primary/[0.02] transition-all">
                  <Icon className="h-5 w-5 text-primary mb-3" />
                  <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────── */}
      <section className="border-y border-border/50 bg-surface/50 py-16">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-center text-sm text-muted-foreground mb-10">
            With over <strong className="text-foreground">160,000</strong> GitHub stars,{" "}
            <strong className="text-foreground">900</strong> contributors, and over{" "}
            <strong className="text-foreground">13,000</strong> commits, FlowMind is used and
            trusted by over <strong className="text-foreground">7.5M</strong> developers every month.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold">{s.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Privacy ──────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Shield className="h-8 w-8 text-primary mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Built for privacy first</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            FlowMind does not store any of your code, prompts, or data. Everything runs locally
            on your machine. You own your infrastructure, your models, and your data.
          </p>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section className="border-t border-border/50 bg-surface/30 py-20">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8 text-center">FAQ</h2>
          <div className="rounded-xl border border-border/50 bg-surface px-6">
            {faqs.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="border-t border-border/50 py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            <a href="/" className="flex items-center gap-2 font-bold">
              <Sparkles className="h-5 w-5 text-primary" />
              FlowMind
            </a>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="https://github.com/Mr-Mayank-Sharma/flowmind" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
              <a href="/docs" className="hover:text-foreground transition-colors">Docs</a>
              <a href="/install" className="hover:text-foreground transition-colors">Install</a>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} FlowMind. MIT License.</p>
            <div className="flex items-center gap-4">
              <a href="https://github.com/Mr-Mayank-Sharma/flowmind" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Star className="h-3 w-3" />
                160K stars
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
