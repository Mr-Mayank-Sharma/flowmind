# FlowMind

**Build, run, and share AI-powered workflows and agents — all in one place.**

FlowMind is an AI Agent OS: a platform for creating multi-step AI pipelines, chat agents, and reusable skills. Connect any LLM provider, orchestrate complex workflows visually, and publish to a community marketplace.

![FlowMind Pipeline Canvas](docs/assets/canvas-screenshot.png)

## Quick Start

```bash
git clone https://github.com/your-org/flowmind.git
cd flowmind
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:seed
pnpm dev
```

Open http://localhost:3000 — login with `admin@flowmind.ai` / `admin123`

## Demo Workflows

The seed data includes 5 production-ready multi-node pipelines:

1. **SEO Optimization Pipeline** — Fetch page → Extract meta tags → AI analysis → Generate optimizations → Format report
2. **Email Triage Pipeline** — Cron trigger → Fetch emails → AI classify → Branch by urgency → Compose digest → Send to Slack
3. **AI Code Review Pipeline** — GitHub webhook → Fetch diff → Parallel AI review (quality + security) → Merge → Post PR comment
4. **Content Generation Pipeline** — Topic input → Web research → Generate outline → Write article → SEO optimize → Format
5. **Data Extraction Pipeline** — URL input → Fetch content → Clean HTML → AI extract → Validate → Format output

## Architecture

```
Web UI (Next.js) ──tRPC──> API (Fastify) ──> Pipeline Engine
                     │              │              │
                     │         LLM Router    Skill Engine
                     │              │              │
                     │        Tool System   Channel Gateway
                     │              │              │
                     └──── DB (PostgreSQL) + Redis ─┘
```

See [docs/architecture.md](docs/architecture.md) for the full system overview.

## Features

- **Visual Pipeline Canvas** — Drag-and-drop node editor with keyboard shortcuts (Ctrl+S save, Ctrl+Enter run, Delete remove, Ctrl+D duplicate)
- **Node Palette with Search** — Filter 24+ node types across Triggers, AI, Actions, and Flow Control
- **Pipeline Templates** — Start from 6 pre-built workflow templates (Email Automation, Web Research, Content Factory, etc.)
- **Skill Marketplace** — Discover, clone, and install community-built skills
- **SSE Streaming** — Real-time pipeline execution with live node status updates
- **Integration Protocol** — Register external runtimes (OpenHuman, custom adapters)
- **Responsive Layout** — Works on desktop and mobile
- **Toast Notifications** — Success/error feedback on all mutations
- **Loading States** — Skeleton placeholders during data fetches
- **Error Recovery** — Typed error classes with friendly messages and retry actions

## Project Structure

```
apps/
  api/             Fastify + tRPC server (port 3001)
  web/             Next.js 14 App Router (port 3000)
  cli/             Command-line tool
  desktop/         Electron desktop app
packages/          23 shared packages
  pipeline-engine/   DAG execution + node runners
  skill-engine/      Sandboxed skill execution
  llm-router/        Multi-provider LLM routing
  tool-system/       Built-in tools (read, write, bash, etc.)
  channel-gateway/   Telegram, Slack, Discord, WhatsApp, Email
  runtime-registry/  External runtime dispatch
  errors/            Typed error classes
  db/                Prisma schema + client
  ...                billing, session, context, auth, UI, etc.
```

## Key Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start api + web in dev mode |
| `pnpm typecheck` | TypeScript check across all packages |
| `pnpm test` | Run unit tests |
| `pnpm build` | Build all packages |

## Documentation

- [Getting Started](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- [Pipeline Authoring](docs/pipeline-authoring.md)
- [Skill Development](docs/skill-development.md)
- [Integration Protocol](docs/integration-protocol.md)
- [Self-Hosting](docs/self-hosting.md)

## Contributing

1. Fork the repo
2. Create a feature branch
3. Run `pnpm typecheck` and `pnpm test` before committing
4. Open a PR

## License

MIT
