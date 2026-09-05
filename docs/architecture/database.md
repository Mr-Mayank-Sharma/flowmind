# Database & Storage Architecture

FlowMind uses four storage tiers alongside external services. This document
covers their **roles** at an overview level. The deep Prisma model detail lives
in [../data-model/overview.md](../data-model/overview.md) — this document links
to it rather than repeating it.

Sibling documents: [overview.md](./overview.md), [system.md](./system.md),
[backend.md](./backend.md), [api.md](./api.md),
[integrations.md](./integrations.md).

---

## Storage tiers at a glance

```mermaid
flowchart LR
  subgraph Tier1["Postgres (primary relational store)"]
    PG[(packages/db :5433 live / 5432 baked)]
    PG --> PRISMA[Prisma, 46 models]
  end

  subgraph Tier2["Redis (ephemeral state)"]
    RD[(ioredis :6379)]
    RD --> KV[KeyValueStore: rate limits, auth attempts, SSO state]
  end

  subgraph Tier3["Qdrant (vector store)"]
    QD[(qdrant-client :6333)]
    QD --> COLL[flowmind_contexts, 384-dim]
  end

  subgraph Tier4["Ollama (local model + embeddings)"]
    OL[(Ollama :11434)]
  end

  API[apps/api] --> PG & RD & QD
  PIPE[pipeline-engine] --> OL
  RUNTIME[agent-runtime] --> OL
```

| Tier | What it is | Role |
|------|-----------|------|
| Postgres | Primary relational DB (Prisma ORM) | Users, orgs, pipelines, runs, messages, billing, marketplace, audit, knowledge metadata |
| Redis | In-memory state (ioredis w/ memory fallback) | Rate limits, auth brute-force attempts, SSO states, ephemeral counts |
| Qdrant | Vector DB (qdrant-client) | `flowmind_contexts` collection, 384-dimensional embeddings for RAG |
| Ollama | Local inference server | Chat completions + embeddings (`all-minilm`) |

---

## Postgres + Prisma

- **Schema**: `packages/db/prisma/schema.prisma` (postgresql, `prisma-client-js`).
  Verified **46 models** by grep; the sibling doc records **17 enums**
  (see [../data-model/overview.md](../data-model/overview.md)).
- **Client**: `@prisma/client` re-exported by `@flowmind/db`; the API imports
  `prisma` from `@flowmind/db` in `middleware/context.ts` and everywhere else.
- **Migrations**: stored under `packages/db/prisma/migrations/` as timestamped
  directories containing `migration.sql` per Prisma convention.
- **Scripts** (`packages/db/package.json`): `db:generate` (`prisma generate`),
  `db:migrate` (`prisma migrate dev`), `db:seed` (`tsx src/seed.ts`),
  `db:studio` (`prisma studio`). Root scripts proxy these via
  `pnpm --filter @flowmind/db ...`.

### Windows development caveats (from docs/data-model/overview.md)

1. **`prisma migrate dev` fails with P3014** on some Windows setups
   (schema-file-not-found from the generated client). Workaround: use
   `prisma db execute` for manual SQL, or `prisma migrate deploy` after
   generating SQL externally.
2. **`prisma generate` requires the API to be stopped** — the generated client
   writes into `node_modules`, which conflicts with a running dev server.
3. **Port mapping**: the live local Postgres binds to **5433** on the host,
   while `.env.example`, `docker-compose.yml`, `deploy/*.service`, and k8s
   manifests default to **5432**. `DATABASE_URL` must be overridden to 5433
   locally (see `docs/context/ai-context.md`).

The live `.env` files confirm the discrepancy:
`.env` and `apps/api/.env` both use
`postgresql://flowmind:flowmind@localhost:5433/flowmind`, whereas
`.env.example`/`apps/api/.env.example` use `5432`.

### What lives in Postgres

Users, orgs & tenancy, host groups/clients, sessions & messages, skills,
memories, MCP servers & tokens, pipelines & runs & run logs, marketplace
(flows/reviews/clones/listings/versions/forks/revenue/categories), billing
(subscriptions/org subscriptions/usage records), frameworks & system metrics,
audit log, notifications, knowledge bases/documents, cron jobs, agents.
See [../data-model/overview.md](../data-model/overview.md).

---

## Redis

- **Client**: `apps/api/src/lib/redis.ts` — an ioredis lazy singleton
  (`getRedisClient`), a `KeyValueStore` interface
  (`get`/`set`/`del`/`incr` with TTL), and `getStateStore()`.
- **Fallback**: if Redis is unreachable the store transparently falls back to
  an **in-memory Map within the process** (with TTL sweep), logging
  `[redis] Unreachable — falling back to in-memory state for this process`.
  This is single-process dev behavior only, not a distributed fallback.
- **Used for**:
  - Per-tier tRPC rate limits (`middleware/trpc.ts`
    → keys `rate:tier:<tier>:<userId>:<windowStart>`)
  - Auth brute-force attempts (`authRouter` → keys `auth:attempts:<ip>:<email>`)
  - SSO state nonces (keys `auth:sso:<state>`)
  - Global Fastify rate limiter (`index.ts` registers
    `@fastify/rate-limit` with redis when available)
- URL default `redis://localhost:6379`.

---

## Qdrant (vector store)

- **Client**: `packages/context-engine` (TypeScript) connects via
  `qdrant-client`; collection name **`flowmind_contexts`**, **384-dim** vectors
  (verified in project facts / context engine).
- **Usage**: knowledge/RAG retrieval. The API's `ContextEngine`
  (`apps/api/src/services/context-engine.ts`) is used by `ChatService`
  (top-3 chunk search before sending a message) and by pipeline `ragSearch`
  (top-5 vs top-K chunk search, with group scoping via
  `userId: "group:<groupId>"`).
- **Python runtime path**: `packages/agent-runtime/src/context_engine.py` also
  wraps Qdrant when `QDRANT_URL` is set; otherwise the runtime falls back to a
  JSON file knowledge store (`data/knowledge_store.json`, cosine similarity).
- An **in-memory fallback** is available when Qdrant is unreachable.

---

## Ollama (local inference)

- **Default URL**: `http://localhost:11434`
  (`OLLAMA_BASE_URL | OLLAMA_URL` in `apps/api/src/lib/config.ts`).
- **Usage**:
  - `llm-router` (API-side agent loop + pipeline AI node runners)
  - `agent-runtime` (`/llm/generate` calls `localhost:11434/api/chat`,
    embeddings call `localhost:11434/api/embeddings` with model `all-minilm`)
- **Status**: verified running in the local dev environment.

---

## Storage tier diagram (roles)

```mermaid
flowchart TB
  API[apps/api]
  CHAT[ChatService / agent loop]
  PIPE[PipelineEngine]
  AUTH[authRouter]

  API --> PG[Postgres]
  API --> RD[Redis]
  API --> QD[Qdrant]
  API --> OL[Ollama]

  CHAT -->|top-3 context chunks| QD
  PIPE -->|ragSearch| QD
  PIPE -->|LLM calls| OL
  AUTH -->|brute-force + SSO state| RD
  API -->|tier rate limits| RD
```

---

## Honest notes

- The **current runtime** uses localhost native processes: Postgres on 5433,
  Redis/Qdrant started via `infra/scripts/start-native-infra.ps1`, Ollama on
  11434. Docker-based layouts (compose/k8s) exist but are unvalidated (see
  [deployment.md](./deployment.md)).
- The in-memory fallbacks (Redis `KeyValueStore` memory fallback, Qdrant
  in-memory fallback, runtime JSON knowledge store) work only within a single
  process and are not cluster-safe.