# FlowMind Enterprise Rebuild — Audit Synthesis & Phased Plan

Status: living document. Updated as phases complete.

## 1. Audit Summary

### Verdict
Solid architectural bones (thin tRPC routers -> domain packages, host/group RBAC,
SSE streaming, tier-aware limits). NOT production-ready today: ship-blocking
security holes, silent failure masking, fragmented deployment story, and a
frontend that is ~85% wired but with systemic silent-failure UX.

### Critical findings (cross-cutting)

**Security (ship blockers)**
| # | Issue | Location |
|---|-------|----------|
| S1 | Runtime registry mutations are `publicProcedure` | apps/api/src/routers/runtime.ts |
| S2 | IDOR: `pipeline.getBatchStatus` leaks any user's runs | pipeline.ts:826-847 |
| S3 | Any user can kill arbitrary OS PIDs | system.ts:32 -> MetricsService.ts:417 |
| S4 | Shell injection in MCP built-ins (`grep`, `git commit -m`) | mcp-executor/src/index.ts:528,:594 |
| S5 | `new Function` eval RCE surfaces (code node, condition node, MCP code.execute) | runners.ts:467,:631 |
| S6 | Files router serves API server cwd incl. `.env`; delete allowed | files.ts |
| S7 | Webhooks (slack/discord/telegram/whatsapp) accept z.any(), no HMAC verify | webhooks.ts |
| S8 | Default JWT secret fallback reachable in prod (SSE handlers, auth, host-auth) | index.ts:144,:243, auth.ts:8, host-auth.ts:5 |
| S9 | Plaintext OAuth/MCP/host tokens at rest | schema + mcp.ts |
| S10 | tools-v2 destructive gate bypassable via autoApprove; permission rules in-memory | tools-v2.ts |

**Correctness**
| # | Issue | Location |
|---|-------|----------|
| C1 | Chat tool-name mismatch (`web_fetch` vs `webfetch`) starves agents of web/todo tools | ChatService.ts:40 |
| C2 | cancelRun does not abort executing engine (no AbortSignal) | pipeline.ts:477 |
| C3 | RunLog writes placeholders `{}` and flushes only last entry | pipeline.ts:330-353 |
| C4 | Session emitters never cleaned up (leak) | session-emitters.ts |
| C5 | Password-reset "email" POSTs to SMTP host as HTTP; reset URL logged plaintext | auth.ts:296-311 |
| C6 | Chat failure chain persists canned fake assistant replies | ChatService.ts:134,:264 |
| C7 | Env var drift: `_KEY` vs `_API_KEY`, `OLLAMA_URL` vs `OLLAMA_BASE_URL`, `INTERNAL_API_KEY` vs `INTERNAL_API_TOKEN` | multiple |
| C8 | Web: destructive-tool guard uses `in` instead of `.has()` | tools-v2/page.tsx:102 |
| C9 | Web: API keys in localStorage; fake file upload | model-selector.tsx:96, file-upload.tsx |

**Architecture debt**
- Dual LLM brains: TS agent-loop vs Python agent-runtime, silently switching on failure.
- All 22 packages ship raw TS (`main: ./src/index.ts`) -> Docker api stage cannot run compiled output.
- 4 conflicting deploy stories (Dockerfile, 2 composes, install.sh running dev servers in prod).
- Electron desktop app cannot work packaged (never starts API/runtime, hardcoded paths).
- In-memory Maps carry security/business state (rate limits, SSO state, tools-v2 rules, provider keys).
- Schema: ~15 required relations missing cascade, ~10 userId columns without FK, plaintext token columns.
- Dead packages shipped (channel-gateway, errors, http-recorder, ollama-proxy); dead procedures (~10).
- Duplicated `normalizeGraph` x3, `buildLLMProvider` x2.
- E2E not in CI; tool-system/db/ui have zero tests; `pnpm build` triggers electron-builder.

### What is genuinely good (keep)
- Host federation RBAC (host.ts + group-access.ts) - strongest subsystem.
- Pipeline engine DAG design, retries, approval pause concept.
- Buffered-emitter SSE with replay/heartbeat.
- Tier-aware usage limits; billing Stripe integration shape.
- Next.js theming/dark mode, route-level loading/error scaffolding, working SSE chat streaming.

## 2. Target Architecture Decisions

| Decision | Choice |
|----------|--------|
| LLM brain | TS agent-loop (`packages/llm-router`) is authoritative. Python runtime = optional knowledge/embeddings service only. No silent cross-fallback. |
| Config | Single typed config module (`packages/shared/src/config.ts`): zod-validated env, fail-fast startup, unified names (`*_API_KEY`). |
| Long-running work | Pipeline runs become async jobs: `PipelineRun` row is the queue record; in-process worker pool drains it; SSE unchanged. Cancel = AbortSignal. |
| State | Redis-compatible store interface backed by Postgres when Redis absent. Rate limits, login lockout, SSO state, tools-v2 permission rules move there. |
| MCP | Implement a real minimal MCP client (JSON-RPC over stdio + streamable HTTP) in `packages/mcp-executor`; keep OAuth PKCE; delete fake built-in tools that overlap real ones. |
| Product split | `apps/web` stays the product UI. New standalone site lives OUTSIDE this repo concern for now; product distribution via Electron desktop + Docker. Website separation tracked as Phase 4. |
| Packages build | Every package gets `tsc` build emitting dist; mains point at dist; dev uses tsx paths. Docker builds compile. |

## 3. Phases

### Phase 0 — Ship-blocker fixes (correctness + security)
- [ ] P0.1 Fix chat tool-name mismatch (C1)
- [ ] P0.2 AbortSignal wiring for pipeline cancel (C2)
- [ ] P0.3 Honest RunLog persistence (C3)
- [ ] P0.4 Session emitter cleanup (C4)
- [ ] P0.5 Protect runtime router; IDOR fix; killProcess admin gate (S1,S2,S3)
- [ ] P0.6 JWT secret fail-fast everywhere (S8)
- [ ] P0.7 Files router: dedicated sandboxed workspace root outside repo; deny `.env` (S6)
- [ ] P0.8 Webhook signature verification (HMAC) per provider (S7)
- [ ] P0.9 Web: `.has()` guard; remove localStorage key storage; remove fake upload button (C8,C9)
- [ ] P0.10 Password reset email via nodemailer (reuse SMTP correctly); stop logging reset URLs (C5)

### Phase 1 — Architecture refactor
- [ ] Typed config module + env unification + .env.example regeneration (C7)
- [ ] Shared `normalizeGraph`/`buildLLMProvider` extraction
- [ ] Async pipeline job execution + true cancel + recovery sweep for orphaned RUNNING runs
- [ ] Persistent rate-limit/state store
- [ ] Real MCP client transport; remove overlapping fakes
- [ ] Token encryption at rest using FLOWMIND_CREDENTIAL_KEY (documented, required in prod)
- [ ] Schema migration: cascades + FKs for orphan-prone columns
- [ ] Stop persisting canned chat failures; surface error state to client

### Phase 2 — Frontend rebuild
- [ ] Consolidate on typed tRPC client + React Query; delete hand-rolled core.ts envelope parsing
- [ ] Chat experience upgrade: streamed deltas, markdown+syntax highlighting, diff rendering, tool-call cards, message actions (copy/retry/edit), per-session loading
- [ ] Systemic error/empty states: every useQuery consumer handles error; EmptyState everywhere
- [ ] Remove dead pages (/runtimes) or wire them; delete dead procedures from API client
- [ ] Accessibility + responsive pass

### Phase 3 — Packaging & distribution
- [ ] Package builds emit dist; fix Dockerfile accordingly; one canonical compose
- [ ] Desktop: packaged lifecycle starts API (+runtime) from bundled resources; electron-builder config fixed; exclude from turbo build by default
- [ ] Installer story: NSIS target with prerequisites check; auto-update channel stub
- [ ] Separate marketing website scaffold (independent repo folder `website/`, no shared runtime deps)

### Phase 4 — Tests & production readiness
- [ ] Unit: tool-system (bash/edit safety), db layer, llm-router routing table
- [ ] Integration: chat send->stream, pipeline trigger->run logs->cancel, auth flows incl. reset
- [ ] E2E (Playwright): login, chat round-trip, pipeline create/run/history, settings/deleteAccount
- [ ] CI: e2e job, lint coverage all packages, drop electron from default build
- [ ] Final audit pass: no placeholders/dead code/security regressions

## 4. Progress Log
- 2026-08-22: Audit complete (api, web, infra). Plan written.
