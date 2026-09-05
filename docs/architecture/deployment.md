# Deployment Architecture

This document describes deployment artifacts as they **exist in the repo**, and
the honest reality that the current runtime is dev-mode localhost. Deployment
is aspirational: images are written but largely unvalidated.

Sibling documents: [overview.md](./overview.md), [system.md](./system.md),
[backend.md](./backend.md), [database.md](./database.md), [api.md](./api.md),
[integrations.md](./integrations.md).

---

## What exists today

| Artifact | Path | Purpose |
|----------|------|---------|
| Root Dockerfile | `Dockerfile` | Multi-stage; targets `base`, `builder`, `api`, `web`, `web-runner` |
| Compose (deploy) | `deploy/docker-compose.yml` | postgres + api + web + runtime services |
| Compose (infra) | `infra/compose/local.yml`, `infra/compose/production.yml` | local data services; production topology with traefik |
| Kubernetes | `infra/k8s/` (10 manifests) | namespace, configmap, secrets, postgres, redis, qdrant, api, web, ingress |
| Native infra launcher | `infra/scripts/start-native-infra.ps1` | start Redis + Qdrant as native Windows processes |
| Provisioning | `install.sh` | bash installer (Linux/macOS) |
| Systemd units | `deploy/flowmind-api.service`, `deploy/flowmind-runtime.service`, `deploy/flowmind-web.service`, `deploy/flowmind.target` | intended Linux unit files |
| Backup | `scripts/backup.sh` | backup script |
| Dev launchers | `start-dev.sh` | simple web dev runner |

---

## Intended compose topology

```mermaid
flowchart TB
  subgraph compose["deploy/docker-compose.yml"]
    PG[(postgres:16-alpine)]
    API[api :3001]
    WEB[web :3000]
    RUNTIME[runtime :8001]
  end

  WEB -->|HTTP| API
  API -->|Prisma| PG
  API -.->|AGENT_RUNTIME_URL http://runtime:8001| RUNTIME
  RUNTIME -.->|host.docker.internal:11434| OLLAMA[Ollama host process]
```

`deploy/docker-compose.yml` (verified):

- **postgres** — `postgres:16-alpine`, port `5432:5432`, volume `pgdata`,
  healthcheck `pg_isready`.
- **api** — build target `api`, port `3001:3001`, env `DATABASE_URL`,
  `JWT_SECRET` (required), `AGENT_RUNTIME_URL: http://runtime:8001`,
  `APP_URL`, `NODE_ENV: production`, `LOG_LEVEL`, rate-limit overrides;
  depends on postgres healthy.
- **web** — build target `web-runner`, args `NEXT_PUBLIC_API_URL:
  http://localhost:3001`, `NEXT_PUBLIC_SENTRY_DSN`, port `3000:3000`.
- **runtime** — context `packages/agent-runtime`, `Dockerfile` there
  (`python:3.12-slim`, uvicorn :8001), env `OLLAMA_HOST`,
  `FLOWMIND_API_URL`, `AGENT_API_KEY`, `CORS_ORIGINS`, `LOG_LEVEL`,
  healthcheck curl :8001/health.
- Single volume `pgdata`.

`infra/compose/local.yml` adds **redis**, **qdrant**, and **minio** (with an
Ollama service commented out). `infra/compose/production.yml` describes
postgres/redis/qdrant + api/web/agent images + a **traefik** reverse proxy.

---

## Dockerfile structure

`Dockerfile` (root):

- `base` — `node:22-alpine`, corepack-pinned `pnpm@9.15.4`, copies manifests.
- `builder` — copies all, runs `pnpm --filter @flowmind/db db:generate` then
  `pnpm --filter @flowmind/api build` (tsup single-file bundle).
- `api` — minimal `node:22-alpine`; copies `node_modules`, `packages`,
  `apps/api/dist`, Prisma schema/migrations; `CMD node apps/api/dist/index.js`;
  exposes 3001.
- `web` — copies all, runs `db:generate` + `next build`.
- `web-runner` — copies only `apps/web/.next/standalone`, static, and public;
  `CMD node apps/web/server.js`; exposes 3000.

---

## Kubernetes manifests (infra/k8s, 10 files)

Verified listing:

1. `namespace.yaml`
2. `configmap.yaml`
3. `secrets.yaml`
4. `postgres.yaml`
5. `redis.yaml`
6. `qdrant.yaml`
7. `api.yaml`
8. `web.yaml`
9. `ingress.yaml`
10. `README.md`

The configmap/secrets bake `DATABASE_URL` at
`postgresql://flowmind:flowmind@postgres:5432/flowmind` (note: port 5432).

---

## Native infra launcher (Windows)

`infra/scripts/start-native-infra.ps1` starts Redis and Qdrant as native
Windows processes from
`C:\Program Files\KMSpico\temp\opencode\infra-bin\{redis,qdrant}`. Its header
comment names the reason Docker is unavailable on the dev box:
`HCS_E_HYPERV_NOT_INSTALLED` (no Hyper-V). It checks ports 6379/6333 before
starting, runs a `redis-cli PING`, and lists Qdrant collections.

---

## Provisioning and units

- **`install.sh`** — bash installer for Linux/macOS: detects OS/arch, installs
  Node ≥ 22 (via nvm) and pnpm 9, clones `https://github.com/Mr-Mayank-Sharma/flowmind.git`
  into `~/.flowmind` by default, creates `.env`
  (`DATABASE_URL=postgresql://flowmind:flowmind@localhost:5432/flowmind`),
  and provisions the project (verified partial — full flow continues past line
  60 of the file).
- **`deploy/*.service`** — systemd unit files (api, runtime, web) plus a
  `flowmind.target`. The api unit runs `pnpm --filter @flowmind/api dev` with
  `NODE_ENV=production` and a `DATABASE_URL` on `localhost:5432`. These are
  **intended** units, not verified against a running Linux host.
- **`scripts/backup.sh`** — backup script (exists at `scripts/backup.sh`).
- **`start-dev.sh`** — dev launcher for the web app on port 3000.

---

## Honest deployment reality

```mermaid
flowchart LR
  subgraph "Designed (written but not run)"
    D[Dockerfile / compose / k8s]
  end
  subgraph "Actually running (dev box)"
    RV[Dev-mode localhost processes]
  end
  D -.->|unvalidated, no Hyper-V| X[(no Docker)]
  RV --> WEB2[web :3000]
  RV --> API2[api :3001]
  RV --> RT2[runtime :8001]
  RV --> PG2[(postgres :5433)]
  RV --> RD2[(redis :6379)]
  RV --> QD2[(qdrant :6333)]
```

- **Docker cannot run on the active dev box** — no Hyper-V
  (`HCS_E_HYPERV_NOT_INSTALLED` per `start-native-infra.ps1`). The image builds
  have not been executed/validated there.
- **Current runtime is dev-mode localhost** — web via `next dev`, api via
  `tsx watch`, agent-runtime via uvicorn, Redis/Qdrant via native binaries,
  Postgres on :5433, Ollama on :11434.
- **Port discrepancy** — compose/k8s/systemd/env.example bake Postgres on
  **5432**; the live dev DB is on **5433**. Deploying from these artifacts
  without adjusting `DATABASE_URL` will fail to connect.
- **No production host** exists for k8s; the manifests are aspirational and
  untested against a live cluster.