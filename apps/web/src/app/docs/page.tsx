import { Metadata } from "next"
import { Terminal, Download, BookOpen, Server, Cpu, Globe, ArrowRight, CheckCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "FlowMind AI OS — Documentation",
  description: "Install, configure, and use FlowMind AI Operating System — your local AI infrastructure platform.",
}

const quickLinks = [
  { title: "Quick Install", icon: Terminal, desc: "One-command setup for Linux/macOS", href: "#install" },
  { title: "CLI Reference", icon: BookOpen, desc: "All flowmind commands and options", href: "#cli" },
  { title: "Architecture", icon: Server, desc: "How the AI OS is structured", href: "#architecture" },
  { title: "Deployment", icon: Globe, desc: "Production deployment guides", href: "#deploy" },
]

const installSteps = [
  { title: "Prerequisites", cmd: "", items: ["Node.js 22+", "pnpm 9+", "PostgreSQL 16", "Python 3.11+", "Ollama (optional)"] },
  { title: "Quick Install (Recommended)", cmd: "curl -fsSL https://flowmind.ai/install.sh | bash",
    items: ["Installs all dependencies", "Sets up PostgreSQL database", "Builds all packages", "Creates systemd services", "Links CLI globally"] },
  { title: "Manual Install", cmd: "", items: ["git clone https://github.com/Mr-Mayank-Sharma/flowmind.git", "cd flowmind && pnpm install", "pnpm db:generate && pnpm db:migrate && pnpm db:seed", "pnpm build"] },
  { title: "Start Services", cmd: "bash ~/.flowmind/flowmind.sh",
    items: ["Web UI at http://localhost:3000", "API at http://localhost:3001", "Runtime at http://localhost:8001"] },
]

const cliCommands = [
  { cmd: "flowmind", desc: "Interactive help and status" },
  { cmd: "flowmind chat start", desc: "Start interactive chat with an AI agent" },
  { cmd: "flowmind model list", desc: "List all AI models across providers" },
  { cmd: "flowmind model configure -p openai -k sk-...", desc: "Configure an API key for a provider" },
  { cmd: "flowmind agent list", desc: "List all AI agents" },
  { cmd: "flowmind agent create", desc: "Create a new AI agent" },
  { cmd: "flowmind pipeline list", desc: "List AI pipelines" },
  { cmd: "flowmind mcp list", desc: "List MCP tool servers" },
  { cmd: "flowmind interactive", desc: "Launch interactive REPL shell" },
  { cmd: "flowmind --help", desc: "Show all available commands" },
]

const architecture = [
  {
    title: "Web UI (Next.js 14)",
    desc: "Modern dashboard for managing AI infrastructure — models, agents, pipelines, files, system monitoring, and chat.",
    port: "3000",
  },
  {
    title: "API Server (Fastify + tRPC)",
    desc: "Type-safe API with JWT auth, rate limiting, PostgreSQL integration, and WebSocket support for streaming.",
    port: "3001",
  },
  {
    title: "Agent Runtime (Python FastAPI)",
    desc: "Real AI inference engine with Ollama, HuggingFace, OpenAI, Anthropic, and Google providers. SSE streaming.",
    port: "8001",
  },
  {
    title: "CLI (Commander.js)",
    desc: "Terminal-based AI agent framework with interactive REPL, agent management, model configuration, and chat.",
    bin: "flowmind",
  },
  {
    title: "Ollama (Local LLM)",
    desc: "Local LLM inference server for running open-source models. Auto-detected and managed by FlowMind.",
    port: "11434",
  },
]

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b border-border/50 bg-surface">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            FlowMind <span className="gradient-text">AI OS</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            The open-source AI Operating System. Install on any machine, manage local and cloud AI models,
            build agents and pipelines, all from a beautiful web UI or your terminal.
          </p>

          <div className="flex items-center justify-center gap-4 mt-8">
            <a href="#install"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              <Download className="h-4 w-4" />
              Install Now
            </a>
            <a href="#cli"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border bg-background font-medium hover:bg-accent transition-colors"
            >
              <Terminal className="h-4 w-4" />
              CLI Reference
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-16">
        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <a key={link.title} href={link.href}
                className="rounded-lg border border-border/50 bg-surface p-4 hover:border-primary/40 transition-colors group"
              >
                <Icon className="h-5 w-5 text-primary mb-2" />
                <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{link.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{link.desc}</p>
              </a>
            )
          })}
        </div>

        {/* Architecture */}
        <section id="architecture">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Architecture
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {architecture.map((arc) => (
              <div key={arc.title} className="rounded-lg border border-border/50 bg-surface p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold">{arc.title}</h3>
                  {arc.port && (
                    <span className="text-xs font-mono text-muted-foreground bg-background px-2 py-0.5 rounded">
                      :{arc.port}
                    </span>
                  )}
                  {arc.bin && (
                    <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {arc.bin}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{arc.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Install */}
        <section id="install">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Installation
          </h2>

          <div className="rounded-lg border border-border/50 bg-surface p-6 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Terminal className="h-5 w-5 text-emerald-500" />
              <h3 className="font-semibold">One-Command Install</h3>
            </div>
            <div className="bg-background rounded-lg p-4 font-mono text-sm">
              <span className="text-muted-foreground"># FlowMind AI OS — Install on any Linux/macOS machine</span><br />
              <span className="text-emerald-400">curl -fsSL</span> https://flowmind.ai/install.sh <span className="text-emerald-400">| bash</span>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              This installs Node.js, pnpm, PostgreSQL, Ollama, clones the repo, builds everything,
              seeds the database, creates systemd services, and links the CLI globally.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {installSteps.map((step) => (
              <div key={step.title} className="rounded-lg border border-border/50 bg-surface p-5">
                <h3 className="font-semibold text-sm mb-3">{step.title}</h3>
                {step.cmd && (
                  <div className="bg-background rounded p-2.5 font-mono text-xs mb-3 text-emerald-400">
                    {step.cmd}
                  </div>
                )}
                <ul className="space-y-1.5">
                  {step.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <ArrowRight className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* CLI Reference */}
        <section id="cli">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            CLI Reference
          </h2>

          <div className="rounded-lg border border-border/50 bg-surface overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50 bg-background/50">
              <p className="text-xs text-muted-foreground">
                The <code className="text-primary font-mono">flowmind</code> CLI is a terminal AI agent framework
                that lets you manage your entire AI OS from the command line.
              </p>
            </div>
            <div className="divide-y divide-border/50">
              {cliCommands.map((cmd) => (
                <div key={cmd.cmd} className="flex items-start gap-4 px-5 py-3 hover:bg-accent/30 transition-colors">
                  <code className="text-sm font-mono text-emerald-400 shrink-0 min-w-[240px]">
                    {cmd.cmd}
                  </code>
                  <p className="text-sm text-muted-foreground">{cmd.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-border/50 bg-surface p-5">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              Interactive REPL Mode
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              Launch an interactive shell with <code className="font-mono text-primary">flowmind interactive</code> or <code className="font-mono text-primary">flowmind i</code>.
              Commands available in the REPL:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {["/help", "/agents", "/agent <id>", "/models", "/pipelines", "/mcp", "/context", "/governance", "/status", "/exit"].map((c) => (
                <code key={c} className="font-mono text-muted-foreground bg-background rounded px-2 py-1">{c}</code>
              ))}
            </div>
          </div>
        </section>

        {/* Deployment */}
        <section id="deploy">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Production Deployment
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border/50 bg-surface p-5">
              <div className="flex items-center gap-2 mb-2">
                <Server className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">systemd (Linux)</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Services auto-installed by install.sh. Manual control:</p>
              <div className="bg-background rounded p-2.5 font-mono text-xs space-y-1">
                <div>sudo systemctl start flowmind-api</div>
                <div>sudo systemctl start flowmind-web</div>
                <div>sudo systemctl start flowmind-runtime</div>
                <div>sudo systemctl enable flowmind.target</div>
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-surface p-5">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Docker Compose</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Deploy with PostgreSQL + all services:</p>
              <div className="bg-background rounded p-2.5 font-mono text-xs space-y-1">
                <div>cd deploy</div>
                <div>docker compose up -d</div>
                <div className="text-muted-foreground"># Web: localhost:3000</div>
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-surface p-5">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Environment Variables</h3>
              </div>
              <div className="bg-background rounded p-2.5 font-mono text-xs space-y-1">
                <div><span className="text-muted-foreground">DATABASE_URL=</span>postgresql://flowmind:flowmind@localhost:5432/flowmind</div>
                <div><span className="text-muted-foreground">JWT_SECRET=</span>your-secret-key</div>
                <div><span className="text-muted-foreground">AGENT_RUNTIME_URL=</span>http://127.0.0.1:8001</div>
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-surface p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <h3 className="font-semibold text-sm">Health Checks</h3>
              </div>
              <div className="bg-background rounded p-2.5 font-mono text-xs space-y-1">
                <div>curl http://localhost:3001/trpc/health   <span className="text-emerald-400"># API</span></div>
                <div>curl http://localhost:8001/health         <span className="text-emerald-400"># Runtime</span></div>
                <div>curl http://localhost:3000                <span className="text-emerald-400"># Web UI</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-border/50 pt-8 text-center text-xs text-muted-foreground">
          <p>FlowMind AI OS v0.1.0 — Open source under MIT License</p>
          <p className="mt-1">Built with Next.js, Fastify, tRPC, Python, and Ollama</p>
        </div>
      </div>
    </div>
  )
}
