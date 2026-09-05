# Remaining — Required for the Current Vision to Be Complete

Everything required for the current product vision (an n8n-class, publicly deployable AI workflow platform) to be complete. Prioritized: **P0** (must-have to be a public product), **P1** (high value, clear path), **P2** (significant but deferrable). Status markers:
- ❌ = not started
- 🚧 = started but incomplete (details in [in-progress.md](./in-progress.md))

---

## P0 — Blockers to public product

### 1. Public deployment on AWS ❌

The AWS architecture is a fully-specified **recommendation** in `docs/deployment/aws.md`, not a deployment. Every service is localhost-only today.

**Required:**
- Build + validate container images (see [in-progress.md](./in-progress.md#docker-image-validation)).
- Provision AWS: ECS Fargate (web/api/runtime), RDS PostgreSQL, ElastiCache Redis, Qdrant (EFS), S3, ALB + ACM + Route 53, VPC/private subnets.
- Move all `Secret: Y` env vars to Secrets Manager; generate real secrets.
- Run `pnpm db:migrate` as a one-shot task; deploy web/api/runtime; wire ALB routing and TLS.
- Smoke test the public HTTPS URL (register, run a pipeline, verify inference and `/metrics`).
- **Port note:** local dev runs Postgres on `:5433` while env.example/compose/k8s bake `:5432`. RDS uses `:5432` internally — the discrepancy is documented in `docs/deployment/aws.md` §2.

**Priority:** High. **Evidence:** `docs/deployment/aws.md` (honesty note: nothing deployed); VERIFICATION-REPORT §10.

### 2. Real Stripe billing checkout ❌

The service logic is real but disabled (no keys). Requires live validation of checkout → webhook → subscription syncing.

**Required:**
- Provision `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_<TIER>` values.
- Verify the checkout session, `checkout.session.completed` webhook, subscription sync, portal, and team-seat quantity update live.
- Verify invoice payment-failed notifications.

**Priority:** High. **Evidence:** `docs/features/billing.md`; VERIFICATION-REPORT §11.

### 3. Live cloud LLM inference ❌

Only local Ollama inference is verified. The 16 cloud provider wirings are untested with real keys.

**Required:**
- Provision at least one real provider key (OpenAI/Anthropic) and verify the full agent loop end-to-end (tool use + streaming) against it.
- Clean up dead config keys (`githubCopilotKey`, `awsBedrockKey`).
- Decide cloud-only vs GPU-Ollama path per `docs/deployment/aws.md` §1.

**Priority:** High. **Evidence:** VERIFICATION-REPORT §6, §11; `packages/llm-router/src/engine.ts`.

### 4. Real OAuth / SSO ❌

SSO state and login flows are real, but no genuine OAuth provider flow has been exercised (no real credentials); SAML and MFA surfaces are declared but not wired.

**Required:**
- Verify Google/GitHub OAuth with real client credentials (register, login, existing-user link).
- Refresh-token rotation + blacklist on logout (current single 7d JWT is not rotated).
- Resolve the permissive email-identity-link issue (OAuth upsert can overwrite password-user oauth fields).
- Complete SAML and TOTP/webauthn MFA — currently declared-only.

**Priority:** High. **Evidence:** `docs/features/authentication.md`; VERIFICATION-REPORT §11; REBUILD-PLAN progress.

### 5. Channel integrations incl. WhatsApp end-to-end ❌

See [in-progress.md](./in-progress.md#channel-gateway--whatsapp) for current state. WhatsApp is non-functional end-to-end; channel-gateway adapters are not wired into app prod.

**Required:**
- Implement agent-runtime `/webhook/ingest` (the dead-end route).
- Instantiate channel adapters in app prod; real listeners for telegram/openhuman; implement the slack/discord/whatsapp/email stubs.
- WhatsApp full fix: Meta verify handshake, Graph-shaped normalizer, adapter wiring, message persistence, template support, end-to-end test.

**Priority:** High. **Evidence:** `docs/whatsapp/overview.md`; VERIFICATION-REPORT §9.

---

## P1 — High value, clear path

### 6. Pipeline semantics completion ❌

Complete the unfinished flow semantics from in-progress.md: true parallel scheduling for `parallelFork`/`executionOrder: "parallel"`, real loop re-execution, **server-side webhook triggers** (bind `webhookTrigger` listeners / cron via a real scheduler), persistent human-approval resume at the exact paused node, and sub-pipeline execution.

**Priority:** High. **Evidence:** `docs/features/pipelines.md`; VERIFICATION-REPORT §4.

### 7. MCP + connector ecosystem breadth ❌

Implement the 10 `flowmind.*` tool stubs (see in-progress.md), per-SaaS connectors (OAuth-consumed), more pipeline integration nodes, caching of discovered MCP tools, org-scoped shared MCP servers, and an `mcpCall` pipeline node. Path to n8n-scale (see future.md).

**Priority:** High. **Evidence:** VERIFICATION-REPORT §9, §10.

### 8. CI/CD ❌

No CI/CD exists. Implement the pipeline from `docs/deployment/aws.md` §12: lint + typecheck gate → build images → push ECR → deploy ECS → db migrate → health-check gate. Move e2e into CI.

**Priority:** High. **Evidence:** `docs/deployment/aws.md` §12.

### 9. Validated container images 🚧→❌

Image builds are unverified (no working Docker host). Must confirm images build and pass `/health` before AWS work is possible.

**Priority:** High (blocker to #1). See [in-progress.md](./in-progress.md#docker-image-validation).

### 10. Monitoring / alerting ❌

No production observability. Required: CloudWatch Logs per service, Sentry (`SENTRY_DSN` + traces), Prometheus or CloudWatch scraping of `/metrics`, heap/CPU/memory alarms, uptime (Synthetics or external probe), Stripe webhook failure alarms. See `docs/deployment/aws.md` §9.

**Priority:** Med. **Evidence:** `docs/deployment/aws.md` §9.

### 11. Backups verified ❌

Backup strategy is specified but unverified. Required: RDS automated backups + snapshots (verify restore), ElastiCache snapshots + failover, Qdrant EBS/snapshot automation, S3 versioning, and a quarterly restore test. See `docs/deployment/aws.md` §10.

**Priority:** Med. **Evidence:** `docs/deployment/aws.md` §10.

### 12. Load / performance testing ❌

No formal load test has been run. Required: define target concurrency/RPS; validate tier limits under load; measure pipeline throughput, inference latency (cloud provider), MCP tool latency, and SSE fan-out; then size RDS/ElastiCache/Qdrant accordingly.

**Priority:** Med. **Evidence:** VERIFICATION-REPORT §12 (no load test).

---

## P2 — Significant but deferrable

### 13. Vector RAG robustness at scale ❌

Move beyond local Qdrant: durable storage (EFS/EBS), snapshot/backup, multi-tenant collection isolation, and validation at meaningful collection sizes. Chunking/embedding tuning and re-ranking are future.md items.

**Priority:** Med. See also [in-progress.md](./in-progress.md#qdrant--vector-rag-robustness).

### 14. Desktop packaging completion 🚧→❌

Finish the packaged lifecycle (starts API/runtime from bundled resources, electron-builder fix, NSIS installer, auto-update). Deferrable while the web product is the primary surface.

**Priority:** Low. See [in-progress.md](./in-progress.md#desktop-packaged-mode).

### 15. Multi-replica / durability hardening ❌

The API is stateless and designed to scale horizontally (state in Postgres/Redis/Qdrant), but multi-replica has not been exercised. Required: validate horizontal API/web scaling, shared Redis/Qdrant, run-recovery under concurrent instances, and connection capacity. See `docs/deployment/aws.md` §11.

**Priority:** Low (after cloud/inference concerns).

### 16. Desktop CLI maturity ❌

The CLI exists but is minimal. Completing it is P2 without a specific consumer.

**Priority:** Low.

---

## Cross-cutting rules

- **No dev fallbacks in prod**: every `Secret: Y` variable must come from Secrets Manager; `ENABLE_DEV_BILLING_MOCK`, `ALLOW_UNVERIFIED_WEBHOOKS`, and `ALLOW_PRIVATE_NETWORK_HTTP` must be unset/false in production (`docs/deployment/aws.md` §14).
- Finish **in-progress** items before their governing **remaining** items where they block (e.g. Docker images before AWS; pipeline semantics before claiming n8n parity).
