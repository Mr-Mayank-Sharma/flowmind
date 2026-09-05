# Debugging

Practical debugging for the local stack. All paths and ports are verified against the current tree.

## Where logs land

- **API stdout/stderr** — the API runs with pino-pretty to the terminal. If launched via a wrapper, this repo has written `api.log` / `api.err.log` at the root in the past. `LOG_LEVEL` env (default `info`) controls verbosity (`trace`, `debug`, `info`, `warn`, `error`, `fatal`).
- **Web dev** — `next dev` writes to the terminal; a failed `start-dev.sh`-style launch leaves `web.log`, `web-stdout.log`, `web-stderr.log` at the root. The web server also surfaces errors in the browser console.
- **Agent runtime** — uvicorn logs to its terminal; the repo has seen `agent-runtime.log` / `agent-runtime.err.log` at root from wrapper launches.
- **Systemd (Linux, after `install.sh`)** — `journalctl -u flowmind-api -f`, `journalctl -u flowmind-web -f`, `journalctl -u flowmind-runtime -f`.

## Health endpoints

**API** (fast):

```bash
curl http://localhost:3001/health
# {"status":"ok","version":"0.1.0","uptime":123.4,"timestamp":"...","checks":{"database":true,"agentRuntime":true}}
```

- `status` is `ok` when the DB check passes, `degraded` otherwise (HTTP 503 when DB is down).
- `checks.agentRuntime` reflects `AGENT_RUNTIME_URL` (`http://localhost:8001` default). Runtime down → `agentRuntime: false` but API stays `status: ok`.

**Agent runtime:**

```bash
curl http://localhost:8001/health          # {"status":"ok"}
```

## Checking infrastructure

```bash
redis-cli PING                              # PONG
curl http://localhost:6333/collections      # {"result":{"collections":[]},...}
curl http://localhost:11434/api/tags        # installed Ollama models
psql "postgresql://flowmind:flowmind@localhost:5433/flowmind" -c "SELECT 1"
```

## tsup dist vs source

The API dev server runs from `src/` via `tsx watch`. The **production** bundle is built by tsup into `apps/api/dist/index.js` (`pnpm --filter @flowmind/api build`; `node apps/api/dist/index.js`).

Debugging notes:

- If you edited source but the running server behaves like old code, confirm which one you launched (a leftover `node dist/index.js` on :3001 will shadow `tsx watch`).
- `apps/api/src/index.ts` has `sourcemap: true`; use the source maps when debugging the dist bundle.
- `NODE_ENV=production` changes behavior: CSP is on, the insecure JWT dev fallback **throws**, `/metrics` requires a token, and webhook/SSE details harden. For local debugging keep `NODE_ENV=development`.
- The web standalone build (`next build`) produces `apps/web/.next/standalone/server.js` — again, prefer `next dev` when the goal is fast iteration.

## Common failure modes

### 1. Agent runtime down → `agentRuntime: false`

The API stays healthy but chat/tool calls fail. Fix: start the runtime (`cd packages/agent-runtime && python -m uvicorn src.main:app --host 127.0.0.1 --port 8001`) and check the shared `AGENT_API_KEY` matches the API's `.env`.

### 2. DB port mismatch 5433 vs 5432

Symptom: API logs `Can't reach database server` / `P1001`; `/health` returns 503 `degraded`.

- The live local Postgres here binds **5433**; `.env.example`, compose, k8s all bake **5432**.
- Fix: `DATABASE_URL="postgresql://flowmind:flowmind@localhost:5433/flowmind"` in `.env`.

### 3. Prisma DLL lock / EPERM on Windows

`prisma generate` fails while a Node process holds the client DLL. Stop the API (:3001) and any `node dist/index.js`, then `pnpm db:generate`.

### 4. `prisma migrate dev` → P3014 on Windows

Apply the migration file directly:

```bash
npx prisma db execute --file packages/db/prisma/migrations/<name>/migration.sql
```

or `npx prisma migrate deploy` when the migration is already in the `_prisma_migrations` ledger.

### 5. JWT prod fallback throws

`apps/api/src/lib/jwt-secret.ts` throws `JWT_SECRET must be set in production` when `NODE_ENV=production` and `JWT_SECRET` is unset. In dev it logs a warning and uses an insecure fallback. Fix: set `JWT_SECRET` (32+ chars) when running production mode.

### 6. `EADDRINUSE :::3001` (or :3000)

Something already owns the port. On Windows:

```bat
netstat -ano | findstr :3001
taskkill /PID <pid> /F
```

Then rerun `pnpm dev`. A stale `node dist/index.js` or leftover `tsx watch` from an earlier session is a common cause.

### 7. Web says "API unreachable"

`apps/web/src/lib/api/core.ts` uses `NEXT_PUBLIC_API_URL || "http://localhost:3001"`. It is compiled into the client at build time — after changing it, restart `next dev` (and re-run `pnpm build` if verifying the standalone build). Also confirm CORS: `apps/api/src/index.ts` allows `APP_URL`, `http://localhost:3000`, `http://localhost:4000`. Note the drift: `apps/api/.env.example` says `APP_URL=http://localhost:4000` but the root `.env.example` says `http://localhost:3000`; the effective CORS list is what the API starts with.

## Metrics

`/metrics` exports Prometheus format from `prom-client` (`collectDefaultMetrics()` is called at start).

- In **development**, with no `AGENT_API_KEY`/`INTERNAL_API_KEY`, `/metrics` is open.
- In **production**, or whenever `AGENT_API_KEY`/`INTERNAL_API_KEY` is set, it requires `Authorization: Bearer <token>` where the token equals `AGENT_API_KEY` (or `INTERNAL_API_KEY`):

```bash
curl -H "Authorization: Bearer $AGENT_API_KEY" http://localhost:3001/metrics
```

The health spec (`e2e/health.spec.ts`) asserts the content type is `text/plain` and the body contains `nodejs_version_info`.

## SSE endpoints and auth

Two SSE streams exist:

- `/api/chat/stream/:sessionId` — chat agent streaming
- `/api/pipeline/stream/:runId` — pipeline run node events

Auth: a valid JWT in `Authorization: Bearer <token>` (in production, no `?token=` query fallback; in dev you may pass `?token=`). Both re-verify the JWT against `JWT_SECRET`, then check ownership:

- Chat stream: the session must exist and `session.userId === userId`.
- Pipeline stream: the pipeline owner, or a member of the pipeline's group/org (mirrors `pipeline.getById`), else **404** — the 404 is intentional to avoid leaking existence.

## Reproducing a 401/403 tenant issue

1. Register two users (A and B) in separate browsers/incognito.
2. Create a pipeline as A. Log in as B and try to open/run A's pipeline by ID.
3. Expected: B gets a 401 (unauthenticated) or 404 (not found / not member), never A's data.
4. Check the SSE stream for B: `/api/pipeline/stream/<A's runId>` must 404 under B's token, matching the ownership branch in `apps/api/src/index.ts`.
5. To test group membership: add B to A's org/group (`OrgMember`, `HostGroup`) and confirm the same stream now 200s.

Keep `LOG_LEVEL=debug` while reproducing; the pino logs name the auth middleware branch and can reveal whether the token is the issue (401 at JWT verify) versus permission (404 at ownership check).

## Resetting a broken local state

- **Prisma client stale:** stop API on Windows → `pnpm db:generate`.
- **Migration ledger out of sync:** `npx prisma migrate deploy` (safe) — see setup guide for the Windows P3014 workaround.
- **Redis state:** `redis-cli FLUSHALL` (dev only; clears rate-limit and session state, forces in-memory fallback to re-populate).
- **Qdrant collections:** delete via the Qdrant dashboard/API on :6333 if a vector index misbehaves.