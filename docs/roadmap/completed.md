# Completed — Genuinely Implemented & Working

Everything in this file is **verified working**, either by live testing (documented in `docs/VERIFICATION-REPORT.md`) or by automated tests that exercise real code paths (not mocks). Items here are safe to build on. Where a feature exists but is only partially real, it lives in [in-progress.md](./in-progress.md), not here.

Reference commits on `main`: `2c7b314` (hardening), `cf3c5c1` (Track 1 — production build), `44cbdc0` (Track 2 — durable state), `61730ce` (Track 3 — connectors).

---

## Auth & Tenant

Status: ✅

- Email/password registration and login with bcrypt cost-12 hashing; JWT access (15 min) + refresh token (7 day) issuance (commit `2c7b314`).
- Login attempt rate limiting keyed by `IP:email` via the state store (`auth:attempts:*`, 5 attempts / 15 min) and SSO state stored with a 600s TTL (`auth:sso:*`).
- Google / GitHub OAuth flow (PKCE where supported): state in Redis, code exchange, profile upsert, token issuance.
- Redis-backed durable state for rate limits, login attempts, and SSO; graceful memory fallback when Redis is unreachable, with self-healing reconnect (`44cbdc0`).
- Tenant isolation verified live: cross-user session/pipeline reads return 404, cross-user skill delete returns 403.
- JWT prod fallback guard: refuses the insecure default secret in production (`2c7b314`).

**Evidence:** VERIFICATION-REPORT §3, §13 (Redis durability), §8 finding 1.

## Chat & Inference (local)

Status: ✅ (local model path only; cloud inference is separate — see [in-progress.md](./in-progress.md))

- Chat with the local Ollama model (llama3.1 etc.) verified through both the UI and the API; real inference with `error: false` (VERIFICATION-REPORT §3).
- Streaming SSE chat with per-tenant scoping; Bearer-token auth on the stream.
- Session memory and session-engine persistence.

**Evidence:** VERIFICATION-REPORT §3, §6 (Ollama Verified).

## Pipelines (core execution)

Status: ✅ (sequential execution, persistence, streaming, cancel & delete)

- Visual canvas builder (React Flow) with 24+ node types across triggers, AI, actions, flow control, and integrations (31 runner kinds in `packages/pipeline-engine/src/runners.ts`).
- Graph persistence with version history (snapshot on update, capped at 50) and restore/rollback (`apps/api/src/routers/pipeline.ts`).
- Async pipeline execution: `pipeline.trigger` creates a `PipelineRun` (status `RUNNING`), registers an `AbortController`, and fires background execution (`executeRunBackground`).
- Topological execution with per-node retry (exponential backoff) and `continueOnFail`.
- Real-time streaming: buffered SSE emitter with replay + live-forward of `node` / `done` / `error` events, tenant-scoped (VERIFICATION-REPORT §3).
- Cancel works: `cancelRun` flips status to `CANCELLED`, aborts the controller, emits `done` (fixed in `2c7b314`).
- Delete with run history succeeds without FK errors (cascade in a transaction; fixed in `2c7b314`).
- Batch trigger: up to 4 concurrent workers over up to 100 inputs with aggregate progress.
- Run recovery: on API boot and every 5 minutes, orphaned `RUNNING` runs are marked `FAILED`.
- Verified live end-to-end: manualTrigger → codeExecute → SUCCESS (VERIFICATION-REPORT §4).

> Note on semantics: parallel/loop/webhook/human-approval/subPipeline are part of the engine but are **not fully implemented** — see [in-progress.md](./in-progress.md#pipeline-flow-semantics-parallel--loop--webhook--subpipeline).

**Evidence:** VERIFICATION-REPORT §3, §4; `docs/features/pipelines.md`.

## Security

Status: ✅

The 20 findings from the hardening audit (`2c7b314`) are fixed and live-verified:

1. JWT fallback secret refused in production.
2. tools-v2 `autoApprove` RCE closed — server-side single-use approval token required.
3. MCP fake tools removed — fail loudly, marked unavailable.
4. MCP shell injection fixed — `execFileSync` with argv arrays (no string interpolation).
5. McpConnectionPool fake connect removed — real reachability probe.
6. Internal endpoints deny-by-default (401) without `AGENT_API_KEY` / `INTERNAL_API_KEY`.
7. Cross-tenant skill execution blocked.
8. `/metrics` Bearer-gated (401 without token, 200 with).
9. SSE token moved from query string to Authorization header.
10. Webhook HMAC verification (Stripe `stripe-signature`); production rejects unverified webhooks; no fake `received: true`.
11. Billing silent auto-upgrade removed — requires explicit `ENABLE_DEV_BILLING_MOCK` (never in prod).
12. Chat canned replies flagged `error: true`, rendered "Not answered" — no fake AI.
13. Pipeline `codeExecute` sandboxed in isolated-vm (`PIPELINE_CODE_EXECUTE_ENABLED` kill switch); SSRF guard on HTTP nodes; `databaseQuery` read-only + server-DATABASE_URL only.
14. SSE pipeline stream per-tenant.
15. Host connect verifies reachability before adding.
16. Provider credentials encrypted at rest with AES-256-GCM (`ENCRYPTION_KEY`) via `ProviderCredential`.
17. Skills install real-persists to database.
18. LSP diagnostics honestly reports "not supported" instead of fake `[]`.
19. `cancelRun` 500 fixed.
20. Pipeline delete FK error fixed (cascade).

Real MCP client security: stdio command allowlist (`MCP_ALLOWED_COMMANDS`), remote URL SSRF blocklist, remote servers disabled by default, no fake `connected: true` (`61730ce`).

**Evidence:** VERIFICATION-REPORT §8, §5, §14 Phase A — Security.

## Connectors & MCP

Status: ✅ (real MCP client + generic offline connectors; the 10 `flowmind.*` stubs are separate — see [in-progress.md](./in-progress.md))

- **Real MCP client** (`@modelcontextprotocol/sdk` v1.30.0) over stdio, SSE, and streamable-http transports: real `tools/list` discovery and `tools/call` invocation with JSON-RPC round-trips against the in-repo demo server and a local SSE test server.
- Tenant-scoped `McpServer` persistence (Prisma `mcp_servers` table) with create/update/delete/test/tools/callTool procedures.
- Agent loop merges per-user MCP tools; a failing server is skipped with persisted `lastError`, never faked.
- `http_request` agent tool — SSRF-guarded (every redirect re-validated), GET-body rejected, body size capped.
- `sqliteQuery` pipeline node — `node:sqlite`, read-only by default under `PIPELINE_DB_ALLOW_WRITE`, path-guarded.
- `transform` JSON node — map/select/rename/summary with `{{ $json.x }}` expression resolution.
- `fileIo` node — read/write JSON/text under `PIPELINE_FILE_ROOT` only; traversal and absolute paths refused.
- `flowmind.email.send` implemented — per-user SMTP via decrypted `ProviderCredential` (AES-256-GCM), verified against a local `smtp-server` capture.

**Evidence:** VERIFICATION-REPORT §5, §14; `docs/features/mcp-integration.md`, `docs/features/connectors.md`.

## Data & State

Status: ✅ (both engines real; fallbacks explicit)

- **Redis** (`44cbdc0`): backs tier rate limiting, login attempts, and SSO state via a `KeyValueStore` interface with in-memory fallback and retry-and-reconnect. Live-verified durable across API restart; self-heals on Redis recovery.
- **Qdrant** vector store (`44cbdc0`, `61730ce`): real embedding + similarity search backed by genuine Qdrant in both the JS context-engine and the Python agent-runtime. Real scores (0.633–0.743) verified live; fallback to JSON-file / memory mode is explicit per-engine.
- Deterministic UUID point ids (Qdrant rejects arbitrary string ids); qdrant-client version-compat shim.

**Evidence:** VERIFICATION-REPORT §13, §9.

## Build & Deploy Artifacts

Status: ✅ (build verification only; public deployment is separate — see remaining.md)

- **API production build:** tsup bundles `apps/api` into a self-contained CJS `dist/index.js` (all `@flowmind/*` inlined); boots via `node dist/index.js` (`cf3c5c1`).
- **Web production build:** Next.js standalone build succeeds (`outputFileTracingRoot` fix).
- Dockerfile aligned: multi-stage targets `api` and `web-runner`.

> Docker images themselves are **not validated** (cannot build on the dev box, no Hyper-V) — see [in-progress.md](./in-progress.md#docker-image-validation).

**Evidence:** VERIFICATION-REPORT §2, §9; `docs/context/development-history.md` Phase 3.

## Tests

Status: ✅

- **242 automated tests passing** (241 pass, 1 intentional integration skip), 0 failures. Breakdown in VERIFICATION-REPORT §7 (api 29, web 7, auth 9, billing 5, mcp-executor 19, context-engine 3, runtime-registry 16, channel-gateway 15, llm-router 16, permission 14, snapshot 8, session-engine 11, pipeline-engine 66, skill-engine 20, tool-system 4).
- **Playwright e2e:** 3 health checks pass.
- **Browser smoke:** full 8-step smoke test passes.
- Grand total 253 test points, 0 failures.
- `tsc --noEmit` → 0 errors across tool-system, pipeline-engine, mcp-executor, apps/api, apps/web.

**Evidence:** VERIFICATION-REPORT §7, §14 Track 3 tests.

## Other working subsystems

- **Host federation / RBAC** (host + group access) — strongest subsystem per audit ([REBUILD-PLAN.md](../REBUILD-PLAN.md)).
- **Skills**: sandboxed JS skill execution, install, publish, versioning are real (`docs/features/skills.md`).
- **Marketplace**: publish / install / fork / clone / versioning / rating flows are real for skills and generic listings (two parallel marketplaces — see [in-progress.md](./in-progress.md#marketplace) and `docs/features/marketplace.md`).
- **Usage/billing service**: Stripe integration shape and tier config real, but gated off (no keys) — see [in-progress.md](./in-progress.md#billing-stripe) and `docs/features/billing.md`.
