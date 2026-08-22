# FlowMind QA Audit Report

Date: 2026-08-09
Scope: Startup, all 26 routes, chat/Ollama, pipeline UI, API errors, console/network errors, Firebase, responsive layout, state persistence.
Method: Playwright (Chromium) browser probes + direct API calls + DB inspection (`psql` v18) + `tsc --noEmit` on `apps/api` and `apps/web`.

---

## 1. Summary

| Area | Result |
| --- | --- |
| Startup | API `/health` 200 (db true, agentRuntime false), web :3000 up, Ollama v0.32.6 |
| Routes (26/26) | All render HTTP 200 with correct h1; no JS errors on content pages |
| Auth | Login/logout work; JWT cookie + Bearer both accepted; refresh flow OK |
| Chat | Works end-to-end (SSE via fetch, assistant reply confirmed) |
| Pipelines | Create/trigger/delete UI works; run streaming was broken (FIXED); template runs always fail (bug) |
| Firebase | Not implemented anywhere in code — only named in blueprint doc |
| Responsive | Mobile has horizontal scroll on ~9 routes (toolbar/filter rows don't wrap); tablet clean except `/marketplace` |
| Persistence | PASS — auth + chat state survive full reload |
| TypeScript | 0 errors both projects after fixes |

Findings: **3 fixed**, **6 open (2 HIGH, 2 MEDIUM, 2 LOW)**.

---

## 2. Fixed During Audit

### F1. Pipeline/chat SSE streaming always 401 (HIGH)
- **Bug**: `apps/web/src/components/pipeline/pipeline-canvas.tsx:261` opens the run stream via `EventSource` with the JWT as `?token=` query param (EventSource cannot send headers). `apps/api/src/index.ts:236` (pipeline) and `:135` (chat) only read `req.headers.authorization`. Result: pipeline run progress never reached the UI — stream returned 401.
- **Fix**: both routes now accept `req.query.token` as a fallback (`apps/api/src/index.ts`). Verified: pipeline run stream no longer 401s.
- Note: chat already worked because `chat-store.ts:367` uses `fetch` with an Authorization header, not EventSource.

### F2. Chat/Ollama `res.json()` crash on `complete()` (HIGH, from prior session)
- Ollama v0.32.6 omits `stream` when unset → NDJSON response → `res.json()` threw. `packages/llm-router/src/providers/ollama.ts` now sends `stream: false`.

### F3. SSE routes missing CORS + immediate flush (HIGH, from prior session)
- Both `/api/chat/stream/:sessionId` and `/api/pipeline/stream/:runId` now write `Access-Control-Allow-Origin` and flush `": connected\n\n"` immediately (`apps/api/src/index.ts`).

---

## 3. Open Findings

### H1. Pipeline templates fail on every run — "Unknown node type" (HIGH)
- **Evidence**: create pipeline from any template → Run → `pipeline_runs.status = FAILED` in ~8 ms. `run_logs.error = "Unknown node type: triggerNode"`.
- **Root cause**: node `type` mismatch between the two type systems:
  - `apps/web/src/lib/pipeline-templates.ts` uses `triggerNode`, `aiNode`, `actionNode`, `flowNode` (legacy).
  - `packages/pipeline-engine/src/runners.ts:692` registry keys are `manualTrigger`, `cronTrigger`, `aiAgent`, `httpRequest`, etc.
  - `apps/web/src/components/pipeline/node-palette.tsx:41-64` uses the correct engine keys — so hand-built pipelines run, template pipelines never do.
- **Fix**: rewrite the node `type`s in `pipeline-templates.ts` to the runner keys and map each template's `config` to the matching runner's expected config (e.g. `triggerNode`→`manualTrigger`, `aiNode`→`aiAgent` with `config.prompt`/`model`).

### H2. File Browser (`/files`) always fails with 400 (HIGH)
- **Evidence**: `/files` fires `files.list` with `dir="/"` → HTTP 400 "Invalid directory" (2×, StrictMode).
- **Root cause**: `apps/api/src/routers/files.ts:9-15` — on Windows `path.resolve(WORKSPACE_ROOT, "/")` resolves to the drive root `C:\`, which fails the containment check → returns `null` → `BAD_REQUEST`. POSIX never hits this because `/` is the FS root.
- **Fix**: normalize leading slashes before resolving, or treat `dir === "/"` (or empty) as `WORKSPACE_ROOT`. Windows-specific.

### M1. 429 on `auth.me` force-logs users out (MEDIUM)
- **Evidence**: browsing to `/models` fired 8× 429; after the FREE-tier limit (60/min) trips on `auth.me`, `use-auth` runs `clearAuth()` and the app redirects to `/login` mid-session.
- **Root cause chain**: (a) default admin is `tier = FREE` despite `role = SUPER_ADMIN` (`users` table) → 60 req/min; (b) React StrictMode in dev doubles every tRPC call (verified: every request appears 2× in API logs); (c) `apps/web/src/hooks/use-auth.tsx` treats any `auth.me` failure as logged-out instead of distinguishing 401 from 429.
- **Fix**: treat 429 as "rate limited" (retry/no-op) rather than "unauthenticated"; or raise FREE tier / make the tier match the role for the seeded admin. Also add request de-duplication if StrictMode persists.

### L1. Landing page hydration mismatch (LOW)
- **Evidence**: `/` console warning "Expected server HTML to contain a matching circle svg" + "server HTML was replaced with client content" (lucide icon inside `page.tsx` FAQ/footer content).
- **Fix**: make the offending icon/branch render identically on server and client (avoid client-only state in an SVG-heavy component on the server-rendered landing page).

### L2. `/login` prefetch aborts + public-page `auth.me` 401 noise (LOW)
- **Evidence**: `/login` logs `GET /home?_rsc=… net::ERR_ABORTED`; public pages (`/login`, `/docs`, `/forgot-password`, `/install`) log 401 from `auth.me` while logged out.
- **Impact**: cosmetic console noise only; no functional failure.

---

## 4. Per-Route Results (clean run, logged in, ENTERPRISE tier)

All routes: HTTP 200, expected h1, no console/page errors, `REDIRECT->LOGIN` count = 0.

| Route | h1 | Errors |
| --- | --- | --- |
| `/` | The open source AI Operating System | 2 (hydration warning) |
| `/login` | Control Center | 2 (`/home?_rsc` aborts) |
| `/home` | Control Center | 0 |
| `/chat` | — | 0 |
| `/agents` | Agent Workspace | 0 |
| `/pipelines` | Pipelines | 0 |
| `/frameworks` | Framework Hub | 0 |
| `/models` | Model Hub | 0 |
| `/mcp` | MCP Hub | 0 |
| `/knowledge` | Knowledge Base | 0 |
| `/tools` | Tool Registry | 0 |
| `/tools-v2` | Developer Tools | 0 |
| `/jobs` | Scheduled Jobs | 0 |
| `/context` | Context Engine | 0 |
| `/marketplace` | Marketplace | 0 |
| `/system` | System Monitor | 0 |
| `/processes` | Process Manager | 0 |
| `/files` | File Browser | 2 (400, see H2) |
| `/docs` | FlowMind AI OS | 0 |
| `/governance` | Governance | 0 |
| `/workspace` | Cloud Console | 0 |
| `/host-connect` | Host Connect | 0 |
| `/settings` | Settings | 0 |
| `/templates` | Templates | 0 |
| `/forgot-password` | Reset password | 0 |
| `/install` | Install FlowMind in One Command | 0 |

---

## 5. Feature Verification

### Chat / Ollama — PASS
- `/chat` renders, model selector lists installed models, message send → SSE 200 → assistant reply renders in browser.
- Direct stream probe: 200, `: connected\n\n`, `text/event-stream`, ACAO header present.
- Ollama installed models: llama3.1, llama3, qwen2.5-coder:7b, qwen2.5:14b, nomic-embed-text + cloud models.

### Pipelines — PARTIAL
- New Pipeline → template picker (8 templates incl. Blank) opens; template create → navigates to `/pipelines/:id`; Save/Run/Runs panel, node palette, inspector render.
- Trigger creates a `RUNNING` run and the SSE stream connects (after F1).
- **Run execution fails for template-created pipelines** (H1). Hand-built pipelines execute (prior SUCCESS runs exist in DB).

### Auth — PASS
- Login → `/home`; cookie `flowmind_token`; `auth.me` 200 via Bearer header; refresh flow intact.
- Caution: cookie alone is **not** accepted by the API (only `Authorization: Bearer` or now `?token=`); the web client always uses Bearer, so this is only a probe-level observation.

### Firebase — NOT IMPLEMENTED
- Zero matches for firebase/firestore/Firebase in `apps/` or `packages/`. Only a mention in `FlowMind_Enhanced_Blueprint_v2.txt:209` (integration wish-list). Nothing to test; no console errors.

### State persistence — PASS
- Sent a message → assistant reply; full page reload → still authenticated, chat session + sent message survive (DOM and localStorage). Sessions (11) + messages persisted via `flowmind_chat_data` / Zustand + Postgres; history listed on `/chat`.

---

## 5b. Responsive Layout (375px mobile, 768px tablet)

Mobile is usable but several pages scroll horizontally. Tablet is clean except `/marketplace`.

| Route | Viewport | scrollW | Culprit | Root cause |
| --- | --- | --- | --- | --- |
| `/chat` | mobile | 552 | chat header/input toolbar (`shrink-0`) | sidebar defaults open at `w-[320px]` even on mobile → main area ~55px → toolbar overflows (`apps/web/src/components/chat/chat-layout.tsx:38-42`) |
| `/frameworks` | mobile | 546 | filter chip row | `flex items-center gap-1` no wrap/scroll (`apps/web/src/app/frameworks/page.tsx:106,121`) |
| `/workspace` | mobile | 538 | 6-tab segmented control | `TabsList` is `inline-flex` (514px) — no wrap (`apps/web/src/app/workspace/page.tsx:157`, `components/ui/tabs.tsx:14`) |
| `/tools` | mobile | 488 | category filter chips | no wrap (`apps/web/src/app/tools/page.tsx:73-76`) |
| `/knowledge`, `/context`, `/files`, `/governance` | mobile | 388-432 | toolbar rows | same pattern (non-wrapping `flex` rows) |
| `/docs` | mobile | 422 | code blocks | long code lines don't wrap in `p-5` cards (`apps/web/src/app/docs/page.tsx:199`) |
| `/marketplace` | tablet | 919 | tab/filter bar | `shrink-0 overflow-x-auto` — element is wider than viewport so its internal scroll never engages; parent lacks `min-w-0`/`max-w-full` (`apps/web/src/app/marketplace/page.tsx:89`) |

Generic fix pattern: allow wrapping (`flex-wrap`) or constrain with `overflow-x-auto` + `max-w-full`/`min-w-0` on the row and its parent. `/chat` additionally needs the sidebar off-canvas or closed by default below 768px.

---

## 6. Infrastructure Notes

- Qdrant (:6333) down → ContextEngine runs in memory mode; `/health` `agentRuntime` false (agent runtime :8001 not running). Chat falls back to direct Ollama and works; pipeline LLM/HTTP nodes and webhooks that target the agent runtime will fail without it.
- Default pipeline model is `tinyllama` (`packages/pipeline-engine/src/runners.ts:89`), which is not installed in Ollama — configure a real model in node config or the run will 400.
- Rate limits: fastify global 200/min (`apps/api/src/index.ts:96`) + per-tier tRPC limiter 60/200/500 per min (`apps/api/src/middleware/trpc.ts:54`). Dev-mode StrictMode doubles request volume.
- Audit harness ran with `RATE_LIMIT_MAX=2000` (dev launcher only) and admin tier set to ENTERPRISE in the dev DB to avoid 429 noise; the 429→logout behavior is finding M1, not a harness artifact.

---

## 7. Recommended Fix Order

1. **H1** — migrate template node types to engine runner keys (unblocks all template pipelines).
2. **H2** — Windows-safe `safeResolve` for root path (unblocks File Browser).
3. **M1** — distinguish 401 vs 429 on `auth.me`; align seeded admin tier with role.
4. **R-group (MEDIUM)** — wrap/constrain mobile toolbar + filter rows, `TabsList`, `/marketplace` tabs, docs code blocks; make chat sidebar off-canvas <768px.
5. **L1** — fix landing hydration mismatch.
6. **L2** — suppress `auth.me` on public pages / prefetch aborts (optional).

Fixed already: SSE stream auth (F1), Ollama `stream:false` (F2), SSE CORS/flush (F3). `tsc --noEmit` clean on both projects.
