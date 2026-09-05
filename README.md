# FlowMind

<p align="center">
  <strong>Build, run, and share AI-powered workflows and agents — all in one place.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-blue" alt="Version 0.1.0" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License MIT" />
  <img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node >=22" />
  <img src="https://img.shields.io/badge/pnpm-%3E%3D9-orange" alt="pnpm >=9" />
  <img src="https://img.shields.io/badge/status-alpha-yellow" alt="Alpha" />
</p>

FlowMind is an **AI Agent OS**: a platform for visually building and running multi-step AI pipelines, chatting with agents that use tools and MCP servers, managing knowledge bases (RAG), and publishing or discovering reusable skills in a marketplace. Connect any LLM provider, orchestrate complex workflows on a canvas, and extend it with your own tools and runtimes.

> **New to this repo?** Start at [docs/context/ai-context.md](docs/context/ai-context.md) — it orients both humans and AI agents before you touch any code. Then use [docs/README.md](docs/README.md) to navigate the full documentation tree.

---

## Vision

FlowMind is building toward an n8n-class AI workflow and automation platform where every node can call an LLM, every pipeline can be an agent, and a community marketplace lets creators publish and consumers discover reusable skills, flows, and integrations. See [docs/product/vision.md](docs/product/vision.md) for the full product vision.

## Main Features

- **Chat with local + cloud models** 🚧 — Real local inference via Ollama is verified; 16 cloud providers are wired but not live-tested (no keys configured).
- **Visual pipeline builder** 🚧 — Drag-and-drop canvas (React Flow), 24+ node types, real-time SSE streaming.
- **Agent loop with tools + MCP** ✅ — Real `@modelcontextprotocol/sdk` client (stdio/HTTP/SSE), built-in tools, honest error handling.
- **Knowledge / RAG** ✅ — Qdrant-backed vector retrieval through both the JS context-engine and the Python runtime.
- **Marketplace** 🚧 — Skill/flow marketplace with real persistence; two parallel catalogs not yet unified.
- **Skills** 🚧 — Sandboxed JS skill execution, install/publish flows; native runtime + LSP not yet real.
- **Multi-tenancy & RBAC** ✅ — JWT auth, org roles (OWNER/ADMIN/MEMBER/VIEWER), tenant-isolated resources.
- **Cron scheduling** 🚧 — node-cron pipeline scheduling exists; webhook/cron triggers not yet end-to-end verified.
- **Connectors** 🚧 — Generic `http_request`, `sqliteQuery`, `transform`, `fileIo`, `email.send` work; 10 `flowmind.*` tools remain stubs.

## Current Status

**Honest assessment: localhost dev-mode, security-hardened, not publicly deployed.**

- Runs in local dev mode (`next dev` / `tsx watch`) on this machine.
- **242 automated tests passing**, 0 failures (plus 3 Playwright + 8 browser smoke tests).
- Security hardening completed and live-verified: SSRF guard, sandboxed code execution, tenant isolation, encrypted credentials at rest, webhook HMAC, deny-by-default internal endpoints.
- Production artifacts (tsup API bundle, Next.js standalone) are validated locally but **not deployed to a public endpoint**.
- External integrations — cloud LLMs, Stripe, OAuth/SSO, messaging channels — are **unconfigured and untested** against real credentials.
- Infrastructure (Qdrant :6333, Redis :6379) runs as **native binaries on this box** (Docker/WSL2 unavailable). The live local Postgres binds **:5433** while examples bake :5432 — see Quick Start.

See [docs/roadmap/README.md](docs/roadmap/README.md) for status markers and the full roadmap, and [docs/VERIFICATION-REPORT.md](docs/VERIFICATION-REPORT.md) for live-verified facts.

## Tech Stack

| Layer | Technology | Port |
|-------|-----------|------|
| Frontend | Next.js 14, React 18, React Flow, Zustand, tRPC client | 3000 |
| Backend | Fastify + tRPC v11, Zod | 3001 |
| Agent runtime | Python 3.11+, FastAPI / uvicorn | 8001 |
| Database | PostgreSQL 16+ (Prisma) | **5433** locally |
| Cache | Redis 7+ | 6379 |
| Vector store | Qdrant | 6333 |
| LLM | Ollama (local) + 16 cloud providers | 11434 |

`pnpm dev` starts only the API (:3001) and Web (:3000). The **agent runtime (:8001) is separate** and started by hand — see Quick Start.

## Quick Start

### Prerequisites

- **Node.js** >= 22
- **pnpm** >= 9 (via corepack: `corepack enable && corepack prepare pnpm@9.15.4 --activate`)
- **PostgreSQL** 16+ (running locally)
- **Redis** 7+ (recommended; API falls back to in-memory if absent)
- **Qdrant** (optional; vector/RAG)
- **Ollama** (optional; local LLM — `ollama pull llama3.1`)
- **Python** >= 3.11 (agent runtime only)

### Setup

```bash
# 1. Clone
git clone https://github.com/your-org/flowmind.git
cd flowmind

# 2. Install dependencies (postinstall generates the Prisma client)
pnpm install

# 3. Create and EDIT your environment file
cp .env.example .env
```

> **WARNING — PostgreSQL port 5432 vs 5433.** The `.env.example` (and compose/k8s manifests) bake `5432`. The live Postgres on this dev box binds **5433**. Set `DATABASE_URL` to match *your* database, e.g. `postgresql://user:pass@localhost:5433/flowmind`. This mismatch is the #1 first-run failure. `JWT_SECRET`, `ENCRYPTION_KEY`, and `AGENT_API_KEY` must all be set, and `AGENT_API_KEY` must be identical between the API and the agent runtime.

```bash
# 4. Database schema + migrations
pnpm db:generate
pnpm db:migrate

# 5. Optional: seed an admin user/org (no-op without env)
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=your-strong-password pnpm db:seed
```

### Start the services

**Start infrastructure** (one of):

```bash
# Docker-capable (Linux/macOS/WSL2): Postgres :5432, Redis, Qdrant, MinIO
docker compose -f infra/compose/local.yml up -d

# Native binaries (Windows without WSL2/Hyper-V)
powershell -ExecutionPolicy Bypass -File infra/scripts/start-native-infra.ps1
```

**Start API + Web:**

```bash
pnpm dev        # API :3001 (hot reload) + Web :3000
```

**Start the agent runtime separately** (`pnpm dev` does **not** start it):

```bash
cd packages/agent-runtime
python -m venv .venv && .venv\Scripts\activate   # Windows (see setup.md for all OSes)
pip install -r requirements.txt
set AGENT_API_KEY=your-shared-key                # must match the API .env
python -m uvicorn src.main:app --host 127.0.0.1 --port 8001
```

### Verify

```bash
curl http://localhost:3001/health   # -> {"status":"ok",... ,"checks":{"database":true,"agentRuntime":true}}
curl http://localhost:8001/health   # -> {"status":"ok"}
redis-cli PING                      # -> PONG
```

Then open http://localhost:3000 and register, or log in with the seeded admin. Chat produces real replies only when Ollama (or a cloud LLM) is reachable and a key/URL is configured.

The **full walkthrough** — Windows Prisma workarounds, virtualenv details, infra options, verification checklist — is in [docs/development/setup.md](docs/development/setup.md).

## Repository Structure

```
apps/
  api/             Fastify + tRPC server (port 3001)
  web/             Next.js 14 App Router (port 3000)
  cli/             Commander.js CLI tool
  desktop/         Electron desktop app
packages/          23 shared packages (see project-structure.md)
  agent-runtime/   Python FastAPI agent runtime (port 8001) — started separately
  pipeline-engine/ DAG execution + node runners
  llm-router/      Multi-provider LLM routing + agent loop
  provider-registry/ API key management, credentials encrypted at rest
  mcp-executor/    MCP protocol executor
  tool-system/     Built-in tools
  channel-gateway/ Telegram, Slack, Discord, WhatsApp, Email adapters
  db/              Prisma schema + client + migrations
  auth/            JWT, RBAC, 2FA, SAML SSO
  billing/         Stripe integration
  ...              20 more packages
infra/             Compose, k8s manifests, native-infra script
deploy/            docker-compose.yml, systemd units
docs/              Documentation (single source of truth)
e2e/               Playwright end-to-end tests
.opencode/         OpenCode config, agents, skills
```

See [docs/development/project-structure.md](docs/development/project-structure.md) for the full map including `packages/*` and `infra/deploy`.

## Documentation Navigation

**New to this repo? Start at [docs/context/ai-context.md](docs/context/ai-context.md).** It is written for both humans and AI agents and is the first thing to read before touching code. From there, use [docs/README.md](docs/README.md) as the index:

```
docs/
  context/      First-stop onboarding: ai-context, decisions, history, terminology
  product/      Vision, problems, users, use-cases
  architecture/ System overview, API, backend, frontend, integrations, data-flow
  data-model/   Entities, relationships, schema, data-flow
  features/     Pipelines, agents, chat, RAG, marketplace, skills, cron, MCP, billing
  workflows/    End-to-end traces (chat, auth, pipeline-run, knowledge-ingest, ...)
  whatsapp/     WhatsApp integration deep-dive
  development/  setup, project-structure, testing, debugging, contribution
  deployment/   overview, env, infrastructure, AWS, production-checklist
  roadmap/      Status + roadmap (README.md is the index)
```

## Development

| Command | Purpose |
|---|---|
| `pnpm dev` | Start api (:3001) + web (:3000) in dev mode (not the Python runtime) |
| `pnpm build` | Build all packages (api via tsup, web via next build) |
| `pnpm lint` | Lint the repo |
| `pnpm typecheck` | TypeScript check across all packages |
| `pnpm test` | Run unit tests (vitest) |
| `pnpm test:e2e` | Run Playwright e2e tests |
| `pnpm db:generate` / `db:migrate` / `db:seed` | Prisma client, migrations, admin seed |
| `pnpm cli` | Run the CLI tool |

Always run `tsc --noEmit` in both `apps/api` and `apps/web` after changes and keep both at zero errors.

**Contributing:** see [docs/development/contribution.md](docs/development/contribution.md) (conventional commits, security invariants, PR checklist). **Coding conventions:** the repo root `AGENTS.md` and the `.opencode/` philosophy skills (`code-philosophy`, `frontend-philosophy`) are the canonical developer instructions, loaded automatically by OpenCode.

## Deployment Overview

- **Now:** local dev mode on localhost. Production artifacts (tsup API bundle, Next.js standalone) build and boot locally but are not deployed publicly.
- **Production paths:** Docker Compose (`deploy/docker-compose.yml`), Kubernetes (`infra/k8s/`), or single-node `install.sh`. See [docs/deployment/overview.md](docs/deployment/overview.md).
- **AWS:** a recommended ECS Fargate + RDS + ElastiCache architecture is documented in [docs/deployment/aws.md](docs/deployment/aws.md) — **planned, not implemented**.

## Roadmap

See [docs/roadmap/README.md](docs/roadmap/README.md) for status markers (✅🚧❌🔮), the phase plan, and the gap analysis. It is the single source of truth for what is done, in progress, and remaining.

## License

MIT
