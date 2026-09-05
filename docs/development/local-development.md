# Local Development

The day-to-day loop: run each piece, hot-reload, launch a second API for isolated testing, attach the agent runtime, point the web at an API, and use the CLI.

## Tools per piece

| Piece | Dev command | Tooling | Hot reload? |
|-------|-------------|---------|-------------|
| API | `pnpm --filter @flowmind/api dev` | `tsx watch src/index.ts` | Yes (restart on source change) |
| Web | `pnpm --filter @flowmind/web dev` | `next dev --port 3000` | Yes (Fast Refresh) |
| CLI | `pnpm cli` (or `pnpm flowmind`) | built `dist/index.js` | No |
| CLI (dev) | `pnpm cli:dev` | `tsx watch src/index.ts` | Yes |
| Agent runtime | `python -m uvicorn src.main:app --host 127.0.0.1 --port 8001` | uvicorn `--reload` optional | Manual |
| Desktop | `pnpm desktop:dev` | `ELECTRON_IS_DEV=1 electron .` | Manual |

## Running everything

**Normal dev stack (API + Web only):**

```bash
pnpm dev
```

This is `turbo dev` — it starts the API on :3001 and Web on :3000. It does **not** start the Python agent runtime.

**Adding the agent runtime (separate terminal):**

```bash
cd packages/agent-runtime
# activate venv (see setup.md)
export AGENT_API_KEY=your-shared-key      # must equal apps/api/.env's AGENT_API_KEY
python -m uvicorn src.main:app --host 127.0.0.1 --port 8001
```

**Database cycle (for schema changes):**

```bash
pnpm db:generate   # regenerate Prisma client (stop :3001 on Windows first)
pnpm db:migrate    # apply migrations
pnpm db:seed       # optional admin bootstrap, env-gated
```

## The dev loop (make a change → verify)

1. Edit source.
2. Typecheck the two hard gates:
   ```bash
   pnpm --filter @flowmind/api typecheck
   pnpm --filter @flowmind/web typecheck
   ```
   Per `AGENTS.md`, both must be **zero errors**. (These run `tsc --noEmit`.)
3. Run the relevant unit tests:
   ```bash
   pnpm --filter @flowmind/api test
   pnpm --filter @flowmind/web test
   ```
4. Manually verify against the running servers (health, the changed UI page, etc.).

Because API runs under `tsx watch` and Web under `next dev`, the servers pick up the change automatically; no manual restart is normally needed. If you changed the Prisma schema, you must regenerate + migrate (step above) and restart the API.

## Using the CLI

CLI commands run from the repo root. They talk to the same API/DB as the web UI.

```bash
pnpm cli --help          # or: pnpm flowmind --help
pnpm cli agent list
pnpm cli pipeline list
pnpm cli chat            # interactive chat against the API
```

`pnpm cli` maps to `pnpm --filter @flowmind/cli start` → `node dist/index.js`, so the CLI must be built first (`pnpm --filter @flowmind/cli build`). Use `pnpm cli:dev` for a watch-mode CLI during active CLI development.

## Launching a second API on :3101

Useful for isolated testing or running a separate config against the same DB. The API reads `API_PORT` and `API_HOST` from the environment (`API_PORT` default `3001`, `API_HOST` default `0.0.0.0`).

**From source (dev):**

```bash
API_PORT=3101 pnpm --filter @flowmind/api dev
```

**From the production bundle:**

```bash
pnpm --filter @flowmind/api build   # tsup -> apps/api/dist/index.js
API_PORT=3101 node apps/api/dist/index.js
```

The second instance shares `.env` unless you override; give it a distinct `API_PORT` and (if needed) a distinct `APP_URL` for CORS. It will bind the same Postgres — that is fine for read/write tests but keep migrations and seeds single-instance.

## Attaching the agent runtime

The API talks to the runtime via `AGENT_RUNTIME_URL` (`apps/api/src/lib/config.ts` default `http://localhost:8001`). The runtime authenticates with a shared `AGENT_API_KEY`; the same key also gates the API's `/api/internal/*` endpoints and `/metrics` in production.

Flow: Web → tRPC `/trpc/*` → API → `AGENT_RUNTIME_URL` (chat / tools) → runtime → `/api/internal/execute-tool` back to the API → Ollama.

If the runtime is down, the API's `/health` reports `"agentRuntime": false` (still `status: "ok"` as long as the DB is up).

## Pointing the web at a different API

The web's API base URL is:

```ts
// apps/web/src/lib/api/core.ts
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
```

To point the web at a different API (e.g. your :3101 test instance):

```bash
NEXT_PUBLIC_API_URL=http://localhost:3101 pnpm --filter @flowmind/web dev
```

The API's CORS allow-list includes `APP_URL`, plus `http://localhost:3000` hardcoded (see `apps/api/src/index.ts`). If you run the web on a different port, update `APP_URL` in `.env` and restart the API.

## Launcher scripts on this machine

`start-dev.sh` and (via `install.sh` on Linux) `flowmind.sh` start single pieces:

- `scripts/backup.sh` — DB/artifact backup helper
- `start-dev.sh` — **web only**, hardcoded to `/home/mayanksharma/Desktop/flowmind`; kill :3000 then start `pnpm --filter @flowmind/web dev --port 3000`. Not portable.
- `install.sh` — full Linux provisioner; writes systemd units `flowmind-api.service` (:3001), `flowmind-web.service` (:3000), `flowmind-runtime.service` (:8001) plus `flowmind.sh` / `flowmind-desktop.sh` launchers. It bakes `DATABASE_URL=...:5432/...` into the API unit — **you must edit the unit to your local Postgres port** (5433 on this box) or export `DATABASE_URL` in the service `Environment=`.

> No `run-api.bat`, `run-agent-runtime.bat`, or `boot-web-standalone.ps1` exists anywhere in this repo today. The only infra launcher is `infra/scripts/start-native-infra.ps1` (Redis + Qdrant). Prefer plain `pnpm dev` + `uvicorn` over ad-hoc scripts; `.env` should be the single source of connection strings rather than baked ports in a launcher.

## Common workflows

- **Bring up everything fresh:** infra → `.env` → `pnpm install` → migrate → seed → `pnpm dev` + runtime (see `docs/development/setup.md`).
- **Iterate on a pipeline node:** edit `packages/pipeline-engine/src/`, typecheck api+web, run `pnpm --filter @flowmind/api test`, watch the API log for the run.
- **Add an env variable:** add it to `.env` and `apps/api/.env.example` (keep the template up to date); if it's optional it stays out of the Zod config; if required, list it in `apps/api/src/lib/config.ts` schema.
- **Regenerate the Prisma client on Windows:** stop the API first (DLL lock), then `pnpm db:generate`.