# Contribution

How to safely modify FlowMind without breaking the environment, the security model, or the 0-error typecheck gate.

## Before you start

1. **Read the repo conventions.** Start with `AGENTS.md` and `.opencode/tools/philosophy.md` — they are loaded as instructions by OpenCode and they define the response style, code style (TypeScript strict, Lucide icons only, no unnecessary comments), and the mandatory verification step.
2. **Load the relevant philosophy skill before writing any code** (this is mandatory per `.opencode/tools/philosophy.md`):
   - UI/frontend work → load the `frontend-philosophy` skill ("The 5 Pillars of Intentional UI")
   - Backend/logic work → load the `code-philosophy` skill ("The 5 Laws of Elegant Defense")
   - Work on both → load both
   - After implementing, verify your work against the philosophy checklist and refactor if it violates any principle.
3. **Read `docs/context/ai-context.md`** — the AI agent onboarding doc describes module relationships, security invariants, and known problems. It overlaps with this guide but adds the package map and traced feature flows.

## The gates

These are non-negotiable per `AGENTS.md`:

```bash
pnpm --filter @flowmind/api typecheck   # tsc --noEmit  -> 0 errors
pnpm --filter @flowmind/web typecheck   # tsc --noEmit  -> 0 errors
pnpm --filter <pkg> test                # the suite you touched
pnpm test                               # full unit suite before push
pnpm test:e2e                           # Playwright (spawns api+web)
pnpm lint                               # eslint across the repo
```

`.github/workflows/ci.yml` runs typecheck, lint, `pnpm audit`, build, and test on every PR to `main` — CI will catch what you miss.

## Security invariants — do not break

These were hardened during the production audit. Violating any of them is a critical regression:

| Invariant | Where enforced | Do not |
|-----------|----------------|--------|
| SSRF guard | `packages/tool-system` — all outbound HTTP goes through `fetchPublic` / `FetchPublic` with a blocklist | Bypass with a direct `fetch` / `http` call to user-controlled URLs |
| Sandbox | `codeExecute` node runs in `isolated-vm` | Execute arbitrary code outside the sandbox |
| Approval flow | Tools-v2 — `autoApprove` was removed (RCE risk); server-side single-use approval only | Re-add auto-approve |
| Tenant isolation | Skills, pipelines, knowledge bases, sessions scoped to users/orgs/groups | Cross-tenant reads/writes or leaking existence via 404 vs 401 |
| Internal endpoints deny-by-default | `/api/internal/*` require `AGENT_API_KEY` / `INTERNAL_API_KEY`; denied when unset | Make them public or default-open |
| Credentials at rest | Provider keys encrypted with AES-256-GCM via `ENCRYPTION_KEY` | Store plaintext secrets |
| JWT fallback | `apps/api/src/lib/jwt-secret.ts` throws in production | Ship a weak fallback secret to prod |
| Webhook HMAC | Stripe webhooks verified with `stripe-signature` | Accept unsigned webhooks |
| Honest failure | `apps/api/src/services/*`, billing, webhooks — no fake success, no canned replies flagged as real | Mock success or return `{received: true}` without verification |

The relevant test suites are `packages/pipeline-engine/src/__tests__/security.test.ts`, `packages/mcp-executor/src/__tests__/mcp-security.test.ts`, `packages/skill-engine/src/__tests__/sandbox.test.ts`, and `apps/api/src/__tests__/webhooks.test.ts`. Extend them when you touch these areas.

## GitHub flow

1. Branch off `main` (the repo also receives `dependabot/*` branches — don't commit on those).
2. Make focused commits (see commit style below).
3. Push and open a PR to `main`.
4. CI runs the full gate; address failures before requesting review.

## Commit messages

The repo uses **conventional commits** (see the git history):

```
feat(scope): short imperative summary

Optional body explaining WHY, not just what. Reference issues/PRs in the footer.

BREAKING CHANGE: ... (when applicable)
```

Types used: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. Scope matches the package or area, e.g. `feat(api)`, `fix(pipeline-engine)`, `docs(development)`, `test(auth)`.

## Pull-request checklist

Before opening a PR, verify:

- [ ] `AGENTS.md` and the philosophy skills were read; the relevant philosophy was applied
- [ ] `pnpm --filter @flowmind/api typecheck` and `pnpm --filter @flowmind/web typecheck` are both 0 errors
- [ ] The touched suites pass (`pnpm --filter <pkg> test`)
- [ ] `pnpm test` passes (241+1 baseline; all pass, at most the known 1 skip)
- [ ] `pnpm test:e2e` passes (needs api+web+db up)
- [ ] `pnpm lint` passes
- [ ] No security invariant was loosened; security-relevant changes extend the applicable test suite
- [ ] New env vars are documented in `.env.example` and `apps/api/.env.example` (if the API reads them)
- [ ] New behavior ships with tests covering the failure path (honest-failure philosophy)
- [ ] **Documentation is part of the product** — update `docs/` when behavior changes (ports, env, commands, architecture). Stale docs are treated as bugs.

## Documentation rule

When you change behavior (a port, an env var, a command, an endpoint, a security rule), update the corresponding doc in this repo — `README.md`, `docs/getting-started.md`, `docs/self-hosting.md`, `docs/architecture.md`, or `docs/development/*`. The current `docs` tree is the source of truth for humans and AI agents; let it stay truthful.

## Known areas of drift (standardize carefully)

- `docs/getting-started.md` still says Node 20+ / PostgreSQL 14+ — stale; the repo requires **Node >= 22, PostgreSQL 16+**.
- `apps/api/.env.example` sets `APP_URL=http://localhost:4000` while the root `.env.example` sets `http://localhost:3000` — reconcile toward the web/API pair you actually run.
- All `.env.example`, compose, and k8s files bake Postgres port **5432**; the live local dev DB binds **5433**. `DATABASE_URL` must match the real port.
- The launcher scripts `run-api.bat`, `run-agent-runtime.bat`, `boot-web-standalone.ps1` do **not** exist in the repo today; `start-dev.sh` is machine-specific and `install.sh` bakes 5432 into the systemd unit. Prefer `.env` + `pnpm dev` + uvicorn over baking ports into launchers.