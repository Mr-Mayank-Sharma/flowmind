# Feature Catalog

Status markers: ✅ Complete · 🚧 Partial · ❌ Missing/Stub · 🔮 Future

---

## Pipeline & Workflow

| Feature | Status | Notes |
|---------|--------|-------|
| Visual pipeline canvas (React Flow) | ✅ | Drag-and-drop editor, keyboard shortcuts (Ctrl+S, Ctrl+Enter, Delete, Ctrl+D) |
| 24+ node types | ✅ | Triggers, AI, Actions, Flow Control categories |
| Pipeline templates | ✅ | 6 pre-built (Email Automation, Web Research, Content Factory, etc.) |
| Pipeline execution (sequential DAG) | ✅ | Multiple node types execute end-to-end |
| SSE real-time run streaming | ✅ | Per-tenant, Bearer-authed |
| Cron scheduling | ✅ | `node-cron` + `CronJob` records |
| Parallel fork / loop nodes | 🚧 | Nodes exist but execution is not truly concurrent/re-iterating |
| Pipeline versioning / rollback | 🚧 | `version`, `versionHistory`, `snapshot` package exist; UI partial |
| Webhook trigger (server-side) | ❌ | `webhookTrigger` is client-side only; Python runtime lacks `/webhook/ingest` route — inbound webhooks dead-end |
| Custom node SDK | 🔮 | Planned (v0.2 roadmap) |

## Agents & Chat

| Feature | Status | Notes |
|---------|--------|-------|
| Agent chat (CALL_TOOL / FINAL_ANSWER loop) | ✅ | Agent loop in `llm-router` |
| Tool use (built-in tools) | ✅ | read, write, edit, grep, glob, bash, webFetch, webSearch, httpRequest, applyPatch, todoWrite |
| Streaming chat responses (SSE) | ✅ | `/api/chat/stream/:sessionId` |
| Session history & memory | ✅ | `sessions`, `messages`, `memories` tables + `context-engine` |
| Agent configuration (model, temp, tokens) | ✅ | `agents` table + management |
| Long-term memory via vector store | ✅ | Qdrant-backed memory + RAG search |
| 2FA / passkeys | ✅ | TOTP (`otpauth`) + WebAuthn (`@simplewebauthn`) |

## LLM & Model Routing

| Feature | Status | Notes |
|---------|--------|-------|
| Local LLM via Ollama | ✅ | Verified end-to-end |
| Cloud LLM providers (15+) | 🚧 | Provider registry wired; NOT tested (no API keys on dev box) |
| Auto provider fallback | ✅ | `llm-router` handles fallback when a provider is unavailable |
| Provider credential encryption at rest | ✅ | AES-256-GCM with `ENCRYPTION_KEY` |

## Knowledge & RAG

| Feature | Status | Notes |
|---------|--------|-------|
| Knowledge base CRUD | ✅ | `knowledge` tRPC router + `KnowledgeBase` model |
| Document upload (PDF/TXT/MD/CSV/JSON) | ✅ | `KnowledgeDocument` model with chunking |
| Qdrant vector search | ✅ | Real end-to-end integration verified |
| RAG context assembly | ✅ | `context-engine` retrieves and injects context |

## MCP & External Tools

| Feature | Status | Notes |
|---------|--------|-------|
| MCP client (stdio + streamable-http/SSE) | ✅ | `@modelcontextprotocol/sdk` based |
| MCP tools/list + tools/call | ✅ | Real protocol operations |
| Tenant-scoped McpServer persistence | ✅ | `mcp_servers` table |
| Stdio command allowlist + SSRF blocklist | ✅ | Security controls in place |
| OAuth for MCP | 🚧 | `McpToken` model exists; Google/GitHub/Notion scopes declared; full flow not verified |
| `flowmind.*` native MCP tools (10) | ❌ | Stubbed — return placeholder responses |

## Marketplace

| Feature | Status | Notes |
|---------|--------|-------|
| MarketplaceListing (7 item types) | ✅ | SKILL, PIPELINE, WORKFLOW, PROMPT_PACK, AGENT_TEMPLATE, MCP_INTEGRATION, PLUGIN |
| Reviews & ratings | ✅ | `MarketplaceReview`, `SkillReview`, `FlowReview` tables |
| Forks & clones | ✅ | Fork chains tracked |
| Visibility (private/public/team) | ✅ | `Visibility` enum |
| Featured & verified flags | ✅ | `isFeatured`, `isVerified` fields |
| Creator revenue | 🚧 | `CreatorRevenue` table exists; Stripe payouts unconfigured |
| Full consumer/creator UI | 🚧 | Data layer solid; front-end experience partial |

## External Integrations

| Feature | Status | Notes |
|---------|--------|-------|
| HTTP request tool (SSRF-guarded) | ✅ | Verified |
| SQLite query node | ✅ | Verified |
| JSON transform node | ✅ | Verified |
| File I/O node (traversal-guarded) | ✅ | Verified |
| Email send (per-user SMTP) | ✅ | Verified via local SMTP capture |
| Stripe billing | 🚧 | Wired; returns honest error when keys missing — not configured |
| Telegram adapter | ❌ | Channel-gateway exists; not instantiated in prod |
| Slack adapter | ❌ | Channel-gateway exists; not instantiated in prod |
| Discord adapter | ❌ | Channel-gateway exists; not instantiated in prod |
| WhatsApp adapter | ❌ | Non-functional end-to-end |
| SAML SSO | 🚧 | `passport-saml` wired; not end-to-end verified |
| S3/MinIO file storage | 🔮 | Optional; not wired |

## Security & Governance

| Feature | Status | Notes |
|---------|--------|-------|
| JWT auth + refresh | ✅ | Signed HS256, secret throws in production fallback |
| RBAC (platform + org + group roles) | ✅ | USER/ADMIN/SUPER_ADMIN + OWNER/ADMIN/MEMBER/VIEWER |
| Password hashing (bcryptjs, 12 rounds) | ✅ | |
| Rate limiting | ✅ | Per-IP + per-key; Redis-backed with memory fallback |
| Helmet security headers | ✅ | CSP in production |
| SSRF guard | ✅ | All outbound HTTP protected |
| isolated-vm sandbox for codeExecute | ✅ | |
| Internal endpoints deny-by-default | ✅ | Require `AGENT_API_KEY`/`INTERNAL_API_KEY` |
| Cross-tenant execution blocked | ✅ | Skills/pipelines/KB scoped to user/org/group |
| Encryption at rest | ✅ | Provider credentials AES-256-GCM |
| Audit log | ✅ | `audit_logs` table + writes |
| Webhook HMAC verification | ✅ | Stripe signature verified |
| Honest-error handling | ✅ | No fake success anywhere |

## Build & Deployment

| Feature | Status | Notes |
|---------|--------|-------|
| API bundle via tsup | ✅ | Single self-contained `dist/index.js` |
| Web standalone build | ✅ | Fixed via `outputFileTracingRoot` |
| Docker multi-stage build | ✅ | `Dockerfile` targets `api` and `web-runner` |
| docker-compose | ✅ | postgres, api, web, runtime |
| Kubernetes manifests | ✅ | `infra/k8s/` |
| Local dev mode | ✅ | `tsx watch` + `next dev` |
| Public SaaS deployment | ❌ | localhost-only currently |
| AWS deployment | 🔮 | Planned |

## Tests & Quality

| Feature | Status | Notes |
|---------|--------|-------|
| Unit tests | ✅ | 242 passing, 0 failed, 1 skip |
| E2E tests (Playwright) | ✅ | `e2e/health.spec.ts` |
| TypeScript strict checking | ✅ | `tsc --noEmit` on api+web = 0 errors |
