# Project Structure

Navigation map for the FlowMind monorepo. Everything below is verified against the current tree on `main`.

## Top level

```
flowmind/
  apps/            Application entry points (API, Web, CLI, Desktop)
  packages/        Shared libraries consumed by the apps (23 packages)
  infra/           Deployment/infra: compose, k8s manifests, native-infra script
  deploy/          Docker Compose + systemd units for orchestrated deployment
  e2e/             Playwright end-to-end tests (health + login smoke)
  docs/            Documentation (architecture, getting-started, self-hosting, development)
  .opencode/       OpenCode configuration, agents, skills, plugins, tools
  scripts/         Utility scripts (backup.sh)
  .github/         CI workflow (build/typecheck/lint/test on PRs to main)
  .env.example     Root env template (copied to .env manually)
  install.sh       Linux provisioner: full env + systemd services + launchers
  start-dev.sh     Local dev helper: kills :3000 and starts web only (hardcoded path)
  opencode.json    OpenCode/agent config (instruction files, permissions, plugins, MCP)
  turbo.json       Turborepo task graph
  pnpm-workspace.yaml  Workspace globs: apps/* and packages/*
  tsconfig.base.json   Shared TS compiler options
```

## apps/

| Package | Port | Purpose | Entrypoint |
|---------|------|---------|------------|
| `apps/api` | 3001 | Fastify + tRPC v11 server; auth, pipelines, chat, tools, SSE, cron, run-recovery, internal tool-execution endpoints | `src/index.ts` |
| `apps/web` | 3000 | Next.js 14 App Router UI; React Flow canvas, chat, marketplace, settings | `next.config.js` (`output: "standalone"`) |
| `apps/cli` | — | Commander.js terminal tool (`flowmind`); manage agents, pipelines, models, chat | `src/index.ts` |
| `apps/desktop` | — | Electron wrapper around the platform | `main.js` |

Key API internals:

- `apps/api/src/routers/` — all tRPC routers (auth, chat, pipeline, tools, skills, billing, webhooks, system, ...)
- `apps/api/src/services/` — ChatService, cron-scheduler, run-recovery, active-runs, session/run emitters
- `apps/api/src/lib/` — `config.ts` (Zod-validated env), `jwt-secret.ts` (throws in production without a secret), `crypto.ts` (AES-256-GCM), `redis.ts` (client with memory fallback)
- `apps/api/src/middleware/` — tRPC context + auth middleware
- `apps/api/src/index.ts` — Fastify bootstrap: helmet, CORS, rate-limit, tRPC plugin, `/health`, `/metrics`, SSE endpoints, internal endpoints

Web internals worth knowing:

- `apps/web/src/lib/api/core.ts` — `API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"` (this is how the web points at the API)
- `apps/web/src/lib/trpc.ts` — tRPC client wiring
- `apps/web/src/components/pipeline/pipeline-canvas.tsx` — canvas + node streaming via `API_URL`
- `apps/web/next.config.js` — `output: "standalone"`, `outputFileTracingRoot: ../../`, `transpilePackages` for `@flowmind/{shared,db,ui}`

## packages/ (23)

| Package | One-liner |
|---------|-----------|
| `agent-runtime` | **Python** FastAPI runtime (port 8001): models, knowledge/RAG, `/llm/generate`, `/chat/*`. Started separately |
| `auth` | JWT, RBAC (UserRole + OrgRole), 2FA / WebAuthn, SAML SSO |
| `billing` | Stripe subscription tiers (FREE / PRO / TEAM / ENTERPRISE); dev billing mock gated by `ENABLE_DEV_BILLING_MOCK` |
| `channel-gateway` | Telegram, Slack, Discord, WhatsApp, Email adapters |
| `context-engine` | Session memory, context assembly, Qdrant vector integration |
| `db` | Prisma schema + client + migrations + seed; `packages/db/prisma/schema.prisma` is the single DB source of truth |
| `errors` | Typed error classes with machine-readable codes |
| `http-recorder` | HTTP request recording |
| `llm-router` | Multi-provider LLM routing, agent loop (CALL_TOOL / FINAL_ANSWER) |
| `lsp` | LSP integration for code intelligence |
| `mcp-executor` | MCP protocol executor, OAuth, stdio + streamable-http/SSE |
| `ollama-proxy` | Ollama API proxy |
| `permission` | File-level permission evaluation (minimatch rule sets) |
| `pipeline-engine` | DAG execution, node runners, expression engine |
| `plugin-engine` | Plugin lifecycle management |
| `provider-registry` | API key management, credentials encrypted at rest |
| `runtime-registry` | External runtime dispatch (OpenHuman, custom adapters) |
| `session-engine` | Chat session management, SSE streaming |
| `shared` | Common types and utilities |
| `skill-engine` | Sandboxed skill execution, marketplace skill management |
| `snapshot` | Pipeline version snapshots |
| `tool-system` | Built-in tools: read, write, edit, grep, glob, bash, webFetch, webSearch, http_request, applyPatch, todoWrite |
| `ui` | Shared shadcn/ui React components |

## infra/ and deploy/

`infra/` is for Kubernetes and local containers:

- `infra/compose/local.yml` — dev services: postgres :5432, redis :6379, qdrant :6333, minio :9000/:9001
- `infra/compose/production.yml` — production compose (bakes 5432)
- `infra/k8s/` — Kubernetes manifests (configmap, secrets, postgres; all bake 5432)
- `infra/scripts/start-native-infra.ps1` — starts Redis + Qdrant as native Windows binaries (the only infra launcher in the repo)

`deploy/` is Docker-first orchestration:

- `deploy/docker-compose.yml` — postgres, api, web, runtime services (port 5432)
- `deploy/flowmind-api.service` — example systemd unit for the API (bakes 5432)

> **Both 5432 and 5433 matter.** Containers/k8s default to 5432. The live local Postgres on this box binds **5433**. Set `DATABASE_URL` to your actual port. See `docs/development/setup.md`.

## docs/

New layout:

- `docs/development/` — **this directory**: setup, project-structure, local-development, testing, debugging, contribution
- Existing docs: `docs/getting-started.md` (note: stale re Node 20+/PG14 — see `setup.md`), `docs/architecture.md`, `docs/self-hosting.md`, `docs/pipeline-authoring.md`, `docs/context/ai-context.md` (AI/agent onboarding), `docs/data-model/`, `docs/architecture/`

## e2e/

- `e2e/playwright.config.ts` — Playwright config; webserver starters for API :3001 and Web :3000; `testDir: "."`
- `e2e/health.spec.ts` — health endpoint, login-page smoke, metrics endpoint

## .opencode/ (repo-local OpenCode configuration)

- `ocx.jsonc` — OpenCode config
- `agents/` — repo agents (researcher, scribe, coder, reviewer, plan, build, explore)
- `skills/` — `code-philosophy`, `frontend-philosophy`, `code-review`, `plan-protocol`, `plan-review`
- `tools/` — instructions, including `philosophy.md` (the mandatory philosophy-loading rule)
- `plugins/` — repo plugins

The root `AGENTS.md` and `opencode.json` are the canonical developer instructions; `docs/context/ai-context.md` is the companion AI-agent onboarding doc.

## Where source lives per concern

| Concern | Location |
|---------|----------|
| Database schema + migrations | `packages/db/prisma/` |
| HTTP + tRPC API | `apps/api/src/` |
| Web UI | `apps/web/src/` |
| Pipeline execution | `packages/pipeline-engine/src/` |
| LLM routing / agent loop | `packages/llm-router/src/` |
| Tools | `packages/tool-system/src/` |
| Auth / RBAC | `packages/auth/src/` + `apps/api/src/middleware/` |
| Chat sessions / SSE | `packages/session-engine/src/` + `apps/api/src/services/` |
| Vector memory / RAG | `packages/context-engine/src/` |
| Python agent runtime | `packages/agent-runtime/src/` |
| E2E tests | `e2e/` |