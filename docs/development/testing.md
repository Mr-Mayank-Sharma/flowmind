# Testing

Testing strategy, how to run each layer, the typecheck gate, and the Windows caveats that affect the DB test path.

## Layers

| Layer | Framework | Entry points | Coverage |
|-------|-----------|--------------|----------|
| Unit | Vitest | `packages/*/vitest.config.ts`, `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts` | Return values, security invariants, routing, edge cases — no live servers needed |
| E2E | Playwright | `e2e/health.spec.ts` with `e2e/playwright.config.ts` | Boots API :3001 + Web :3000, hits `/health`, `/metrics`, login page |
| Build/type gates | `tsc --noEmit` | `pnpm typecheck` (per package `typecheck`) | 0 TS errors on `apps/api` + `apps/web` is a hard merge gate |

There are **14 vitest configs** across the monorepo (one per package/app that has tests). Test files live in `src/__tests__/*.test.ts` per package.

## Unit test suites (what covers what)

| Suite | What it tests |
|-------|---------------|
| `apps/api/src/__tests__/` | webhooks, tools, tools-v2, llm-keys, jwt-secret, chat-service, billing |
| `apps/web/src/__tests__/` | core store, chat store |
| `packages/pipeline-engine/src/__tests__/` | security (SSRF/HTTP rules), runners, graph, engine, email, connectors |
| `packages/llm-router/src/__tests__/` | ollama provider, agent loop |
| `packages/auth/src/__tests__/` | SAML, JWT secret |
| `packages/permission/src/__tests__/` | minimatch rule evaluation |
| `packages/skill-engine/src/__tests__/` | skill spec, sandbox |
| `packages/mcp-executor/src/__tests__/` | PKCE, mcp security, mcp http, mcp client stdio |
| `packages/billing/src/__tests__/` | billing |
| `packages/session-engine/src/__tests__/` | session engine |
| `packages/context-engine/src/__tests__/` | context engine (VectorContextEngine) |
| `packages/channel-gateway/src/__tests__/` | whatsapp, openhuman |
| `packages/snapshot/src/__tests__/` | snapshot |
| `packages/runtime-registry/src/__tests__/` | runtime registry |

## How to run

**Single package:**

```bash
pnpm --filter @flowmind/api test
pnpm --filter @flowmind/pipeline-engine test
```

**Everything (Turborepo, in dependency order):**

```bash
pnpm test
```

**E2E (Playwright):**

```bash
pnpm test:e2e
```

`e2e/playwright.config.ts` starts both servers itself (`webServer` entries run `pnpm --filter @flowmind/api dev` and `pnpm --filter @flowmind/web dev`, `reuseExistingServer: true`). The three specs:

- API `/health` returns `200` with `{ status: "ok", version: "0.1.0", uptime: number }`
- `/login` page shows "Welcome back"
- `/metrics` returns Prometheus text containing `nodejs_version_info`

## Known baseline

- **242 automated tests** across the repo today (241 pass, 1 skip) — this is the moving baseline.
- **All must pass before you push.** `pnpm test` failing on `main` is a regression. Run `pnpm test` locally (or let CI do it — `.github/workflows/ci.yml` runs `pnpm typecheck`, `pnpm lint`, `pnpm audit --audit-level=high`, `pnpm build`, `pnpm test` on PRs to `main`).

## Typecheck gate

Per `AGENTS.md`:

```bash
pnpm --filter @flowmind/api typecheck   # tsc --noEmit
pnpm --filter @flowmind/web typecheck   # tsc --noEmit
```

Both must be **0 errors**. `pnpm typecheck` (root, via Turborepo) checks every package; dependency on `^build` means shared packages are built first.

## Windows caveats that affect the DB test path

- **`prisma migrate dev` fails on Windows with P3014.** Use `npx prisma db execute --file <migration.sql>` (or `npx prisma migrate deploy` for an already-recorded migration). (Verified — see `docs/context/ai-context.md`.)
- **`prisma generate` can fail with an EPERM DLL file-lock while the API Node process is running.** Stop any `pnpm --filter @flowmind/api dev` / `node dist/index.js` before regenerating the client. The client is generated at `postinstall` (`pnpm install`) and by `pnpm db:generate`.
- Tests that fake the DB (e.g. mocks of `config`) are already the norm rather than live-DB integration tests, so the unit layer generally does **not** require Postgres. The E2E layer does require Postgres on :5433(the live port on this box) plus Redis/Qdrant optionally.

## Writing tests

- Follow the existing vitest `describe`/`it` pattern in the package you're editing.
- New behavior should ship with a test that exercises the failure path as well as the happy path — the repo is strict about the honest-failure philosophy (see `docs/development/contribution.md`).
- Security invariants have dedicated suites (SSRF guard in `pipeline-engine/security.test.ts`, MCP security, sandbox). If you touch those invariants, extend those files.