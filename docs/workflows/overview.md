# Workflows Overview

This directory documents the main user journeys through FlowMind — what happens from a user action in the UI, through the API, to the service logic, database, and back.

## The common request shape

Every flow follows the same skeleton:

```
Browser (Next.js) 
  → fetch /trpc (Next route handler) or fetch /api/... (SSE / internal)
  → single tRPC app router (apps/api/src/routers/index.ts, 23 routers)
  → router procedure (protected/public/admin) with zod input validation
  → Prisma service / engine package call
  → Postgres (via @flowmind/db) and/or external services (Ollama, Qdrant, agent-runtime, Stripe)
  → tRPC response or SSE event stream → UI store (Zustand) → components
```

- All mutation/query transport goes through the single tRPC endpoint. The only exceptions are the raw SSE endpoints (`/api/chat/stream/:sessionId`, `/api/pipeline/stream/:runId`) and internal endpoints (`/api/internal/execute-tool`), all defined in `apps/api/src/index.ts`.
- Authorization is applied at two layers: `apps/api/src/middleware/trpc.ts` (`publicProcedure` / `protectedProcedure` / `adminProcedure`) and per-route ownership checks (`where: { userId: ctx.userId }`).
- All SQL is Prisma; the schema lives in `packages/db/prisma/schema.prisma`.
- Client state for streaming uses Zustand stores under `apps/web/src/hooks/`.

## Master navigation map

| Area | Route | Router namespace | Key files |
|------|-------|------------------|-----------|
| Chat | `/chat` | `chat` | `apps/web/src/hooks/chat-store.ts`, `apps/web/src/components/chat/*`, `apps/api/src/routers/chat.ts`, `apps/api/src/services/ChatService.ts` |
| Pipelines | `/pipelines`, `/pipelines/[id]` | `pipeline` | `apps/web/src/components/pipeline/*`, `apps/api/src/routers/pipeline.ts`, `packages/pipeline-engine/src/*` |
| Marketplace | `/marketplace`, `/marketplace/[id]` | `marketplace`, `skills`, `pipeline` (legacy) | `apps/api/src/routers/marketplace.ts`, `skills.ts` |
| Knowledge | `/knowledge` | `knowledge` | `apps/api/src/routers/knowledge.ts`, `packages/context-engine/src/index.ts`, `packages/agent-runtime/src/main.py` |
| Tools / Skills | `/tools`, `/tools-v2` | `tools`, `toolsV2`, `skills` | `apps/api/src/routers/tools.ts`, `tools-v2.ts`, `packages/skill-engine/src/index.ts` |
| MCP | `/mcp` | `mcp` | `apps/api/src/routers/mcp.ts`, `apps/api/src/services/mcp-client.ts`, `packages/mcp-executor` |
| Models | (model selector) | `models` | `apps/api/src/routers/models.ts`, `packages/llm-router/src/engine.ts` |
| Jobs | `/jobs` | `jobs` | `apps/api/src/routers/jobs.ts`, `apps/api/src/services/cron-scheduler.ts` |
| Runtimes | `/runtimes` | `runtime` | `apps/api/src/routers/runtime.ts`, `packages/runtime-registry/src/index.ts` |
| Host (groups) | `/host` | `host` | `apps/api/src/routers/host.ts` |
| Agents | `/agents` | `agents` | `apps/api/src/routers/agents.ts` |
| Billing | `/billing`, `/settings/billing` | `billing` | `apps/api/src/routers/billing.ts`, `packages/billing/src/index.ts` |
| Settings | `/settings` | `settings` | `apps/api/src/routers/settings.ts` |
| Console | `/console` | `console` | `apps/api/src/routers/console.ts` |
| Notifications | — | `notifications` | `apps/api/src/routers/notifications.ts` |
| Webhooks (inbound) | — | `webhooks` | `apps/api/src/routers/webhooks.ts` |
| Files | — | `files` | `apps/api/src/routers/files.ts` |
| System | — | `system` | `apps/api/src/routers/system.ts` |
| Context (sessions/memories) | — | `context` | `apps/api/src/routers/context.ts` |
| Auth | `/login`, `/register` | `auth` | `apps/api/src/routers/auth.ts` |

## Workflow documents

1. `chat-workflow.md` — send a message and stream a tool-using agent reply
2. `pipeline-run-workflow.md` — build a pipeline, trigger a run, watch nodes execute
3. `agent-tool-workflow.md` — how an agent decides to call a tool and what happens
4. `auth-workflow.md` — register/login/SSO and how identity reaches every route
5. `knowledge-ingest-workflow.md` — upload a document and search it with RAG
6. `marketplace-workflow.md` — browse, clone, install and republish marketplace items

## Honest status legend

The feature docs use: `✅` complete (verified path), `🚧` partial (real but incomplete semantics), `❌` missing/stub, `🔮` future. Where a workflow hits a stub or dead-end, the document says so explicitly (e.g. webhookTrigger is client-side only, humanApproval auto-denies without a callback, loops do not re-run downstream).