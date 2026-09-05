# AI Agent Onboarding: FlowMind

> This is the first document a new AI agent should read before touching any code in this repo.

---

## Project Identity

**FlowMind** is a real-SaaS-oriented AI workflow and automation platform — an "AI Agent OS" where users build multi-step AI pipelines, chat with agents via tools, manage knowledge bases (RAG), and publish/discover reusable skills through a marketplace. The name is FlowMind (not "Nomad" — that name was proposed and rejected).

**Version:** 0.1.0, MIT licensed, alpha status. Currently localhost-only, running in dev mode. Production artifacts exist (tsup bundle, Next.js standalone build) but the live app runs `tsx watch` / `next dev`. Grade: "local production-verifiable / not yet public-Internet production-ready."

---

## Technology Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **Monorepo** | pnpm 9.15.4 + Turborepo 2.10 | `pnpm-workspace.yaml` includes `apps/*` and `packages/*` |
| **Node** | >= 22.x | Enforced in `engines` field |
| **Frontend** | Next.js 14.2, React 18, React Flow 11, Zustand, tRPC v11 client, Tailwind | `apps/web`, port 3000 |
| **API** | Fastify 4.26, tRPC v11, Zod | `apps/api`, port 3001, built with tsup (CJS bundle to `dist/`) |
| **Agent Runtime** | Python 3.11+, FastAPI/uvicorn | `packages/agent-runtime`, port 8001 |
| **Database** | PostgreSQL 16+ via Prisma 5.14 | `packages/db/prisma/schema.prisma` |
| **Cache** | Redis 7+ (ioredis) | Rate-limiting, auth-attempts, SSO state, SSE; memory fallback if Redis down |
| **Vector Store** | Qdrant | `packages/context-engine`, port 6333 |
| **Local LLM** | Ollama | `packages/llm-router`, port 11434 |
| **Cloud LLM** | OpenAI, Anthropic, Google, Groq, DeepSeek, OpenRouter, Mistral, + 7 more | Wired in `packages/provider-registry` and `packages/llm-router`; **NOT tested** — no keys configured on dev box |
| **CLI** | Commander.js | `apps/cli` |
| **Desktop** | Electron | `apps/desktop` |
| **Infra** | Docker + k8s manifests | `deploy/docker-compose.yml`, `infra/k8s/`, `infra/compose/` |

---

## Repository Structure

```
flowmind/
  apps/
    api/              Fastify + tRPC server (port 3001)
    web/              Next.js 14 App Router (port 3000)
    cli/              Commander.js CLI tool
    desktop/          Electron desktop app
  packages/           23 shared packages (see module map below)
  infra/
    compose/          Docker compose files
    k8s/              Kubernetes manifests
    scripts/          Deployment scripts
  docs/               Documentation (architecture, getting-started, pipeline-authoring, etc.)
  e2e/                Playwright end-to-end tests
  deploy/             docker-compose.yml for orchestrated deployment
  .opencode/          OpenCode configuration, skills, plugins, agents
    skills/           code-philosophy, frontend-philosophy, code-review, plan-protocol, plan-review
  scripts/            Utility scripts
```

---

## Package Map (23 packages)

| Package | One-liner |
|---------|-----------|
| `pipeline-engine` | DAG execution, node runners, async pipeline execution |
| `llm-router` | Multi-provider LLM routing with fallback, agent loop (CALL_TOOL / FINAL_ANSWER) |
| `provider-registry` | API key management, credential encryption at rest |
| `mcp-executor` | MCP protocol executor with OAuth, stdio + streamable-http/SSE |
| `tool-system` | Built-in tools: read, write, edit, grep, glob, bash, webFetch, webSearch, http_request, applyPatch, todoWrite |
| `skill-engine` | Sandboxed skill execution, marketplace skill management |
| `context-engine` | Session memory, context assembly, Qdrant vector integration |
| `session-engine` | Chat session management, SSE streaming |
| `runtime-registry` | External runtime dispatch (e.g. OpenHuman, custom adapters) |
| `channel-gateway` | Telegram, Slack, Discord, WhatsApp, Email adapters |
| `lsp` | LSP integration for code intelligence |
| `snapshot` | Pipeline version snapshots |
| `permission` | File-level permission evaluation (minimatch-based rules) |
| `plugin-engine` | Plugin lifecycle management |
| `auth` | JWT, RBAC (USER/ADMIN/SUPER_ADMIN + OWNER/ADMIN/MEMBER/VIEWER), 2FA, SAML SSO |
| `billing` | Stripe integration (FREE / PRO / TEAM / ENTERPRISE tiers) |
| `db` | Prisma schema + client, PostgreSQL |
| `ui` | Shared shadcn/ui React components |
| `shared` | Common types, utilities |
| `ollama-proxy` | Ollama API proxy |
| `errors` | Typed error classes with machine-readable codes |
| `http-recorder` | HTTP request recording |
| `agent-runtime` | Python FastAPI agent runtime (port 8001) |

---

## Major Module Relationships

```
Web UI (tRPC client)
  └─> API (Fastify + tRPC router)
        ├─> pipeline-engine      (DAG execution, node runners)
        │     ├─> llm-router     (LLM calls, agent loop)
        │     │     └─> provider-registry (API keys, encryption)
        │     ├─> tool-system    (built-in tools)
        │     │     └─> permission (rule evaluation)
        │     ├─> mcp-executor   (MCP protocol, external tools)
        │     └─> skill-engine   (sandboxed skill execution)
        ├─> context-engine       (memory, Qdrant vectors)
        ├─> session-engine       (chat sessions, SSE)
        ├─> auth                 (JWT, RBAC, 2FA)
        ├─> billing              (Stripe subscriptions)
        ├─> channel-gateway      (messaging adapters)
        └─> agent-runtime        (Python FastAPI, port 8001)
              └─> tools via /api/internal/execute-tool
```

---

## Important Files Map

### Entry Points
| File | Purpose |
|------|---------|
| `apps/api/src/index.ts` | **API entry point** — Fastify server, tRPC plugin, tool registration, SSE endpoints, internal endpoints, cron scheduler, run recovery |
| `apps/api/src/routers/index.ts` | **tRPC router root** — all 22 routers (auth, chat, pipeline, tools-v2, mcp, webhooks, skills, billing, etc.) |
| `apps/api/src/lib/config.ts` | Centralized env config with Zod validation |
| `apps/api/src/lib/jwt-secret.ts` | JWT secret (throws in production if using fallback) |
| `apps/api/src/lib/crypto.ts` | AES-256-GCM encrypt/decrypt for provider credentials |
| `apps/api/src/lib/redis.ts` | Redis client with memory fallback |
| `apps/api/src/services/ChatService.ts` | Chat session handling, agent loop orchestration |
| `apps/api/src/services/active-runs.ts` | Shared active-runs singleton registry |
| `apps/api/src/services/run-recovery.ts` | Recovers runaway/incomplete pipeline runs on startup |
| `apps/api/src/services/mcp-client.ts` | Real MCP client via @modelcontextprotocol/sdk |
| `apps/api/src/services/cron-scheduler.ts` | node-cron based pipeline scheduling |
| `packages/pipeline-engine/src/runners.ts` | Pipeline node execution logic |
| `packages/llm-router/src/index.ts` | LLM provider routing and agent loop |
| `packages/db/prisma/schema.prisma` | **All database models** (1064 lines, 30+ models) |

### Key Commands
| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start api (:3001) + web (:3000) in dev mode |
| `pnpm build` | Build all packages (api via tsup, web via next build) |
| `pnpm typecheck` | TypeScript check across all packages |
| `pnpm test` | Run unit tests (vitest) |
| `pnpm test:e2e` | Run Playwright e2e tests |
| `tsc --noEmit` (in apps/api or apps/web) | **Mandatory** typecheck after any code change |

---

## Database

- **Prisma schema:** `packages/db/prisma/schema.prisma` (1064 lines, 30+ models)
- **Migrations:** `packages/db/prisma/migrations/`
- **Key models:** User, Org, OrgMember, HostGroup, HostClient, Pipeline, PipelineRun, RunLog, Session, Message, Skill, MarketplaceSkill, MarketplaceListing (7 item types), Memory, KnowledgeBase, KnowledgeDocument, Agent, McpServer, McpToken, ProviderCredential, ApiKey, CronJob, AuditLog, FrameworkConfig, PipelineProposal

### Port Discrepancy Warning
The **live local PostgreSQL runs on port 5433**, but `.env.example`, `docker-compose.yml`, and k8s manifests reference port **5432**. You **must override** to 5433 in your local `.env`. The `DATABASE_URL` should be `postgresql://user:pass@localhost:5433/flowmind`.

### Windows Migration Notes
- `prisma migrate dev` fails on Windows with error P3014 (schema file not found from generated client). Workaround: use `prisma db execute` or `prisma migrate deploy` instead.
- `prisma generate` needs the API server stopped — Prisma client DLL gets locked by a running Node process.

---

## External Integrations & Real Status

| Integration | Status | Notes |
|-------------|--------|-------|
| Ollama (local LLM) | ✅ Verified working | Pull models with `ollama pull llama3.1`; agent loop calls through llm-router |
| Cloud LLM providers | ⚠️ Wired, not tested | Provider registry supports 15+ providers; no API keys configured on dev box |
| Stripe billing | ⚠️ Wired, not configured | Returns honest error when keys missing; no fake success |
| MCP client | ✅ Real, tested | Uses @modelcontextprotocol/sdk; stdio + streamable-http; tested against in-repo demo server |
| Qdrant vector store | ✅ Verified end-to-end | Native Windows binary; context-engine + Python engine both use it |
| Redis | ✅ Verified | Native Windows binary; rate-limit, auth-attempts, SSO state; memory fallback if down |
| Telegram/Slack/Discord/WhatsApp | ❌ Adapters exist, not wired | channel-gateway packages exist but adapters are not instantiated in production |
| Email (SMTP) | ✅ Verified locally | flowmind.email.send with per-user SMTP, verified via local SMTP capture |

---

## Current Implementation Status

The platform is **functional in local dev mode**. Core flows work: register/login, create pipelines, execute them, chat with agents using tools, manage knowledge bases with RAG, manage MCP server connections, browse marketplace.

Production build artifacts exist (tsup API bundle boots, Next.js standalone builds) but the app runs in dev mode locally. Not deployed to public internet. Full status in `docs/VERIFICATION-REPORT.md` and `docs/REBUILD-PLAN.md`.

---

## Known Problems

1. **10 `flowmind.*` MCP tools are stubs** — registered but return placeholder responses
2. **WhatsApp end-to-end is non-functional** — adapter exists, not wired
3. **Channel-gateway adapters not instantiated in production** — packages exist, not connected
4. **Python agent-runtime lacks `/webhook/ingest` route** — inbound webhooks dead-end
5. **parallelFork / loop nodes not truly concurrent/re-iterating** — sequential only
6. **webhookTrigger is client-side only** — no server-side webhook listener
7. **localhost-only, dev-mode** — not public-internet production-ready
8. **Qdrant and Redis run as native Windows binaries** — Docker/WSL2 impossible on this dev box
9. **Cloud LLM providers not tested** — no API keys configured
10. **Stripe not configured** — billing returns honest error

---

## Security Invariants (Do NOT Change Casually)

These were hardened during the production audit. Violating any of these is a critical regression:

- **SSRF guard:** All outbound HTTP goes through `fetchPublic` / `FetchPublic` with blocklist. Never bypass.
- **Sandbox:** `codeExecute` runs in `isolated-vm`. Never execute arbitrary code outside the sandbox.
- **Approval flow:** Tools-v2 `autoApprove` was removed (RCE risk). Server-side single-use approval only.
- **Tenant isolation:** Skills, pipelines, knowledge bases are scoped to users/orgs/groups. Never cross-tenant.
- **Honest-failure philosophy:** Never fake success. No mock responses, no `received: true` without verification, no canned replies flagged as real. Errors bubble up honestly.
- **Internal endpoints deny-by-default:** `/api/internal/*` requires `AGENT_API_KEY` / `INTERNAL_API_KEY`. If unset, endpoints are denied.
- **Credentials at rest:** Provider API keys encrypted with AES-256-GCM via `ENCRYPTION_KEY`. Never store plaintext.
- **JWT fallback secret throws in production:** `jwt-secret.ts` throws if `JWT_SECRET` is the insecure default in production.
- **Webhook HMAC:** Stripe webhooks verified with `stripe-signature`. Never accept unsigned webhooks.

---

## Key Architectural Decisions (and Why)

| Decision | Why |
|----------|-----|
| **Shared LLM factory** (`lib/llm-factory.ts`) | Single call-site for all LLM interactions; consistent retry, logging, token counting |
| **Active-runs singleton** (`services/active-runs.ts`) | Shared in-memory registry tracks running pipelines; enables run-recovery on restart |
| **Lazy LLM initialization** | Provider keys loaded from DB at startup; providers only instantiated when first called |
| **Credentials-at-rest** (AES-256-GCM) | API keys for 15+ providers encrypted before DB storage; decrypted in-memory only |
| **Honest-error philosophy** | After the production audit: no fake success, no canned replies, no mock billing. Errors are real. |
| **tsup for API bundle** | Monorepo `tsc` compile was broken; tsup produces single self-contained CJS bundle with `@flowmind/*` inlined |
| **Redis + Qdrant native binaries** | Docker/WSL2 impossible on dev box (missing Hyper-V); native Windows binaries used instead |
| **Dev-mode over forced production build** | Standalone Next.js build broken on Windows; keep dev-mode working rather than fighting broken prod build locally |

---

## Development Conventions

From `AGENTS.md` and `.opencode/` skills:

- **Response style:** Direct, concise, no preamble/postamble, no emoji
- **Code style:** TypeScript strict, no `any` where avoidable, follow existing patterns, no comments unless necessary
- **Icons:** Lucide icons only, never emoji strings
- **Verification:** Always run `tsc --noEmit` on both `apps/api` and `apps/web` after changes. Both must be at zero errors.
- **Philosophy skills:** Before writing code, load the relevant philosophy skill:
  - Frontend/UI work → `frontend-philosophy` ("5 Pillars of Intentional UI")
  - Backend/logic work → `code-philosophy` ("5 Laws of Elegant Defense")
  - Both → load both
  - Verify implementation against the philosophy checklist before completing

---

## Deployment

- **Local:** `pnpm dev` starts api (:3001) + web (:3000) in dev mode
- **Docker:** `deploy/docker-compose.yml` defines postgres, api, web, runtime services
- **Kubernetes:** `infra/k8s/` contains manifests
- **AWS:** Planned, not yet configured

---

## How to Trace a Feature End-to-End

Example: "User runs a pipeline from the web UI"

1. **Web:** React Flow canvas → `Ctrl+Enter` → tRPC mutation `pipeline.run`
2. **API router:** `apps/api/src/routers/pipeline.ts` → validates input, calls pipeline service
3. **Service:** Creates `PipelineRun` in DB, starts execution
4. **Pipeline engine:** `packages/pipeline-engine/src/runers.ts` — walks the DAG, executes nodes
5. **Node execution:** Each node type dispatches to the appropriate runner (AI node → llm-router, tool node → tool-system, etc.)
6. **LLM calls:** `packages/llm-router/src/index.ts` → routes to provider (Ollama/OpenAI/etc.)
7. **DB updates:** Run status, logs, token counts written to `pipeline_runs` and `run_logs` tables
8. **SSE streaming:** Real-time node status pushed to web via `/api/pipeline/stream/:runId`

---

## Quick Reference

| What | Where |
|------|-------|
| Prisma schema | `packages/db/prisma/schema.prisma` |
| tRPC routers | `apps/api/src/routers/index.ts` |
| API entry point | `apps/api/src/index.ts` |
| Config/env | `apps/api/src/lib/config.ts` |
| Tool definitions | `packages/tool-system/src/` |
| Agent loop | `packages/llm-router/src/` |
| Pipeline runners | `packages/pipeline-engine/src/runers.ts` |
| MCP client | `apps/api/src/services/mcp-client.ts` |
| Auth middleware | `apps/api/src/middleware/trpc.ts` |
| Chat service | `apps/api/src/services/ChatService.ts` |
| Active runs | `apps/api/src/services/active-runs.ts` |
| Run recovery | `apps/api/src/services/run-recovery.ts` |
| Crypto (encrypt/decrypt) | `apps/api/src/lib/crypto.ts` |
| Redis client | `apps/api/src/lib/redis.ts` |
| Existing docs | `docs/architecture.md`, `docs/VERIFICATION-REPORT.md`, `docs/REBUILD-PLAN.md` |
