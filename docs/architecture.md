# FlowMind Architecture

## Overview

FlowMind is an AI workflow orchestration platform. It uses a monorepo (pnpm workspaces + Turborepo) with two application entry points and 21 shared packages.

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   apps/web   │────▶│     apps/api     │────▶│  Postgres     │
│  (Next.js)   │     │  (Fastify+tRPC)  │     │  Redis        │
│              │     │                  │     │  Qdrant       │
│  Port 3000   │     │   Port 3001      │     │  S3/MinIO     │
└──────────────┘     └──────────────────┘     └──────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
              apps/cli          apps/desktop
              (CLI tool)        (Electron)
```

## Applications

| App | Framework | Purpose |
|---|---|---|
| `apps/web` | Next.js 14 + React 18 | Main web UI (pipelines, chat, settings) |
| `apps/api` | Fastify 4 + tRPC 11 | REST + tRPC API server |
| `apps/cli` | Commander | CLI for pipeline management |
| `apps/desktop` | Electron | Desktop wrapper |
| `apps/docs` | — | Documentation |

## Key Packages

### Core Infrastructure
| Package | Role |
|---|---|
| `@flowmind/db` | Prisma schema and client (PostgreSQL) |
| `@flowmind/shared` | Shared TypeScript types and enums |
| `@flowmind/billing` | Stripe billing integration |
| `@flowmind/session-engine` | Session management |

### Pipeline & Execution
| Package | Role |
|---|---|
| `@flowmind/pipeline-engine` | DAG pipeline execution |
| `@flowmind/skill-engine` | Isolated skill sandboxing (isolated-vm) |
| `@flowmind/tool-system` | Tool registry and execution |
| `@flowmind/plugin-engine` | Plugin management |
| `@flowmind/context-engine` | Context retrieval and RAG |

### AI & Providers
| Package | Role |
|---|---|
| `@flowmind/llm-router` | Multi-provider LLM routing |
| `@flowmind/provider-registry` | Provider configuration |
| `@flowmind/mcp-executor` | MCP tool execution |
| `@flowmind/permission` | Permission management |

### Communication
| Package | Role |
|---|---|
| `@flowmind/channel-gateway` | Multi-channel (Telegram, Slack, Discord, WhatsApp) |
| `@flowmind/agent-runtime` | AI agent execution runtime |

## API Layer

- **Transport**: Fastify with tRPC adapter (all business logic via tRPC procedures)
- **Non-tRPC routes**: `/health`, `/metrics`, `/api/stripe/webhook`, `/api/internal/create-pipeline`
- **Auth**: JWT with bcrypt password hashing, optional Google/GitHub SSO
- **Rate limiting**: `@fastify/rate-limit` (configurable via `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`)
- **Logging**: Pino (structured JSON, request IDs via Fastify logger)
- **Error tracking**: Sentry (no-op when `SENTRY_DSN` not set)
- **CORS**: Restricted to configured APP_URL and localhost origins

## Frontend

- **Framework**: Next.js 14 with App Router
- **State**: Zustand stores + React Query
- **UI**: Tailwind CSS + Radix UI primitives
- **API client**: Hand-rolled fetch wrapper (`lib/api.ts`) + typed tRPC client (`lib/trpc.ts`)
- **Error boundary**: React ErrorBoundary with Sentry integration

## Infrastructure

- **Containers**: Docker Compose (local + production) and Kubernetes manifests
- **Database**: PostgreSQL 16 (primary), Redis 7 (cache), Qdrant (vector store)
- **File storage**: S3-compatible (MinIO for dev)
- **Reverse proxy**: Traefik (production Compose stack)
- **CI**: GitHub Actions (lint, typecheck, test, pnpm audit)

## Security

- **Skill sandboxing**: isolated-vm (128 MB memory limit, 5s CPU timeout)
- **No global/process/require access in sandboxed code**
- **Dependency scanning**: pnpm audit in CI, Dependabot weekly
- **Auth**: JWT (15min access + 7d refresh), bcrypt(12) passwords

## Observability

- **Metrics**: Prometheus format at `/metrics` (via prom-client)
- **Health**: `/health` with DB connectivity check
- **Logs**: Structured JSON via pino
- **Errors**: Sentry (client + server, when configured)

## Data Flow

```
User → Next.js (apps/web) → fetch → Fastify (apps/api) → tRPC procedure
  → Service (ChatService, etc.) → Prisma → PostgreSQL
  → ContextEngine → Qdrant
  → LLMRouter → OpenAI/Anthropic/Ollama
  → ChannelGateway → Telegram/Slack/Discord
```
