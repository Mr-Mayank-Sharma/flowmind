# Setup Guide

How to go from a fresh machine to a running FlowMind stack: API, Web UI, and (optionally) the Python agent runtime. This guide is the source of truth for local development. Where older docs drift from reality, this page wins.

## Port Map

Everything below is verified against the current source.

| Service | Port | How it starts | In `pnpm dev`? |
|---------|------|---------------|----------------|
| Web UI (Next.js) | 3000 | `pnpm dev` / `pnpm --filter @flowmind/web dev` | Yes |
| API (Fastify + tRPC) | 3001 | `pnpm dev` / `pnpm --filter @flowmind/api dev` | Yes |
| Agent runtime (Python/uvicorn) | 8001 | Started separately (see step 8) | **No** |
| PostgreSQL | **5433** locally (5432 baked into configs) | Native binary / compose | No |
| Redis | 6379 | Native binary / compose | No |
| Qdrant | 6333 | Native binary / compose | No |
| Ollama | 11434 | `ollama serve` | No |

> **`pnpm dev` runs only the API (:3001) and the Web UI (:3000).** It does **not** start the Python agent runtime. Chat and pipeline inference that rely on the runtime require you to start it yourself (step 8).

## Prerequisites

| Component | Requirement | Notes |
|-----------|-------------|-------|
| OS | Linux, macOS, Windows (WSL2 recommended) | Native Windows works but has Prisma quirks (below) |
| Node.js | **>= 22.x** | Enforced in `package.json` `engines` (`>=22.x`) |
| pnpm | **>= 9.x** (repo pins `pnpm@9.15.4`) | Enable via `corepack` or `npm i -g pnpm` |
| PostgreSQL | **16+** | Live dev DB binds to **5433** here |
| Redis | 7+ | Optional but recommended (rate-limit, sessions, SSE); the API falls back to in-memory if absent |
| Qdrant | any recent | Optional; vector search / RAG for knowledge bases |
| Ollama | any recent | Local LLM inference; optional if you use cloud models |
| Python | **>= 3.11** | Agent runtime only; use a virtualenv |
| git | any | To clone |

### pnpm (corepack)

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm -v   # 9.15.4
```

If corepack is unavailable on your system, `npm install -g pnpm@9` works too.

## Step-by-step

### 1. Clone

```bash
git clone https://github.com/Mr-Mayank-Sharma/flowmind.git
cd flowmind
```

### 2. Install dependencies

```bash
pnpm install
```

`postinstall` runs `pnpm db:generate` automatically, so the Prisma client is generated on install. If it fails on Windows, see the Prisma caveats below (you may need to stop the API first).

### 3. Configure `.env`

`.env` is **created manually** — no script writes it. There is a root `.env.example` plus `apps/api/.env.example`.

```bash
cp .env.example .env
```

Then edit `.env`. Minimum viable settings for a working login + chat:

- `DATABASE_URL` — **see the port warning below; you must fix the port.**
- `JWT_SECRET` — 32+ characters. In production the API refuses to start without one.
- `ENCRYPTION_KEY` — 32+ characters (AES key used for credentials at rest).
- `AGENT_API_KEY` — must match between the API and the agent runtime.
- `OLLAMA_URL` (or `OLLAMA_BASE_URL`) — for real chat inference via local Ollama.

Optional but recommended: `REDIS_URL` (`redis://localhost:6379`) and `QDRANT_URL` (`http://localhost:6333`) for durable rate-limiting/session state and vector RAG.

> **WARNING — PostgreSQL port 5433 vs 5432.**
>
> The live/local Postgres on this machine binds to **5433**, but `.env.example`, `apps/api/.env.example`, `infra/compose/*.yml`, `deploy/docker-compose.yml`, and `infra/k8s/*` all bake **5432**. If you leave the default, the API will fail to reach the database. On this dev machine set:
>
> ```bash
> DATABASE_URL="postgresql://flowmind:flowmind@localhost:5433/flowmind"
> ```
>
> If you run the database yourself on the standard 5432 (e.g. via `docker compose -f infra/compose/local.yml up -d`), use the 5432 form. The port must match **your** Postgres, not the baked default. This single mismatch is the most common first-run failure.

### 4. Start the infrastructure

Choose one path.

**Option A — Docker (Linux / macOS / WSL2 with Docker):**

```bash
docker compose -f infra/compose/local.yml up -d
```

This starts postgres :5432, redis :6379, qdrant :6333, and minio (S3) :9000/:9001. Ollama is commented out in the compose file — run `ollama serve` yourself.

**Option B — Native binaries (Windows without WSL2/Hyper-V):**

This dev box cannot run Docker/WSL2 (`HCS_E_HYPERV_NOT_INSTALLED`), so Redis and Qdrant run as native Windows processes launched by:

```powershell
powershell -ExecutionPolicy Bypass -File infra/scripts/start-native-infra.ps1
```

The script starts Redis and Qdrant if they are not already listening on :6379 / :6333 and prints a health check. Postgres and Ollama on Windows are installed/run separately (native installers). The only base-infra launcher in the repo is `infra/scripts/start-native-infra.ps1`.

### 5. Generate and migrate the Prisma schema

The Prisma client is produced by `postinstall` (`pnpm db:generate`). To regenerate explicitly and apply migrations:

```bash
pnpm db:generate
pnpm db:migrate
```

**Windows caveats (verified):**

- `prisma migrate dev` fails on Windows with **P3014**. Workaround: apply migrations directly with
  ```bash
  npx prisma db execute --file <migration.sql>
  ```
  or, once a migration has already been recorded, `npx prisma migrate deploy`.
- `prisma generate` can fail with an **EPERM DLL file-lock** while the API Node process is running. **Stop the :3001 process before regenerating the client.**

### 6. Optional: seed an admin user/org

The seed is gated on env vars; it is a no-op without them. `ADMIN_NAME` and `ADMIN_ORG_NAME` are optional extras.

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=your-strong-password pnpm db:seed
```

### 7. Create the Python agent runtime virtualenv

The agent runtime lives at `packages/agent-runtime` and requires **Python 3.11+**. Install its deps (pinned in `requirements.txt`: fastapi 0.109.2, uvicorn 0.27.1, qdrant-client 1.9.1, httpx, pydantic, sse-starlette, numpy, sqlite-utils):

```bash
cd packages/agent-runtime
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate
pip install -r requirements.txt
```

### 8. Start the services

**API + Web UI (dev):**

```bash
cd <repo root>
pnpm dev
```

- API on http://localhost:3001 (`tsx watch` — hot reload on source change)
- Web UI on http://localhost:3000 (`next dev` — hot reload)

**Agent runtime (separate, NOT started by `pnpm dev`):**

```bash
cd packages/agent-runtime
# ensure AGENT_API_KEY is set to the same value as the API's .env
set AGENT_API_KEY=your-shared-key      # Windows
# export AGENT_API_KEY=your-shared-key # Linux/macOS
python -m uvicorn src.main:app --host 127.0.0.1 --port 8001
```

Set `AGENT_API_KEY` to the **exact same value** used in the API's `.env`. The runtime holds no state you must share, only the auth key. Bearer auth applies to everything except `/health`.

### 9. Verify it works

Run this checklist:

```bash
# API health (checks database + agentRuntime behind it)
curl http://localhost:3001/health
# -> {"status":"ok","version":"0.1.0","uptime":...,"checks":{"database":true,"agentRuntime":true}}

# Runtime health
curl http://localhost:8001/health
# -> {"status":"ok"}

# Redis
redis-cli PING                 # -> PONG

# Qdrant
curl http://localhost:6333/collections   # -> {"result":{"collections":[]},...}

# Ollama
curl http://localhost:11434/api/tags     # list of local models
```

Then open http://localhost:3000.

### 10. Register / log in

Open the Web UI and register a new account, or log in with the seeded admin. If you seeded an admin, use those `ADMIN_EMAIL`/`ADMIN_PASSWORD` values. Chat only produces real replies when Ollama (or a cloud provider) is reachable and `OLLAMA_URL` is set.

## "Verify it works" final checklist

- [ ] `pnpm install` finished without errors and `postinstall` generated the Prisma client
- [ ] `.env` exists and `DATABASE_URL` points to the **correct local Postgres port** (5433 on this box)
- [ ] `JWT_SECRET` and `ENCRYPTION_KEY` are set to 32+ char values
- [ ] `AGENT_API_KEY` is identical in the API `.env` and the runtime environment
- [ ] Postgres/Redis/Qdrant (and Ollama if used) are reachable
- [ ] `pnpm db:migrate` applied cleanly (on Windows use the P3014 workaround)
- [ ] `pnpm dev` boots the API on :3001 and Web on :3000
- [ ] Agent runtime is up on :8001 (started separately)
- [ ] `curl http://localhost:3001/health` returns `"status":"ok"` with `"agentRuntime":true`
- [ ] http://localhost:3000 register/login works and chat returns a real reply

## Doc drift (standardized here)

The root `README.md` correctly requires **Node >= 22** and **PostgreSQL 16+**. The older `docs/getting-started.md` still says **Node 20+** and **PostgreSQL 14+** — that is stale. This repo's truth is **Node >= 22, PostgreSQL 16+, live Postgres on port 5433**. Use this guide over `docs/getting-started.md`.
