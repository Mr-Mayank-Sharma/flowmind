# FlowMind

<p align="center">
  <strong>Build, run, and share AI-powered workflows and agents — all in one place.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-blue" alt="Version 0.1.0" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License MIT" />
  <img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node >=22" />
  <img src="https://img.shields.io/badge/pnpm-%3E%3D9-orange" alt="pnpm >=9" />
  <img src="https://img.shields.io/badge/PRs-welcome-purple" alt="PRs Welcome" />
  <img src="https://img.shields.io/badge/status-alpha-yellow" alt="Alpha" />
</p>

FlowMind is an AI Agent OS: a platform for creating multi-step AI pipelines, chat agents, and reusable skills. Connect any LLM provider, orchestrate complex workflows visually, and publish to a community marketplace.

![FlowMind Pipeline Canvas](docs/assets/canvas-screenshot.png)

## System Requirements

| Component | Requirement |
|-----------|-------------|
| **Node.js** | >= 22.x |
| **pnpm** | >= 9.x (use `corepack enable && corepack prepare pnpm@9.15.4 --activate`) |
| **PostgreSQL** | 16+ (required) |
| **Redis** | 7+ (required for sessions, queues, SSE) |
| **Qdrant** | (optional) Vector search for memory/context |
| **Ollama** | (optional) Local LLM inference |
| **MinIO / S3** | (optional) File uploads and artifact storage |
| **OS** | Linux, macOS, or Windows (WSL2 recommended) |

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 22.x
- [pnpm](https://pnpm.io/) >= 9.x (install via `npm install -g pnpm` or `corepack enable`)
- [PostgreSQL](https://www.postgresql.org/) 16+ running locally
- [Redis](https://redis.io/) 7+ running locally

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/flowmind.git
cd flowmind

# Install dependencies (pnpm workspace)
pnpm install

# Create environment file (edit with your credentials)
cp .env.example .env

# Generate Prisma client from schema
pnpm db:generate

# Run database migrations (creates tables)
pnpm db:migrate

# Optional: bootstrap an admin user/org (no-op without env)
#   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... pnpm db:seed

# Start development servers (api on :3001, web on :3000)
pnpm dev
```

Open http://localhost:3000 and register a new account, or bootstrap an admin with `ADMIN_EMAIL`/`ADMIN_PASSWORD` before starting.

> **Note**: On first run, the API auto-detects missing env vars and logs warnings. At minimum, set `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, and one LLM API key (e.g. `OPENAI_API_KEY`).

## Authentication & Security

FlowMind ships with a multi-layered security model:

### JWT Authentication

- Sessions are managed via signed JWTs (`jsonwebtoken` with HS256)
- Access tokens expire per configurable window; refresh tokens enable silent rotation
- Passwords are hashed with **bcryptjs** (12 salt rounds)
- Fastify middleware guards all tRPC routes; unauthenticated requests return 401

### API Keys

- Programmatic access via API keys managed in the dashboard or CLI (`flowmind agent`)
- Keys are scoped to specific permissions and can be revoked individually
- Rate limiting applied per key (configurable via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW`)

### Role-Based Access Control (RBAC)

Two role systems work together:

**Platform Roles** (`UserRole`): `USER`, `ADMIN`, `SUPER_ADMIN`

**Organization Roles** (`OrgRole`):
| Role | Typical Permissions |
|------|-------------------|
| `OWNER` | Full access — billing, audit log, SSO, team management, all permissions |
| `ADMIN` | Manage projects, pipelines, skills, team, API keys, integrations |
| `MEMBER` | Create and edit pipelines, manage skills and memory |
| `VIEWER` | View projects and pipelines, execute runs (read-only) |

Permissions are granular: `VIEW_PROJECTS`, `CREATE_PIPELINES`, `MANAGE_SKILLS`, `MANAGE_BILLING`, `EXPORT_DATA`, and 20+ more (see `packages/auth/src/rbac.ts`).

### Additional Security Features

- **2FA / Passkeys**: Time-based OTP (`otpauth`) and WebAuthn passkey support (`@simplewebauthn`)
- **SSO**: SAML-based single sign-on via `passport-saml` (Okta, Azure AD, etc.)
- **Helmet**: HTTP security headers via `@fastify/helmet`
- **Rate Limiting**: Per-IP and per-key rate limits via `@fastify/rate-limit`
- **Sentry**: Error tracking and performance monitoring (optional, set `SENTRY_DSN`)
- **Encryption at Rest**: Sensitive LLM API keys and credentials are encrypted with `ENCRYPTION_KEY`

## Architecture

```
Web UI (Next.js) ──tRPC──> API (Fastify) ──> Pipeline Engine
                     │              │              │
                     │         LLM Router    Skill Engine
                     │              │              │
                   Tool System   Channel Gateway
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
  auth/              JWT, RBAC, 2FA, SAML SSO
  billing/           Stripe integration (FREE / PRO / TEAM / ENTERPRISE)
  context-engine/    Session memory and context assembly
  permissions/       File-level permission evaluation (open-code style)
  mcp-executor/      MCP protocol executor with OAuth
  shared/            Common types and utilities
  ui/                Shared shadcn/ui React components
  ...                session, snapshot, lsp, provider-registry, plugin-engine, etc.
```

## Key Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start api + web in dev mode |
| `pnpm typecheck` | TypeScript check across all packages |
| `pnpm test` | Run unit tests |
| `pnpm build` | Build all packages |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:seed` | Bootstrap admin user/org (env-gated; no-op without `ADMIN_EMAIL`/`ADMIN_PASSWORD`) |
| `pnpm lint` | Lint all packages |
| `pnpm cli --help` | Run the CLI tool |

## CLI Usage

FlowMind includes a full-featured CLI (`apps/cli`) built with Commander.js. Run it via `pnpm cli` or `pnpm flowmind`.

```
Usage: flowmind [command]

Commands:
  agent [options]     Manage AI agents
    list              List all agents with status, model, cost
    create -n <name>  Create a new agent
    delete -i <id>    Delete an agent
    toggle            Toggle agent memory or status
    show -i <id>      Show detailed agent info

  pipeline [options]  Manage pipelines
    list              List all pipelines with status
    create -n <name>  Create a new pipeline
    delete -i <id>    Delete a pipeline
    run -i <id>       Execute a pipeline

  model               Manage LLM models
  mcp                 Manage MCP tool integrations
  context             Manage agent context / memory
  governance          Manage governance rules
  chat                Interactive chat with agents
  skill               Manage marketplace skills
  interactive (i)     Start interactive REPL mode
  help                Show help
```

## API Overview

FlowMind exposes a **tRPC v11** API over HTTP on port `3001`. The API uses the Fastify web server with the following capabilities:

### Core Endpoints

| Path | Description |
|------|-------------|
| `/trpc/*` | All tRPC procedures (pipelines, agents, skills, sessions, etc.) |
| `/health` | Health check endpoint |
| `/metrics` | Prometheus metrics (via `prom-client`) |
| `/api/v1/*` | REST compatibility routes |

### Transport

- **HTTP POST** — Standard tRPC query/mutation calls (JSON serialized)
- **SSE** — Server-Sent Events for real-time pipeline execution streaming and agent response streaming (via `getRunEmitter` / `getSessionEmitter`)
- **Batching** — tRPC supports automatic request batching

### Authentication

- Requests to `/trpc/*` require a valid JWT in the `Authorization: Bearer <token>` header
- Health and metrics endpoints are unauthenticated
- API key auth available for programmatic access (pass via `x-api-key` header)

### Tool System API

The API integrates with a built-in tool system available to agents and pipelines:
- `read`, `write`, `edit`, `grep`, `glob`, `bash`, `webFetch`, `webSearch`, `applyPatch`, `todoWrite`
- Tools are registered in `apps/api/src/index.ts` and dispatched via the `tool-system` package
- Fine-grained permissions are evaluated by the `permission` package (minimatch-based rule sets)

### Error Handling

All errors are typed (`@flowmind/errors`) with machine-readable codes and user-friendly messages. The Fastify server uses global error handlers and Sentry integration for production error tracking.

## Docker Deployment

FlowMind includes a multi-stage `Dockerfile` at the project root and a `deploy/docker-compose.yml` for orchestrated deployment.

### Services

The compose file defines 4 services:

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| `postgres` | postgres:16-alpine | 5432 | Primary database |
| `api` | custom (Dockerfile target: `api`) | 3001 | Fastify tRPC server |
| `web` | custom (Dockerfile target: `web-runner`) | 3000 | Next.js frontend |
| `runtime` | custom (packages/agent-runtime) | 8001 | Python agent runtime |

### Quick Start

```bash
# Build and start all services
cd deploy
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

### Environment Variables for Docker

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | *(required)* | JWT signing secret |
| `APP_URL` | `http://localhost:4000` | Public-facing app URL |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `RATE_LIMIT_MAX` | `200` | Max requests per window |
| `RATE_LIMIT_WINDOW` | `1 minute` | Rate limit window |
| `OLLAMA_HOST` | `http://host.docker.internal:11434` | Ollama server for runtime |
| `AGENT_API_KEY` | *(optional)* | API key for agent runtime |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:4000` | Allowed CORS origins |
| `SENTRY_DSN` | *(optional)* | Sentry error tracking DSN |

### Production Build

```bash
# Build the API image
docker build --target api -t flowmind-api .

# Build the Web image (with custom API URL)
docker build --target web-runner \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
  -t flowmind-web .
```

## Configuration Reference

All environment variables are defined in `.env.example`. Below is the full reference grouped by category.

### Database & Storage

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/flowmind`) |
| `REDIS_URL` | Yes | — | Redis connection string (e.g. `redis://localhost:6379`) |
| `QDRANT_URL` | No | `http://localhost:6333` | Qdrant vector database URL |

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | — | JWT signing secret (min 32 chars) |
| `ENCRYPTION_KEY` | Yes | — | AES encryption key for credentials (min 32 chars) |

### LLM Providers

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | No | — | OpenAI API key (for GPT-4, GPT-4o, etc.) |
| `ANTHROPIC_API_KEY` | No | — | Anthropic API key (for Claude models) |
| `GOOGLE_AI_API_KEY` | No | — | Google AI API key (for Gemini models) |
| `OLLAMA_URL` | No | `http://localhost:11434` | Ollama server URL for local models |

### Billing (Stripe)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | For billing | — | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | For billing | — | Stripe webhook signing secret |
| `STRIPE_PRICE_FREE` | For billing | — | Stripe price ID for Free tier |
| `STRIPE_PRICE_PRO` | For billing | — | Stripe price ID for Pro tier |
| `STRIPE_PRICE_TEAM` | For billing | — | Stripe price ID for Team tier |
| `STRIPE_PRICE_ENTERPRISE` | For billing | — | Stripe price ID for Enterprise tier |

### File Storage (S3 / MinIO)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `S3_ENDPOINT` | For uploads | `http://localhost:9000` | S3-compatible endpoint |
| `S3_ACCESS_KEY` | For uploads | — | S3 access key |
| `S3_SECRET_KEY` | For uploads | — | S3 secret key |

### Channel Gateway (Messaging)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | No | — | Telegram bot token |
| `SLACK_CLIENT_ID` | No | — | Slack OAuth client ID |
| `SLACK_CLIENT_SECRET` | No | — | Slack OAuth client secret |
| `DISCORD_BOT_TOKEN` | No | — | Discord bot token |
| `WHATSAPP_PHONE_NUMBER_ID` | No | — | WhatsApp Business phone number ID |
| `WHATSAPP_ACCESS_TOKEN` | No | — | WhatsApp access token |
| `WHATSAPP_VERIFY_TOKEN` | No | — | WhatsApp webhook verify token |

### OAuth (MCP Tools)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_CLIENT_ID` | No | — | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | No | — | GitHub OAuth app client secret |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | — | Google OAuth client secret |
| `NOTION_CLIENT_ID` | No | — | Notion integration client ID |
| `NOTION_CLIENT_SECRET` | No | — | Notion integration client secret |

### Application

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_URL` | No | `http://localhost:3000` | Public URL of the web app |
| `API_URL` | No | `http://localhost:3001` | Public URL of the API server |
| `NODE_ENV` | No | `development` | Environment (`development`, `production`, `test`) |
| `LOG_LEVEL` | No | `info` | Pino logger level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) |
| `API_PORT` | No | `3001` | API server port |
| `API_HOST` | No | `0.0.0.0` | API server host |
| `SENTRY_DSN` | No | — | Sentry DSN for error tracking |
| `SENTRY_TRACES_SAMPLE_RATE` | No | `0.1` | Sentry traces sample rate (0.0 - 1.0) |

## Troubleshooting

### Database Connection Issues

```
Error: Can't reach database server
```
- Ensure PostgreSQL is running: `pg_isready`
- Verify `DATABASE_URL` in `.env` is correct
- Check that the database `flowmind` exists: `createdb flowmind`

### Redis Connection Issues

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
- Ensure Redis is running: `redis-cli ping` should return `PONG`
- Check `REDIS_URL` in `.env`

### Prisma / Migration Errors

```
Error: P1001: Can't reach database server
```
- Run `pnpm db:generate` to regenerate the Prisma client
- If migrations fail, reset: `pnpm db:migrate -- --force` (destructive — backups advised)
- Ensure the database user has `CREATE` privileges

### Port Conflicts

```
Error: listen EADDRINUSE :::3001
```
- The API port (3001) or web port (3000) is already in use
- Kill the existing process or change ports via `API_PORT` / `WEB_PORT` env vars
- On Windows: `netstat -ano | findstr :3001` then `taskkill /PID <pid> /F`

### LLM Provider Errors

```
LLM Router: No available provider
```
- At least one LLM API key must be set (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_AI_API_KEY`)
- For local models, ensure Ollama is running and `OLLAMA_URL` is correct
- Check that the selected model is available (pull it: `ollama pull llama3.1`)

### TypeScript Build Errors

```
pnpm typecheck fails with type mismatches
```
- Run `pnpm db:generate` first (Prisma types may be stale)
- Ensure you're on Node.js >= 22
- Clear node_modules and reinstall: `pnpm clean && pnpm install`

### Web UI Blank / API Unreachable

```
Web UI loads but says "API unreachable"
```
- Verify the API is running on port 3001
- Check `NEXT_PUBLIC_API_URL` in the web build (default: `http://localhost:3001`)
- Ensure CORS is configured: `http://localhost:3000` should be in the allowed origins

## Roadmap

### v0.2 (Next)
- [ ] **Parallel node execution** — DAG-based concurrent pipeline steps
- [ ] **Pipeline versioning** — Snapshot and rollback pipeline revisions
- [ ] **Custom node SDK** — Build and publish custom node types
- [ ] **Agent memory persistence** — Long-term memory via vector store (Qdrant)
- [ ] **Enhanced monitoring** — Per-node latency, cost breakdown, execution traces

### v0.3
- [ ] **Multi-tenant organizations** — Team workspaces with shared pipelines
- [ ] **Audit log** — Full activity trail for compliance
- [ ] **Conditional branching UI** — Visual if/else and switch nodes
- [ ] **Slack/Teams deep integration** — Interactive messages, forms, approvals
- [ ] **API rate limit dashboard** — Visual rate consumption per key

### v1.0
- [ ] **Community marketplace** — Publish and discover pipelines, skills, and agents
- [ ] **Enterprise SSO** — Okta, Azure AD, OneLogin (SAML/OIDC)
- [ ] **On-premise deployment** — Helm charts, Kubernetes manifests
- [ ] **Native mobile app** — Trigger pipelines, monitor runs, chat with agents
- [ ] **Compliance certifications** — SOC 2, GDPR readiness

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
