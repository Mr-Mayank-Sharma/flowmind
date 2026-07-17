# FlowMind

AI workflow orchestration platform — Next.js frontend + Fastify/tRPC API + PostgreSQL/Redis/Qdrant.

## Quick Start

```bash
pnpm install          # install + generate Prisma client
cp .env.example .env  # configure DB, LLM keys, etc.
pnpm db:migrate       # run DB migrations
pnpm db:seed          # seed sample data
pnpm dev              # starts api:3001 + web:3000
```

## Project Structure

```
apps/              # Application entry points
  api/             #   Fastify + tRPC server (port 3001)
  web/             #   Next.js 14 App Router (port 3000)
  cli/             #   Command-line tool
  desktop/         #   Electron desktop app
packages/          # Shared libraries (21 packages)
  db/              #   Prisma schema + client
  shared/          #   TypeScript types + enums
  skill-engine/    #   isolated-vm sandboxing
  pipeline-engine/ #   DAG execution
  llm-router/      #   Multi-provider LLM routing
  ...              #   billing, session, context, tools, etc.
infra/             # Docker Compose, K8s manifests
docs/              # Architecture, DR docs
scripts/           # Backup, utility scripts
```

## Key Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start api + web in dev mode |
| `pnpm typecheck` | TypeScript check across all packages |
| `pnpm lint` | ESLint check |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run Playwright e2e tests |
| `pnpm build` | Build all packages |

## Configuration

Set environment variables in `.env` (see `.env.example`). Required:
- `DATABASE_URL` — PostgreSQL connection
- `JWT_SECRET` — min 32-char string
- At least one LLM provider key (OpenAI, Anthropic, etc.)

For production, also configure: `SENTRY_DSN`, `STRIPE_*`, `S3_*`, `RATE_LIMIT_*`.

## Deployment

```bash
docker compose -f infra/compose/production.yml up -d
```

## Architecture

See [docs/architecture.md](docs/architecture.md) for a full overview.
