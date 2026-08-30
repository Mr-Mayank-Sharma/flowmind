# FlowMind Production-Readiness Verification Report

**Date:** 2026-08-29
**Pass:** Hardening + Build Verification
**Environment:** Local development (all services on localhost)

---

## 1. Architecture Status

**Monorepo structure:**

| Layer | Tech | Location |
|-------|------|----------|
| Web UI | Next.js 14, tRPC, Zustand | `apps/web` |
| API | Fastify + tRPC v11 | `apps/api` |
| Agent Runtime | Python FastAPI | `agent-runtime/` |
| Packages | pipeline-engine, llm-router, provider-registry, mcp-executor, skill-engine, tool-system, auth, billing, db (Prisma/Postgres), context-engine, session-engine, runtime-registry, channel-gateway, lsp, snapshot, permission, plugin-engine | `packages/*` |

**Optional infrastructure:** Qdrant (vector store) — **live on :6333**, used by the JS context-engine and Python agent-runtime. Redis — **live on :6379**, backs rate-limit/login-attempt/SSO-state durability with an in-memory fallback path.

**Local model:** Ollama on port 11434.

---

## 2. Deployment Status

All services running on this machine:

| Service | Endpoint | Status |
|---------|----------|--------|
| Web UI | http://localhost:3000 | Running |
| API | http://localhost:3001 | Running — health `{database: true, agentRuntime: true}` |
| Agent Runtime | 127.0.0.1:8001 | Running |
| Postgres | :5433 | Running |
| Ollama | :11434 | Running |
| Redis | :6379 | Running (native binary, Docker/WSL2 unavailable on this box) |
| Qdrant | :6333/:6334 | Running (native binary, Docker/WSL2 unavailable on this box) |

**Stability notes:** Web restarted once, API restarted twice during this pass. Recovery sweep active. All services stable after restart.

---

## 3. Features Verified (Live)

| Feature | Status | Evidence |
|---------|--------|----------|
| Auth / Login + JWT | Verified | Login flow works, JWT issued and validated |
| Chat with Ollama | Verified | Real inference through UI and API; reply produced, `error: false` |
| Tenant isolation — cross-user session/pipeline read | Verified | 404 on cross-user session/pipeline read |
| Tenant isolation — cross-user skill delete | Verified | 403 on cross-user skill delete |
| Metrics — unauthenticated | Verified | 401 without token |
| Metrics — authenticated | Verified | 200 with Bearer token |
| Internal endpoints — deny-by-default | Verified | 401 without token |
| Billing checkout — unconfigured | Verified | Honest error returned (no silent behavior) |
| Pipeline create → trigger → SUCCESS | Verified | Output produced |
| Pipeline cancel | Verified | Fixed this pass — now returns CANCELLED cleanly |
| Pipeline delete with run history | Verified | Fixed this pass — succeeds without FK errors |
| Pipeline builder / settings / pipelines pages | Verified | All render correctly |

---

## 4. Pipeline Testing Details

| Test | Result | Notes |
|------|--------|-------|
| manualTrigger → codeExecute | SUCCESS | Output produced |
| httpRequest to 169.254.169.254 (SSRF) | FAILED | Blocked by SSRF guard — as expected |
| Infinite code node → cancel | CANCELLED | Cancel works cleanly |
| Delete pipeline with run history | SUCCESS | Fixed this pass |

**Not individually live-tested this pass (present in engine but untested):** parallel execution, loops, cron triggers, webhooks, human-in-the-loop. These features exist in the pipeline-engine code but were not exercised during this verification pass.

---

## 5. Connectors & Tools

### Built-in Tools

| Tool | Status | Notes |
|------|--------|-------|
| Files | Verified | Sandboxed per-user |
| Code Sandbox | Verified | Isolated-VM: blocks `require`, `process`, `fetch`; times out infinite loops |
| HTTP | Verified | SSRF-guarded |

### MCP Integration

- Fake tools removed — registry now fails loudly and marks unavailable
- Shell injection fixed (execFileSync with argv arrays)
- Connection pool uses real reachability probe (not fake connect)
- **Honesty fix:** Not-implemented tools throw instead of returning fake success

### External Connectors

**Present but NOT live-validated against external services** (see §11 Externally Blocked):
Slack, GitHub, Notion, email delivery — all exist as connector definitions but were not connected to real external accounts.

---

## 6. Models

| Provider | Status | Notes |
|----------|--------|-------|
| Ollama (local) | Verified | Real inference confirmed (llama3.1 etc.) |
| 16 cloud providers | Wiring tested | NOT tested with real credentials (externally blocked) |

**Cloud provider configs wired:** OpenAI, Anthropic, Google, Groq, DeepSeek, OpenRouter, Together, Mistral, Perplexity, DeepInfra, Cerebras, xAI, Cohere, Cloudflare, Venice AI, Alibaba.

UI key persistence functional.

---

## 7. Test Counts

### Automated Test Suites

| Suite | Tests |
|-------|-------|
| apps/api | 29 |
| apps/web | 7 |
| auth | 9 |
| billing | 5 |
| mcp-executor | 19 (real client stdio/HTTP/security — was 4) |
| context-engine | 3 |
| runtime-registry | 16 |
| channel-gateway | 15 |
| llm-router | 16 |
| permission | 14 |
| snapshot | 8 |
| session-engine | 11 |
| pipeline-engine | 66 (65 passed + 1 skip; incl. 10 connector + 1 email tests — was 54) |
| skill-engine | 20 |
| tool-system | 4 (http_request SSRF tests — new) |
| **Total automated** | **242** |

- **Passed:** 241
- **Failed:** 0
- **Skipped:** 1 (intentional integration skip)

### E2E / Browser

- Playwright e2e health checks: **3 pass** (Track 1 pass)
- Full 8-step browser smoke test: **all pass** (Track 1 pass)

**Grand total: 242 automated + 3 Playwright + 8 browser smoke = 253 test points, 0 failures.**

---

## 8. Security Findings & Fixes

All findings below were identified, fixed, and verified live during this pass:

| # | Finding | Fix |
|---|---------|-----|
| 1 | JWT fallback-secret in production | Guard in auth + JWT strategy — refuses fallback in prod |
| 2 | tools-v2 `autoApprove` RCE bypass | Server-side single-use approval token required |
| 3 | MCP fake tools returning success | Fail loudly; registry marks tool unavailable |
| 4 | MCP shell injection | `execFileSync` with argv arrays (no string interpolation) |
| 5 | McpConnectionPool fake connect | Real reachability probe |
| 6 | Internal endpoints accessible without auth | Deny-by-default 401; agent-runtime sends token |
| 7 | Cross-tenant skill execution | Gated — denied for unauthorized tenants |
| 8 | Metrics unauthenticated access | Bearer-gated |
| 9 | SSE token in query string | Moved to Authorization header (dev query fallback retained) |
| 10 | Webhook HMAC verification | Strict HMAC; production rejects unless `ALLOW_UNVERIFIED_WEBHOOKS`; no fake `received: true` (502 on downstream failure) |
| 11 | Billing silent auto-upgrade | Removed; requires explicit `ENABLE_DEV_BILLING_MOCK`; never in prod |
| 12 | Chat canned replies | Persisted with `error: true`; rendered as "Not answered" in UI |
| 13 | Pipeline codeExecute | Sandboxed; SSRF guard on HTTP nodes; databaseQuery read-only + server-DATABASE_URL only; `PIPELINE_CODE_EXECUTE_ENABLED` kill switch |
| 14 | SSE pipeline stream | Per-tenant scoped |
| 15 | Host connect | Verifies reachability before adding |
| 16 | Provider keys in plaintext | Encrypted at rest (AES-256-GCM, `ENCRYPTION_KEY`) + persisted via `ProviderCredential` table |
| 17 | Skills install — no persistence | Now real-persists to database |
| 18 | LSP diagnostics fake `[]` | Reports unsupported honestly via API |
| 19 | `cancelRun` 500 error | Fixed — returns clean CANCELLED status |
| 20 | Pipeline delete FK constraint error | Fixed — cascade handles run history |

---

## 9. Known Limitations

| Limitation | Impact | Notes |
|------------|--------|-------|
| Qdrant vector store down | RAG falls back to JSON-file store (agent-runtime) / memory-mode (context-engine) | Fallback is now explicit per-engine; Qdrant genuinely backs both engines when up (verified live, real scores). Point ids are UUID-shaped (Qdrant rejects arbitrary string ids) |
| Redis down mid-run | Global fastify limiter degrades open (`skipOnError`); tier/attempt/SSO state falls back to per-process memory with retry-and-reconnect | Verified live: Redis stopped → user still bounded (429 at 61 via memory); Redis restarted → keys written again within ~30s. State is durable across API restarts only while Redis is up |
| Connector ecosystem | Real MCP client + generic connectors now exist, but not n8n-scale | Real `@modelcontextprotocol/sdk` client (stdio/SSE/streamable-http) over external MCP servers plus generic REST (`http_request`), SQLite (`sqliteQuery`), JSON `transform`, `fileIo`, and `email.send` connectors are verified. Still stubs: `flowmind.git.pr`, `flowmind.db.query`, `flowmind.slack.message`, `flowmind.github.issue`, `flowmind.notion.page`, `flowmind.memory.search`, `flowmind.skill.run`, `flowmind.pipeline.trigger`, `flowmind.image.generate`, `flowmind.audio.transcribe`. Per-SaaS webhook-trigger nodes and OAuth-consumed SaaS connectors remain future. DB writes gated behind `PIPELINE_DB_ALLOW_WRITE`; cacheable write transactions not built |
| Desktop packaged mode | Doesn't start API/runtime | Dev launcher only |
| Docker API image | Can't run compiled output | Dockerfiles exist but ship raw TS `main` — untested/broken for API |
| Production build | Not validated | `next standalone` build fails on this Windows box; local dev mode (`next dev` / `tsx`) used throughout |
| React hydration warnings | 2 warnings on landing page | Dev-only; non-critical |
| FREE-tier rate limit | 60 req/min | Works correctly (429 observed under hammer) |
| Deployment scope | Localhost only | No public internet deployment; all services on this machine |

---

## 10. Production-Readiness Assessment

**Grade: Local production-verifiable / not yet public-Internet production-ready**

### What's solid
- Critical security and correctness blockers from this pass are **FIXED and live-verified**
- The application runs and works end-to-end locally
- Auth, chat, pipelines, billing guards, tenant isolation, tool sandboxing all functional
- 242 automated tests passing, 0 failures
- Provider keys encrypted at rest, webhook HMAC verified, SSRF protected

### What blocks public deployment
1. **No validated production build** — runs in dev mode (`next dev` / `tsx`); `next standalone` build not working
2. **Localhost-only deployment** — no public internet URL, no reverse proxy, no TLS
3. **Connector ecosystem gap** — real MCP client and generic REST/SQLite/transform/file/email connectors exist, but the per-SaaS surface is still thin: 10 `flowmind.*` tools remain stubs, and OAuth-consumed SaaS connectors / per-SaaS webhook-trigger nodes are not built; no n8n-scale integrations
4. **Infrastructure gaps** — Qdrant persistence and multi-replica state are roadmap items (real MCP client is now implemented)
5. **External integrations untested** — no real credentials for Stripe, cloud LLMs, OAuth, SaaS connectors

### Honest summary
This is a **working local application with real security hardening** — not a production deployment. The code quality and security posture are solid for a local-first product. Public internet deployment requires production build validation, infrastructure provisioning, and real credential integration testing.

---

## 11. Externally Blocked (Could Not Genuinely Test)

| Area | Blocker | What was verified instead |
|------|---------|---------------------------|
| Stripe real checkout | No `STRIPE_SECRET_KEY` | Guard errors honestly when unconfigured |
| Cloud LLM providers | No real API keys | Wiring/guards tested; inference NOT run |
| External SaaS connectors | No external accounts | Connector definitions present but unconnected; OAuth-consumed SaaS connectors not built |
| MCP external servers | No public third-party MCP endpoint | Real protocol client verified against the in-repo demo stdio server and a local SSE test server (tools/list + tools/call round-trips); live external third-party MCP endpoints not exercised |
| OAuth provider flows | No real OAuth credentials | Not exercised with real Google/GitHub SSO |

---

## 12. Performance Results

| Metric | Result | Notes |
|--------|--------|-------|
| Chat inference (Ollama local) | ~25s first response | Local model, cold start |
| Load testing | **Not performed** | No formal load test run this pass |
| Rate limiting | 429 observed on FREE tier | Tier limit works correctly |

---

## 13. Track 2 — Durable State (Redis) & Vector Store (Qdrant) Verification

**Date:** 2026-08-30. **Blocker:** Docker Desktop daemon cannot start on this box (`HCS_E_HYPERV_NOT_INSTALLED`, virtualization disabled) — WSL2 unusable. Redis and Qdrant therefore run as **native Windows binaries** downloaded to `C:\Program Files\KMSpico\temp\opencode\infra-bin\{redis,qdrant}`.

### Relaunch commands (start from `infra/` or any CWD)

```powershell
Start-Process -FilePath "C:\Program Files\KMSpico\temp\opencode\infra-bin\redis\redis-server.exe" `
  -ArgumentList "--port","6379","--dir","`"C:\Program Files\KMSpico\temp\opencode\infra-bin\redis`"" -WindowStyle Hidden
Start-Process -FilePath "C:\Program Files\KMSpico\temp\opencode\infra-bin\qdrant\qdrant.exe" -WindowStyle Hidden
# verify
& "C:\Program Files\KMSpico\temp\opencode\infra-bin\redis\redis-cli.exe" PING   # PONG
Invoke-RestMethod -Uri "http://localhost:6333/collections"                     # {"result":{"collections":[]}}
```

Note: the `--dir` path must be quoted (redis fails to start with an unquoted path containing spaces). After launching, re-probe the ports — the process survives even when the shell wrapper reports a `ChildProcess.kill` message.

### Live evidence (verified against running services)

| Check | Result |
|-------|--------|
| API tier rate limit (FREE 60/min) | 61st `auth.me` → HTTP 429; Redis key `rate:tier:FREE:{userId}:{window}` = 61 |
| Rate-limit durability across API restart | Restarted API process → same user immediately `429`; Redis count continued 61 → 62 (state came from Redis, not memory) |
| Login brute-force attempts | 5 bad logins → 401, 6th → 429; Redis key `auth:attempts:{ip}:{email}` = `{"count":5,"resetAt":...}` (15-min TTL) |
| SSO state | `auth.ssoUrl` → Redis key `auth:sso:{state}` with 600s TTL |
| Global fastify limiter | Redis key `fastify-rate-limit-127.0.0.1` present (Redis store registered at boot) |
| Redis down | Global limiter degrades open; tier limiter still bound the same user at 429/61 via memory fallback (no 500s) |
| Redis recovery | ~30s retry cadence; new requests wrote `rate:tier:*` keys again — auto re-connect confirmed |
| JS ContextEngine (`@flowmind/context-engine`) | `mode: qdrant`; insert+search round-trip via Ollama `all-minilm` (384-dim); real score 0.633; point visible in Qdrant `context_chunks` |
| Python ContextEngine (`agent-runtime`) | `is_mock: False`; real Qdrant round-trip; real score 0.639; point in `flowmind_contexts` |
| `/knowledge/index` + `/knowledge/search` (HTTP) | Real Qdrant-backed retrieval; real score 0.7433; metadata flattened correctly (`doc_id` resolves, ids correct) |

### Repository changes for Track 2

- `apps/api/src/lib/redis.ts` (new): lazy ioredis singleton, true-reachability probe (30s cache), `KeyValueStore` interface + `RedisBackedKeyValueStore` (get/set/del/incr with memory fallback, reconnect cadence), `getStateStore()`, `closeRedis()`.
- `apps/api/src/middleware/trpc.ts`: tier limiter keyed `rate:tier:{tier}:{userId}:{windowStart}` via the store (was in-process Map).
- `apps/api/src/routers/auth.ts`: login attempts + SSO states via `auth:attempts:*` / `auth:sso:*` keys (was in-process Maps).
- `apps/api/src/index.ts`: global fastify rate-limit registered with the Redis store when reachable; `skipOnError: true`; `closeRedis()` on shutdown.
- `packages/context-engine/src/index.ts`: Qdrant point ids now deterministic UUID-shaped (string ids like `doc-1_0` are rejected by Qdrant); test updated to assert UUID shape.
- `packages/agent-runtime/src/context_engine.py`: real Ollama embedding URL (was broken URL derivation → silent md5 fallback); `is_mock` property; `query_points` vs `search` compat shim (qdrant-client 1.10+ removed `search`); UUID point ids; flat metadata on retrieve.
- `packages/agent-runtime/src/orchestrator.py`: passes `QDRANT_URL` env through.
- `packages/agent-runtime/src/main.py`: `/knowledge/index` + `/knowledge/search` route through the Qdrant ContextEngine when genuinely usable, JSON-file store otherwise.

### Key pitfalls found and fixed

- Qdrant rejects arbitrary string point ids (`400 "not a valid point ID"`) — the Python engine had been silently swallowing this and falling to mock data (`is_mock: False` but not real Qdrant). Reproduced with a probe, then fixed with UUID point ids and verified real round-trips.
- qdrant-client version drift: installed 1.19.0 (`query_points` only) vs venv 1.9.1 (`search` only) — shim handles both.
- ioredis `enableOfflineQueue: false` + commands issued during the brief `connecting` state fail with `Stream isn't writeable` → initial probes silently failed and every op fell to memory. Fixed by waiting for `ready` (not double-`connect()`, which rejects with `Redis is already connecting/connected`).
- Redis dying after boot with the global limiter registered on Redis → all requests 500; fixed with `skipOnError: true` (degrade open), tier limiter still bounds users via memory fallback.

---

## 14. Track 3 — Real MCP Client (Phase A) & Connectors (Phase B)

**Date:** 2026-08-30. This pass replaces the reachability-probe-only MCP layer with a genuine `@modelcontextprotocol/sdk` client and adds generic connectors, all configured disabled-by-default.

### Phase A — Real MCP client

- **Real protocol client** (`packages/mcp-executor/src/mcp-client.ts`): `Client` from `@modelcontextprotocol/sdk` v1.30.0 over `StdioClientTransport`, `SSEClientTransport`, and `StreamableHTTPClientTransport`. Real `tools/list` discovery and `tools/call` invocation with JSON-RPC round-trips (verified against the in-repo stdio fixture `packages/mcp-executor/src/__tests__/fixtures/demo-mcp-server.mjs` and a local SSE test server). Per-call timeouts (connect 10s / list 10s / call 30s) and AbortSignal cancellation.
- **Honest errors**: a server-side `isError` tool result (e.g. `failTool`) is surfaced as `{ success: false, isError: true, content }`, never a fake success. Unknown tools throw descriptive errors; dropped servers record `lastError`.
- **Server persistence**: new `McpServer` Prisma model + migration `20260830010000_add_mcp_server` (`mcp_servers` table, `McpServerTransport` enum STDIO/STREAMABLE_HTTP/SSE, `lastError`/`lastConnectedAt`/`lastToolCount`). Tenant-scoped tRPC router (`apps/api/src/routers/mcp.ts` + `apps/api/src/services/mcp-client.ts`): `servers.list/create/update/delete/test/tools/callTool`, all `protectedProcedure`-gated by `userId`, plus `mcp.execute` for the built-in tool set.
- **Agent integration**: `ChatService` now builds agent tools from both local tools and per-user MCP servers (`listMcpAgentToolsForUser`); failing servers are skipped with persisted `lastError`, never faked.
- **Live e2e (this box)**: `servers.test` listed the 3 demo-server tools (`echo`, `getWeather`, `failTool`) over real protocol; `callTool echo/getWeather` returned real content; `failTool` → `isError`; a private-URL server create → HTTP 400 (SSRF block); the agent loop called an MCP tool and completed in 2 iterations.

### Phase A — Security

- **stdio allowlist**: `MCP_ALLOWED_COMMANDS` is required for stdio (refused outright without it) and gates the executable by metacharacter rejection (no shell separators/globs/quoting) plus path gating (bare names, exact allowlisted paths, basename matching — Windows-aware). `assertCommandAllowed` in `packages/mcp-executor/src/security.ts`.
- **Remote SSRF blocklist**: `assertMcpRemoteUrl` → `assertPublicHttpUrl` rejects `file:` schemes and any host resolving to private/loopback/link-local ranges (`BlockedUrlError`); explicit `ALLOW_PRIVATE_MCP_URLS=true` is the opt-out dev flag. Remote servers are **disabled by default** (create without `enabled` is refused for stdio; remote URLs are blocked unless opted out).
- **No fake `connected: true`**: connection state only flips true after a real client handshake; failures record `{ connected: false, error }`.

### Phase B — Connectors (offline-verified)

- **`http_request` agent tool** (`packages/tool-system/src/tools/http_request.ts`): SSRF-guarded via pipeline-engine `fetchPublic` (every redirect re-validated); GET-body rejected, body size capped, permission-ask via `ctx.ask`. Live: `example.com` → 200; `127.0.0.1:3001/health` → refused (`BlockedUrlError`). 4 vitest tests.
- **`sqliteQuery` pipeline node** (`packages/pipeline-engine/src/runners.ts`): `node:sqlite` `DatabaseSync`, **read-only by default** under `PIPELINE_DB_ALLOW_WRITE` (writes otherwise blocked by `assertSafeReadOnlySql`), path guard `resolveWithinRoot` against `PIPELINE_FILE_ROOT` (`packages/pipeline-engine/src/file-root.ts`).
- **`transform` JSON node** (`packages/pipeline-engine/src/transform.ts`): map/select/rename/summary over predecessor output (with `{{ $json.x }}` expression resolution).
- **`fileIo` node**: read/write JSON or text under `PIPELINE_FILE_ROOT` only; traversal (`../../etc/evil.txt`) and absolute paths refused.
- **`flowmind.email.send` implemented**: per-user SMTP via `ProviderCredential` (type `"smtp"`, decrypted by `packages/mcp-executor/src/smtp-cred.ts` AES-256-GCM, prod requires `ENCRYPTION_KEY`) takes precedence over `SMTP_HOST` env fallback; pipeline `sendEmail` node reads the same credential through the engine's `credentialResolver`. Verified via local `smtp-server` capture (subject/to/body asserted).
- **New plumbing**: `file-root` path-traversal guard (`resolveWithinRoot`/`assertWithinRoot`), `smtp-cred` decrypt, `network-guard` IPv6/IPv4-mapped range coverage.
- **UI plumbing**: `apps/web` node map + icons for `sqliteQuery`, `transform`, `fileIo`.

### Track 3 tests (run this pass)

| Suite | Result |
|-------|--------|
| pipeline-engine | **65 passed / 1 skipped** (66) — incl. 10 connector + 1 email tests |
| tool-system | **4 passed** |
| mcp-executor | **19 passed** (stdio round-trip 6, SSE HTTP 3, security gates 6, PKCE 4) |
| apps/api | **29 passed** (unchanged this pass) |

`tsc --noEmit` → **0 errors** across `tool-system`, `pipeline-engine`, `mcp-executor`, `apps/api`, `apps/web`.

### Honesty caveat (earlier B4 finding)

`email.send` / `sendEmail` were verified against a **local `smtp-server` capture**; live delivery through an external SMTP provider was **not exercised** (no real credentials).

---

*Report generated 2026-08-30. All findings based on live verification on this machine.*
