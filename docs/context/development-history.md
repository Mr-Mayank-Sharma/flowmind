# Development History

A chronological, factual record of FlowMind's development. Derived from git history and verified session knowledge.

---

## Phase 1: Monorepo Foundation

**Established:** pnpm 9 + Turborepo monorepo with `apps/*` and `packages/*` workspaces.

Initial commits built the core stack:
- `apps/api`: Fastify + tRPC v11, port 3001
- `apps/web`: Next.js 14 + React Flow, port 3000
- `packages/db`: Prisma schema with PostgreSQL
- `packages/shared`: Common types and utilities

Early features:
- Pipeline canvas with React Flow (drag-and-drop node editor)
- Node palette with 24+ node types across Triggers, AI, Actions, and Flow Control
- 6 pipeline templates (Email Automation, Web Research, Content Factory, etc.)
- tRPC API surface with auth, chat, pipeline, marketplace, settings routers
- Skeleton loading states, responsive layout, toast notifications

**Schema unification:** `MarketplaceListing` model unified to support 7 item types (SKILL, PIPELINE, WORKFLOW, PROMPT_PACK, AGENT_TEMPLATE, MCP_INTEGRATION, PLUGIN).

**Frontend restructuring:** `api.ts` split into domain-specific tRPC modules; 13 settings tabs built; parameterized node component introduced.

**Infrastructure:** Docker compose, k8s manifests, SSE streaming for real-time pipeline execution, typed error classes with user-friendly messages and documentation suite.

---

## Phase 2: Production Hardening

**Key commit:** `2c7b314` (hardening pass)

A full production audit was conducted. The following issues were identified and fixed:

### Security Fixes
- **JWT fallback secret:** Now throws in production if `JWT_SECRET` is the insecure default (`apps/api/src/lib/jwt-secret.ts`)
- **tools-v2 autoApprove RCE:** Removed client-side auto-approval. Replaced with server-side single-use approval flow
- **MCP fake tools:** Eliminated mock tool responses. Now return honest failures when MCP server is unreachable
- **Shell injection:** Fixed in tool-system bash execution
- **Internal endpoints:** Changed to deny-by-default. `/api/internal/*` requires `AGENT_API_KEY` / `INTERNAL_API_KEY`; if unset, endpoints are denied
- **Cross-tenant skill execution:** Blocked — skills are scoped to users/orgs/groups
- **/metrics auth:** Now requires Bearer token (uses `AGENT_API_KEY` / `INTERNAL_API_KEY`)
- **SSE auth:** Per-tenant scope enforced on both chat and pipeline SSE endpoints
- **Webhook HMAC:** Stripe webhooks verified with `stripe-signature` header; removed fake `received: true` without verification
- **Billing silent auto-upgrade:** Removed — upgrading tier now requires explicit user action
- **Chat canned replies:** Flagged with `error: true` instead of pretending to be real AI responses

### Pipeline Hardening
- **codeExecute sandbox:** Runs in `isolated-vm` — no arbitrary code execution outside the sandbox
- **SSRF guard:** All outbound HTTP goes through `fetchPublic` / `FetchPublic` with blocklist
- **databaseQuery:** Restricted to read-only; uses server-only `DATABASE_URL` (never user-provided)
- **SSE per-tenant:** Pipeline and chat SSE streams are scoped to the authenticated user

### Data Security
- **Provider credential encryption:** API keys for cloud LLM providers encrypted at rest with AES-256-GCM using `ENCRYPTION_KEY`

### Reliability
- **Async pipelines:** Pipeline execution moved to async with shared active-runs registry
- **Run recovery:** On API restart, `startRunRecovery()` scans for incomplete `PipelineRun` records and recovers or fails them cleanly

### Test De-Mocking
- Tests migrated from mocked responses to real integrations
- 242 automated tests passing (up from 211), 0 failures, 1 skip

---

## Phase 3: Production Build (Track 1)

**Key commit:** `cf3c5c1`

The production build was broken due to monorepo TypeScript compilation issues (circular dependencies, Prisma client ordering).

**Solution:** API now bundles via tsup into a single self-contained `dist/index.js`:
- Entry: `apps/api/src/index.ts`
- All `@flowmind/*` packages are inlined (`noExternal: [/^@flowmind\//]`)
- Format: CJS, platform: node, target: node18
- External only: `@prisma/client`, `isolated-vm`

**Web standalone build:** Fixed via `outputFileTracingRoot` in `next.config.js`.

**Dockerfile aligned:** Multi-stage build targets `api` (tsup bundle) and `web-runner` (Next.js standalone).

**Verified:** tsup bundle boots (`node dist/index.js`); Next.js standalone builds successfully.

---

## Phase 4: Durable State (Track 2)

**Key commit:** `44cbdc0`

### Redis Integration
- Rate-limiting backed by Redis (falls back to in-memory if Redis unavailable)
- Auth-attempts tracking in Redis (survives API restart)
- SSO state in Redis
- Self-healing: if Redis goes down, system falls back to memory; when Redis returns, system reconnects

### Qdrant Vector Store
- End-to-end real vector integration
- JavaScript `context-engine` writes embeddings to Qdrant and performs similarity search
- Python `agent-runtime` also writes to Qdrant
- `/knowledge` search endpoint returns real Qdrant results
- Default embedding model: `nomic-embed-text` (via Ollama)

**Note:** Both Redis and Qdrant run as native Windows binaries on the dev box. Docker/WSL2 is impossible due to missing Hyper-V.

---

## Phase 5: Connectors (Track 3)

**Key commit:** `61730ce`

### Real MCP Client
- Uses `@modelcontextprotocol/sdk` (not a custom implementation)
- Supports stdio and streamable-http/SSE transports
- `tools/list` and `tools/call` operations
- Stdio command allowlist + SSRF blocklist for security
- Tenant-scoped `McpServer` persistence in PostgreSQL
- Agent can call external MCP tools during conversation

### Offline-Verified Connectors
- `http_request` agent tool: SSRF-guarded, tested against local endpoints
- `sqliteQuery` node: Query SQLite databases from pipelines
- `transform` node: JSON transformation within pipelines
- `fileIo` node: File read/write with path traversal guard
- `flowmind.email.send`: Per-user SMTP email, verified via local SMTP capture (Mailhog/test containers)

---

## Current State

- All 5 phases complete
- Local development fully functional
- Production build artifacts verified (tsup bundle, Next.js standalone)
- Running in dev mode (`tsx watch` / `next dev`)
- Not deployed to public internet
- 242 automated tests passing
- Known issues documented (see `docs/context/ai-context.md` — Known Problems section)

---

## Commit Reference

| Commit | Description |
|--------|-------------|
| `2c7b314` | Production audit and hardening pass |
| `cf3c5c1` | Track 1 — production build (tsup API bundle, standalone web) |
| `44cbdc0` | Track 2 — durable state (Redis, Qdrant real integration) |
| `61730ce` | Track 3 — connectors (MCP client, verified connectors) |
