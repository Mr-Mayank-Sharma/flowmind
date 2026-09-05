# Infrastructure Artifacts Inventory

This document is a map of every deployment and infra artifact in the monorepo, what each does, and — critically — its **validation status**. Several artifacts are written but have never been exercised end-to-end; treating them as production-ready would be a mistake.

## Validation legend

| Status | Meaning |
|--------|---------|
| **Validated** | Exercised locally; known to work. |
| **Broken / outdated** | Known defect; do not use as-is. |
| **Placeholder** | Real structure but contains placeholder values (secrets, hosts) that must be replaced. |
| **Unvalidated** | Written but never built/run end-to-end. |

---

## Root `Dockerfile`

Multi-stage build producing two runtime targets. Base uses `node:22-alpine` with `corepack prepare pnpm@9.15.4`.

| Target | Builds | Runs | Notes |
|--------|--------|------|-------|
| `base` | dependency manifests only (layer caching) | — | Not a runtime target. |
| `builder` | `pnpm --filter @flowmind/db db:generate` then `pnpm --filter @flowmind/api build` (tsup) | — | |
| `api` | — | `node apps/api/dist/index.js` | Retains `node_modules` for `@prisma/client` + `isolated-vm` native; copies `packages` + `packages/db/prisma` for runtime DB queries. Exposes `3001`. |
| `web` | `pnpm --filter @flowmind/web build` (Next standalone); `NEXT_PUBLIC_API_URL` build arg | — | Separate build; runs the full turbo pipeline. |
| `web-runner` | — | `node apps/web/server.js` | Copies `.next/standalone`, `.next/static`, and `public`. Exposes `3000`. |

**Validation status:** The API tsup bundle (`apps/api/dist/index.js`) was booted locally and passed health checks (`database:true`, `agentRuntime:true`). The Next standalone server boots and was validated on an alternate port. The Docker build itself has **never been run** — the targets are written but not verified end-to-end. **Unvalidated.**

---

## `deploy/docker-compose.yml`

Single-server all-in-one stack.

| Service | Build target | Ports | Notes |
|---------|--------------|-------|-------|
| `postgres` | `postgres:16-alpine` | `5432` | Healthcheck `pg_isready`. Volume `pgdata`. |
| `api` | `Dockerfile` → `api` | `3001:3001` | `DATABASE_URL` preconfigured; **`JWT_SECRET` required** via `${JWT_SECRET:?...}`. Healthcheck against `/health`. |
| `web` | `Dockerfile` → `web-runner` | `3000:3000` | `NEXT_PUBLIC_API_URL=http://localhost:3001` build arg. |
| `runtime` | `packages/agent-runtime/Dockerfile` | `8001:8001` | `OLLAMA_HOST` defaults to `http://host.docker.internal:11434`. Healthcheck `/health`. |

**Validation status:** Images referenced by this file have never been built. The `runtime` service only exposes the API-facing runtime; if you intend to use the separate `agent` image from the production compose file, note the port mismatch below. **Unvalidated.**

---

## `infra/compose/local.yml`

Local dev data services only (no app).

| Service | Ports | Notes |
|---------|-------|-------|
| `postgres` | `5432` | `16-alpine`. |
| `redis` | `6379` | `7-alpine`. |
| `qdrant` | `6333` / `6334` | REST / gRPC. |
| `minio` | `9000` / `9001` | S3-compatible object store (API / console). |
| `ollama` | (commented out) | GPU-reservation block present but disabled. |

**Validation status:** Used alongside local dev mode where Docker is available. **Validated** as the dev-infra path (the dev box itself uses native binaries instead because Docker/WSL2/Hyper-V is unavailable there).

---

## `infra/compose/production.yml`

Production-oriented compose with Traefik reverse proxy.

| Service | Image | Ports | Notes |
|---------|-------|-------|-------|
| `postgres` | `16-alpine` | none (internal) | volume `pgdata`. |
| `redis` | `7-alpine` | none | volume `redisdata`. |
| `qdrant` | `qdrant/qdrant:latest` | none | volume `qdrantdata`. |
| `api` | `flowmind/api:latest` | `3001:3001` | `DATABASE_URL` `postgres://flowmind:flowmind@postgres:5432/flowmind`, `REDIS_URL`, `QDRANT_URL`. |
| `web` | `flowmind/web:latest` | `3000:3000` | |
| `agent` | `flowmind/agent:latest` | `8000:8000` | **`agent` uses `8000`, while the runtime image itself listens on `8001`.** See the port caveat below. |
| `traefik` | `traefik:v3` | `80` / `443` | Docker provider, not exposed by default. |

> **Port caveat:** `packages/agent-runtime/Dockerfile` runs uvicorn on `:8001`, but the production compose `agent` service publishes `8000:8000`. Either change the `agent` mapping to `8001` (and align `AGENT_RUNTIME_URL`), or change the runtime to listen on `8000`. As written these disagree. **Broken (port mismatch) / Unvalidated.**

Note the production compose has no healthchecks on `postgres`/`redis`/`qdrant` and no JWT-secret required-var guard (unlike `deploy/docker-compose.yml`).

---

## `infra/k8s/` (namespace `flowmind`)

Ten manifests. The k8s README documents `kubectl apply -f infra/k8s/` and building images with `docker build --target api|web-runner`.

| Manifest | Notes | Status |
|----------|-------|--------|
| `namespace.yaml` | `flowmind` namespace. | Validated as written (trivial). |
| `configmap.yaml` | Non-secret config: `API_PORT 3001`, `API_HOST 0.0.0.0`, `APP_URL`, `NODE_ENV`, `LOG_LEVEL`, `DATABASE_URL :5432`, `REDIS_URL`, `QDRANT_URL`, `OLLAMA_URL`. | Placeholder (hosts/ports) |
| `secrets.yaml` | `JWT_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL` — all set to `change-me-in-production`. | **Placeholder — never go to production with these.** |
| `postgres.yaml` | `16-alpine`, `emptyDir` volume (non-durable), service `:5432`. | Placeholder (emptyDir, password `flowmind`) |
| `redis.yaml` | `7-alpine`, service `:6379`. | Placeholder (no auth) |
| `qdrant.yaml` | `v1.9.0` (note: NOT `latest`), services `:6333/:6334`, `emptyDir`. | Placeholder (emptyDir) |
| `api.yaml` | `flowmind/api:latest`, `/health` liveness + readiness, `256–512Mi` / `250–500m`. ClusterIP `:3001`. | Unvalidated / Placeholder (image, secrets) |
| `web.yaml` | `flowmind/web:latest`, `API_URL=http://flowmind-api:3001`, readiness on `/`, `128–256Mi`. ClusterIP `:3000`. | Unvalidated / Placeholder |
| `ingress.yaml` | Host `flowmind.local`; `/api` + `/trpc` → api `3001`, everything else → web `3000`. | Placeholder (host) |

**Key warnings**

- **Placeholder secrets.** `secrets.yaml` sets `JWT_SECRET` / `ENCRYPTION_KEY` / `DATABASE_URL` to `change-me-in-production`. Replace with real values (prefer an external store such as AWS Secrets Manager / SOPS) before any non-POC use.
- **Non-durable storage.** `postgres.yaml` and `qdrant.yaml` mount `emptyDir`, which is wiped when the pod restarts. Use a PersistentVolumeClaim (or managed RDS/ElastiCache-style services on a cloud) for real data.
- **`8000` vs `8001`.** The k8s set has no explicit `agent`/runtime deployment (only api + web). If you add the runtime, keep its port (`8001`) and `AGENT_RUNTIME_URL` consistent.

### K8s layout

```mermaid
graph LR
    subgraph NS["namespace: flowmind"]
        ING["ingress<br/>host flowmind.local"]
        WEB["web<br/>flowmind/web:latest :3000"]
        API["api<br/>flowmind/api:latest :3001<br/>liveness+readiness /health"]
        PG["postgres :5432"]
        RD["redis :6379"]
        QD["qdrant :6333/:6334"]
        ING -->|"/"| WEB
        ING -->|"/api, /trpc"| API
        API --> PG
        API --> RD
        API --> QD
    end
    CFG["configmap<br/>flowmind-config"]
    SEC["secret<br/>flowmind-secrets (PLACEHOLDER)"]
    API -.-> CFG
    API -.-> SEC
    WEB -.-> CFG
```

---

## `deploy/` systemd units

Four unit files (plus `flowmind.target` to group them) used for bare-metal Linux via `install.sh`.

| Unit | Runs | Notes |
|------|------|-------|
| `flowmind-api.service` | `pnpm --filter @flowmind/api dev` | Dev-mode server under systemd; `WorkingDirectory=/opt/flowmind`; `DATABASE_URL` hardcoded to localhost `:5432`. |
| `flowmind-web.service` | `pnpm --filter @flowmind/web start --port 3000` | Next start. |
| `flowmind-runtime.service` | `uvicorn src.main:app --host 127.0.0.1 --port 8001` | Runtime on `127.0.0.1:8001`. |
| `flowmind.target` | oneshot group | Requires all three. |

**Validation status:** Unit files are written but the services have not been exercised as a tested, public deployment. The API unit runs `pnpm dev` (a dev server), not the built production bundle. **Unvalidated / dev-mode.**

---

## `install.sh` (repo root)

Linux/Darwin provisioning script. Installs Node via nvm, pnpm, git, Ollama, PostgreSQL (user/db `flowmind`/`flowmind`), Qdrant (Docker), Redis (Docker/apt/brew), clones the repo to `~/.flowmind`, installs deps, cleans stale caches, builds packages, runs `db:migrate`, links the CLI, pip-installs the runtime, writes the three systemd units (`flowmind-api/web/runtime`), and creates launcher scripts.

**Validation status:** **Unvalidated** — has never been run end-to-end. Note it (a) relies on `pnpm dev` for the API, (b) hardcodes the `flowmind`/`flowmind` DB credentials, and (c) uses Docker for Qdrant/Redis when available.

---

## `scripts/backup.sh`

Backup automation that dumps PostgreSQL (`pg_dump -F c`), Redis RDB (`SAVE` + copy `dump.rdb`), Qdrant snapshot (snapshot API), and archives `.env` files. Retention cleanup via `-mtime +RETENTION_DAYS`.

**Validation status:** **Depends on Docker containers** named `flowmind-postgres-1`, `flowmind-redis-1`, `flowmind-qdrant-1` (the default compose names). On the dev box these run as native binaries, so the script's `docker exec` steps will skip or fail there. Treat as compose-deployment-oriented; not the native-infra path. **Compose-only / Unvalidated on native.**

---

## `infra/scripts/start-native-infra.ps1`

Windows PowerShell launcher for native Redis + Qdrant binaries (used on the dev box where Docker/WSL2/Hyper-V is unavailable). **Validated** as the local-infra path for that environment.

---

## Summary

| Artifact | Purpose | Status |
|----------|---------|--------|
| `Dockerfile` (`api`, `web-runner`) | App images | Code validated locally; build never run → **Unvalidated** |
| `deploy/docker-compose.yml` | All-in-one stack | **Unvalidated** |
| `infra/compose/local.yml` | Dev data services | **Validated** (dev) |
| `infra/compose/production.yml` | Production stack + Traefik | **Broken** (agent `8000` vs runtime `8001`) / Unvalidated |
| `infra/k8s/*` | Cluster deployment | **Placeholder** secrets + emptyDir; Unvalidated |
| `deploy/*.service` | systemd (bare metal) | **Unvalidated** (dev-mode API) |
| `scripts/backup.sh` | Backups | **Compose-only** / Unvalidated on native |
| `install.sh` | Linux provisioning | **Unvalidated** |
| `infra/scripts/start-native-infra.ps1` | Native Redis+Qdrant | **Validated** (local dev box) |

Before any public deployment, resolve the placeholder secrets, the `8000`/`8001` mismatch, and the non-durable storage — see [production-checklist.md](./production-checklist.md).
