import { Terminal, Download, BookOpen, Server, Cpu, Globe, ArrowRight, CheckCircle, MessageSquare, Workflow, Brain, Shield, Zap, Box, Database, Users, CreditCard, Settings, Clock, Lock } from "lucide-react"

export const metadata = {
  title: "FlowMind AI OS — Documentation",
  description: "Complete documentation for FlowMind AI Operating System — install, configure, use, and deploy.",
}

const sections = [
  { id: "getting-started", label: "Getting Started", icon: BookOpen },
  { id: "installation", label: "Installation", icon: Download },
  { id: "architecture", label: "Architecture", icon: Server },
  { id: "cli", label: "CLI Reference", icon: Terminal },
  { id: "chat", label: "Chat Guide", icon: MessageSquare },
  { id: "pipelines", label: "Pipelines", icon: Workflow },
  { id: "models", label: "Model Management", icon: Brain },
  { id: "agents", label: "Agents", icon: Zap },
  { id: "frameworks", label: "Frameworks", icon: Box },
  { id: "knowledge", label: "Knowledge Base", icon: Database },
  { id: "security", label: "Security", icon: Shield },
  { id: "deployment", label: "Deployment", icon: Globe },
]

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background flex">
      <nav className="hidden lg:block w-64 shrink-0 border-r border-border/50 bg-surface h-screen sticky top-0 overflow-y-auto">
        <div className="p-4 border-b border-border/50">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Documentation
          </h2>
        </div>
        <div className="p-2 space-y-0.5">
          {sections.map((sec) => {
            const Icon = sec.icon
            return (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className="flex items-center gap-2 px-3 py-2 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Icon className="h-3.5 w-3.5" />
                {sec.label}
              </a>
            )
          })}
        </div>
      </nav>

      <main className="flex-1 min-w-0">
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-16">

          {/* Hero */}
          <section>
            <h1 className="text-4xl font-bold tracking-tight mb-3">
              FlowMind <span className="gradient-text">AI OS</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              The open-source AI Operating System. Install on any machine, manage local and cloud AI models,
              build agents and pipelines, all from a beautiful web UI or your terminal.
            </p>
            <div className="flex items-center gap-3 mt-6">
              <a href="#installation"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Download className="h-4 w-4" />
                Install Now
              </a>
              <a href="#cli"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
              >
                <Terminal className="h-4 w-4" />
                CLI Reference
              </a>
            </div>
          </section>

          {/* Getting Started */}
          <section id="getting-started">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Getting Started
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>FlowMind AI OS is a comprehensive platform for running AI workloads on your own infrastructure. It provides:</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { icon: Brain, title: "Model Hub", desc: "Browse, pull, and manage 23+ models across 5 providers" },
                  { icon: MessageSquare, title: "AI Chat", desc: "Chat with any model, attach files, use tools" },
                  { icon: Workflow, title: "Pipeline Builder", desc: "Visual workflow editor with 22 node types" },
                  { icon: Server, title: "Framework Manager", desc: "Monitor and control 8+ AI frameworks" },
                  { icon: Database, title: "Knowledge Base", desc: "RAG-powered document search and indexing" },
                  { icon: Terminal, title: "CLI Tools", desc: "Full terminal-based AI agent framework" },
                ].map((feat) => {
                  const FeatIcon = feat.icon
                  return (
                    <div key={feat.title} className="rounded-lg border border-border/50 bg-surface p-4">
                      <FeatIcon className="h-4 w-4 text-primary mb-2" />
                      <h3 className="text-sm font-semibold mb-1">{feat.title}</h3>
                      <p className="text-xs">{feat.desc}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* Installation */}
          <section id="installation">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Installation
            </h2>
            <div className="space-y-4">
              <div className="rounded-lg border border-border/50 bg-surface p-5">
                <h3 className="font-semibold text-sm mb-2">Prerequisites</h3>
                <div className="flex flex-wrap gap-2">
                  {["Node.js 22+", "pnpm 9+", "PostgreSQL 16", "Python 3.11+", "Ollama (optional)"].map((p) => (
                    <span key={p} className="px-2.5 py-1 rounded-md bg-muted text-xs font-medium">{p}</span>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border/50 bg-surface p-5">
                <h3 className="font-semibold text-sm mb-3">Quick Install (Recommended)</h3>
                <div className="bg-background rounded-lg p-3 font-mono text-sm mb-3">
                  <span className="text-muted-foreground"># One command setup</span><br />
                  <span className="text-emerald-400">curl -fsSL</span> https://raw.githubusercontent.com/Mr-Mayank-Sharma/flowmind/main/install.sh <span className="text-emerald-400">| bash</span>
                </div>
                <ul className="space-y-1.5">
                  {["Installs all dependencies", "Sets up PostgreSQL", "Builds all packages", "Creates systemd services", "Links CLI globally"].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-border/50 bg-surface p-5">
                <h3 className="font-semibold text-sm mb-3">Manual Install</h3>
                <div className="bg-background rounded-lg p-3 font-mono text-xs space-y-1">
                  <div>git clone https://github.com/Mr-Mayank-Sharma/flowmind.git</div>
                  <div>cd flowmind && pnpm install</div>
                  <div>pnpm db:generate && pnpm db:migrate && pnpm db:seed</div>
                  <div>pnpm build</div>
                </div>
              </div>

              <div className="rounded-lg border border-border/50 bg-surface p-5">
                <h3 className="font-semibold text-sm mb-3">Start Services</h3>
                <div className="bg-background rounded-lg p-3 font-mono text-xs space-y-1">
                  <div>bash ~/.flowmind/flowmind.sh</div>
                  <div className="text-muted-foreground"># Web UI at http://localhost:3000</div>
                  <div className="text-muted-foreground"># API at http://localhost:3001</div>
                  <div className="text-muted-foreground"># Runtime at http://localhost:8001</div>
                </div>
              </div>
            </div>
          </section>

          {/* Architecture */}
          <section id="architecture">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Architecture
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Globe, title: "Web UI (Next.js 14)", desc: "Modern dashboard for managing AI infrastructure — models, agents, pipelines, files, system monitoring, and chat.", meta: ":3000" },
                { icon: Server, title: "API Server (Fastify + tRPC)", desc: "Type-safe API with JWT auth, rate limiting, PostgreSQL integration, and streaming support.", meta: ":3001" },
                { icon: Cpu, title: "Agent Runtime (Python FastAPI)", desc: "AI inference engine with Ollama, HuggingFace, OpenAI, Anthropic, and Google providers. SSE streaming.", meta: ":8001" },
                { icon: Terminal, title: "CLI (Commander.js)", desc: "Terminal-based AI agent framework with interactive REPL, agent management, model configuration, and chat.", meta: "flowmind" },
                { icon: Brain, title: "Ollama (Local LLM)", desc: "Local LLM inference server for running open-source models. Auto-detected and managed by FlowMind.", meta: ":11434" },
              ].map((arc) => {
                const ArcIcon = arc.icon
                return (
                  <div key={arc.title} className="rounded-lg border border-border/50 bg-surface p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ArcIcon className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-sm">{arc.title}</h3>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground bg-background px-2 py-0.5 rounded">{arc.meta}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{arc.desc}</p>
                  </div>
                )
              })}
            </div>
          </section>

          {/* CLI Reference */}
          <section id="cli">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              CLI Reference
            </h2>
            <div className="rounded-lg border border-border/50 bg-surface overflow-hidden">
              <div className="px-5 py-3 border-b border-border/50 bg-background/50">
                <p className="text-xs text-muted-foreground">
                  The <code className="text-primary font-mono">flowmind</code> CLI lets you manage your entire AI OS from the terminal.
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {[
                  { cmd: "flowmind", desc: "Interactive help and status" },
                  { cmd: "flowmind chat start", desc: "Start interactive chat with an AI agent" },
                  { cmd: "flowmind model list", desc: "List all AI models across providers" },
                  { cmd: "flowmind model configure -p openai -k sk-...", desc: "Configure an API key for a provider" },
                  { cmd: "flowmind agent list", desc: "List all AI agents" },
                  { cmd: "flowmind agent create", desc: "Create a new AI agent" },
                  { cmd: "flowmind pipeline list", desc: "List AI pipelines" },
                  { cmd: "flowmind pipeline run <id>", desc: "Execute a pipeline" },
                  { cmd: "flowmind mcp list", desc: "List MCP tool servers" },
                  { cmd: "flowmind interactive", desc: "Launch interactive REPL shell" },
                  { cmd: "flowmind --help", desc: "Show all available commands" },
                ].map((c) => (
                  <div key={c.cmd} className="flex items-start gap-4 px-5 py-3 hover:bg-accent/30 transition-colors">
                    <code className="text-sm font-mono text-emerald-400 shrink-0 min-w-[220px]">{c.cmd}</code>
                    <p className="text-sm text-muted-foreground">{c.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Chat Guide */}
          <section id="chat">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Chat Guide
            </h2>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>FlowMind Chat provides an AI-powered conversational interface. Key features:</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { title: "Multi-Model Support", desc: "Switch between any available model - local (Ollama) or cloud (OpenAI, Anthropic, Google)" },
                  { title: "Credential Management", desc: "Configure API keys for cloud providers inline when selecting a model" },
                  { title: "File Attachments", desc: "Upload documents (PDF, TXT, MD, CSV, JSON, images) for context-aware conversations" },
                  { title: "Session History", desc: "All conversations are saved and searchable. Create, rename, or delete sessions." },
                  { title: "Tool Integration", desc: "Enable tools like code execution, web research, and file operations" },
                  { title: "Streaming Responses", desc: "Real-time token-by-token streaming for instant feedback" },
                ].map((f) => (
                  <div key={f.title} className="rounded-lg border border-border/50 bg-surface p-4">
                    <h3 className="text-sm font-semibold mb-1">{f.title}</h3>
                    <p className="text-xs">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Pipelines */}
          <section id="pipelines">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Workflow className="h-5 w-5 text-primary" />
              Pipelines
            </h2>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>Build visual workflows using the drag-and-drop pipeline editor. Connect different node types to create automated AI processes.</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { icon: Clock, title: "Triggers", items: ["Cron Schedule", "Webhook", "Channel Event", "Manual"] },
                  { icon: Brain, title: "AI Nodes", items: ["AI Agent", "Content Writer", "Summarizer", "Classifier", "Image Generator"] },
                  { icon: Globe, title: "Actions", items: ["HTTP Request", "Database Query", "Send Email", "Send Message", "Code Execute"] },
                ].map((cat) => {
                  const CatIcon = cat.icon
                  return (
                    <div key={cat.title} className="rounded-lg border border-border/50 bg-surface p-4">
                      <CatIcon className="h-4 w-4 text-primary mb-2" />
                      <h3 className="text-sm font-semibold mb-2">{cat.title}</h3>
                      <ul className="space-y-1">
                        {cat.items.map((item) => (
                          <li key={item} className="flex items-center gap-1.5 text-xs">
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
              <div className="rounded-lg border border-border/50 bg-surface p-4">
                <h3 className="text-sm font-semibold mb-2">Expression Syntax</h3>
                <p className="text-xs mb-2">Use expressions to reference data from previous nodes:</p>
                <div className="bg-background rounded p-2.5 font-mono text-xs space-y-1">
                  <div><span className="text-muted-foreground">Reference JSON output:</span> <span className="text-primary">{`{{ $json.fieldName }}`}</span></div>
                  <div><span className="text-muted-foreground">Reference parameter:</span> <span className="text-primary">{`{{ $parameter.name }}`}</span></div>
                  <div><span className="text-muted-foreground">JavaScript expression:</span> <span className="text-primary">{`{{ $json.value > 10 ? "high" : "low" }}`}</span></div>
                </div>
              </div>
            </div>
          </section>

          {/* Model Management */}
          <section id="models">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Model Management
            </h2>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>FlowMind supports 23+ models across 5 providers. The Model Hub lets you browse, pull, and configure all models.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border/50 bg-surface p-4">
                  <h3 className="text-sm font-semibold mb-2">Providers</h3>
                  <ul className="space-y-1.5 text-xs">
                    {[
                      { name: "Ollama", desc: "Local models - free, run on your machine" },
                      { name: "OpenAI", desc: "GPT-4, GPT-3.5 - requires API key" },
                      { name: "Anthropic", desc: "Claude 3 Opus/Sonnet - requires API key" },
                      { name: "Google", desc: "Gemini Pro/Ultra - requires API key" },
                      { name: "HuggingFace", desc: "Community models - free tier available" },
                    ].map((p) => (
                      <li key={p.name} className="flex items-start gap-2">
                        <ArrowRight className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                        <span className="font-medium text-foreground">{p.name}:</span> {p.desc}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-border/50 bg-surface p-4">
                  <h3 className="text-sm font-semibold mb-2">Features</h3>
                  <ul className="space-y-1.5 text-xs">
                    {["Browse and search Ollama library", "Pull models with one click", "Configure API keys for cloud providers", "View model capabilities and context length", "Check provider status and availability", "Automatic provider discovery via agent runtime"].map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Security */}
          <section id="security">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Security
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { icon: Lock, title: "Authentication", desc: "JWT-based auth with bcrypt password hashing. Sessions managed via HTTP-only cookies." },
                { icon: Lock, title: "API Keys", desc: "API keys stored as SHA-256 hashes. Only the last 4 characters are visible." },
                { icon: Users, title: "RBAC", desc: "Role-based access control with USER, ADMIN, and SUPER_ADMIN roles per organization." },
                { icon: CreditCard, title: "Audit Logging", desc: "All sensitive operations are logged to the audit trail for compliance." },
              ].map((sec) => {
                const SecIcon = sec.icon
                return (
                  <div key={sec.title} className="rounded-lg border border-border/50 bg-surface p-4">
                    <SecIcon className="h-4 w-4 text-primary mb-2" />
                    <h3 className="text-sm font-semibold mb-1">{sec.title}</h3>
                    <p className="text-xs">{sec.desc}</p>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Deployment */}
          <section id="deployment">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Deployment
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border/50 bg-surface p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Server className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">systemd (Linux)</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Services auto-installed by install.sh:</p>
                <div className="bg-background rounded p-2.5 font-mono text-xs space-y-1">
                  <div>sudo systemctl start flowmind-api</div>
                  <div>sudo systemctl start flowmind-web</div>
                  <div>sudo systemctl start flowmind-runtime</div>
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-surface p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Environment Variables</h3>
                </div>
                <div className="bg-background rounded p-2.5 font-mono text-xs space-y-1">
                  <div><span className="text-muted-foreground">DATABASE_URL=</span>postgresql://flowmind@localhost:5432/flowmind</div>
                  <div><span className="text-muted-foreground">JWT_SECRET=</span>your-secret-key</div>
                  <div><span className="text-muted-foreground">AGENT_RUNTIME_URL=</span>http://127.0.0.1:8001</div>
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-surface p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Health Checks</h3>
                </div>
                <div className="bg-background rounded p-2.5 font-mono text-xs space-y-1">
                  <div>curl http://localhost:3001/trpc/health <span className="text-emerald-400"># API</span></div>
                  <div>curl http://localhost:8001/health <span className="text-emerald-400"># Runtime</span></div>
                  <div>curl http://localhost:3000 <span className="text-emerald-400"># Web UI</span></div>
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-surface p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Desktop App</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Available as AppImage and .deb packages:</p>
                <div className="bg-background rounded p-2.5 font-mono text-xs space-y-1">
                  <div>./apps/desktop/dist/flowmind-desktop-*.AppImage</div>
                  <div>sudo dpkg -i apps/desktop/dist/flowmind-desktop_*.deb</div>
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
      </main>
    </div>
  )
}
