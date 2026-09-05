# Project Context: FlowMind

## The Idea

FlowMind began as a question: what if building AI workflows was as visual and accessible as drawing a diagram? The founding vision was a platform where anyone — a developer, a product manager, a researcher — could drag together nodes representing triggers, AI models, tools, and actions, hit "run," and watch a multi-step AI pipeline execute in real time.

The platform was conceived as an "AI Agent OS": not just a pipeline builder, but a complete environment for creating, running, sharing, and monetizing AI-powered automation. Think n8n-class workflow orchestration, but purpose-built for the AI era — where every node can call an LLM, every pipeline can be an agent, and a community marketplace lets creators publish and consumers discover reusable skills and flows.

## Evolution

### Phase 1: Foundation (Commits through early development)

The monorepo was established with pnpm workspaces and Turborepo. The initial architecture placed a Next.js frontend (port 3000) behind a Fastify + tRPC API (port 3001), backed by PostgreSQL via Prisma. Early commits established the pipeline canvas (React Flow), node palette with 24+ node types, pipeline templates (Email Automation, Web Research, Content Factory), and the tRPC API surface.

Marketplace schema was unified: a single `MarketplaceListing` model supports 7 item types (SKILL, PIPELINE, WORKFLOW, PROMPT_PACK, AGENT_TEMPLATE, MCP_INTEGRATION, PLUGIN). The frontend was restructured — `api.ts` was split into domain-specific tRPC modules, 13 settings tabs were built, and the parameterized node component was introduced.

Infrastructure was added: Docker compose, k8s manifests, SSE streaming for real-time pipeline execution, skeleton loading states, responsive layout, typed error classes with user-friendly messages.

### Phase 2: Production Hardening (Commit 2c7b314 and following)

A critical security audit revealed multiple vulnerabilities. The hardening phase addressed them systematically:

**Security fixes:**
- JWT fallback secret now throws in production
- tools-v2 `autoApprove` removed (was an RCE vector) — replaced with server-side single-use approval
- MCP fake tools eliminated — now return honest failures
- Shell injection vectors fixed
- Internal endpoints changed to deny-by-default
- Cross-tenant skill execution blocked
- `/metrics` and SSE endpoints now require Bearer auth
- Webhook HMAC verification added (no fake `received: true`)
- Billing silent auto-upgrade removed
- Chat canned replies flagged with `error: true`

**Pipeline hardening:**
- `codeExecute` runs in `isolated-vm` sandbox
- SSRF guard on all outbound HTTP
- `databaseQuery` restricted to read-only with server-only `DATABASE_URL`
- SSE endpoints scoped per-tenant

**Data security:**
- Provider credential encryption at rest with AES-256-GCM (ENCRYPTION_KEY)

**Reliability:**
- Async pipeline execution with shared active-runs registry
- Run-recovery: on API restart, incomplete runs are detected and recovered

**Testing:** 242 automated tests passing (up from 211 during initial de-mocking), 0 failures, 1 skip.

### Phase 3: Production Build Track (Commit cf3c5c1)

"Track 1" addressed the production build story:
- API now bundles via tsup into a single self-contained `dist/index.js` — all `@flowmind/*` packages are inlined
- Web standalone build fixed via `outputFileTracingRoot`
- Dockerfile aligned with the new build output
- Production artifacts verified: tsup bundle boots; Next.js standalone builds

### Phase 4: Durable State Track (Commit 44cbdc0)

"Track 2" wired real infrastructure:
- **Redis:** Rate-limiting, auth-attempts, and SSO state moved to Redis with memory fallback (429 errors survive API restart; Redis goes down → memory fallback → self-heals when Redis returns)
- **Qdrant:** Real vector store end-to-end — JavaScript `context-engine` and Python `agent-runtime` both write to and query Qdrant; `/knowledge` search returns real Qdrant results

### Phase 5: Connectors Track (Commit 61730ce)

"Track 3" connected the platform to the outside world:
- **MCP client:** Real implementation using `@modelcontextprotocol/sdk` — supports stdio and streamable-http/SSE transports, `tools/list` and `tools/call`, stdio command allowlist + SSRF blocklist, tenant-scoped `McpServer` persistence in the database
- **Offline-verified connectors:** `http_request` agent tool (SSRF-guarded), `sqliteQuery` node, `transform` JSON node, `fileIo` node (traversal-guarded), `flowmind.email.send` with per-user SMTP (verified via local SMTP capture)

## Current Product State

FlowMind runs as a localhost-only dev-mode application. Core flows are functional: user registration and login, pipeline creation and execution, agent chat with tool use, knowledge base management with RAG search, MCP server connection management, and marketplace browsing.

Production build artifacts exist — the tsup-bundled API boots, the Next.js standalone build completes — but the running application uses `tsx watch` and `next dev`. The platform is not deployed to the public internet.

**Grade:** "Local production-verifiable / not yet public-Internet production-ready."

## Key Architectural Decisions

1. **Shared LLM factory** — a single call-site for all LLM interactions ensures consistent retry logic, logging, and token counting across pipelines, agents, and skills.

2. **Active-runs singleton** — an in-memory registry tracks all running pipelines. On API restart, `run-recovery.ts` scans for incomplete runs and resumes or fails them cleanly.

3. **Credentials at rest** — provider API keys (for 15+ cloud LLM providers) are encrypted with AES-256-GCM before database storage. Decryption happens in-memory only, using the `ENCRYPTION_KEY` env var.

4. **Honest-failure philosophy** — after the security audit, the project adopted a strict "never fake success" principle. No mock responses, no canned replies pretending to be real, no `received: true` without verification, no silent billing upgrades. Every error is honest.

5. **tsup over tsc for API bundle** — the monorepo TypeScript compilation was broken (circular deps, Prisma client ordering). tsup produces a single self-contained CJS bundle, inlining all `@flowmind/*` packages.

6. **Native binaries over Docker** — Docker/WSL2 is impossible on the dev box (missing Hyper-V). Redis and Qdrant run as native Windows binaries. Docker/k8s manifests exist for production deployment on real infrastructure.

## Current Direction

The immediate focus is stabilizing the local production-verifiable state: ensuring all core flows work end-to-end with real infrastructure (Postgres, Redis, Qdrant), honest error handling, and passing test suite.

## Future Direction

- Parallel pipeline execution (DAG-based concurrent steps)
- Pipeline versioning and rollback
- Custom node SDK for third-party extensions
- Community marketplace for publishing and discovering skills, flows, and agents
- Enterprise SSO (Okta, Azure AD via SAML/OIDC)
- On-premise deployment (Helm charts, k8s operators)
- Native mobile app for pipeline monitoring and agent chat
- Public SaaS deployment
- Compliance certifications (SOC 2, GDPR readiness)
