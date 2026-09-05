# Gap Analysis

The requirement chain for the major areas of FlowMind. Each area traces:

```
Vision → Requirement → Current Implementation → Missing Work → Priority
```

Status markers: ✅ Complete / 🚧 In Progress / ❌ Missing / 🔮 Future. Chains are grounded in `docs/VERIFICATION-REPORT.md`, `docs/REBUILD-PLAN.md`, `docs/deployment/aws.md`, the feature/architecture docs, and verified code. Full evidence and status detail live in [completed.md](./completed.md), [in-progress.md](./in-progress.md), and [remaining.md](./remaining.md).

---

## 1. Public deployment on AWS

- **Vision:** An n8n-class AI workflow platform users can reach over the public internet (product/vision.md near-term + long-term).
- **Requirement:** A production-quality deployment: built images, TLS-terminated public URL, managed Postgres/Redis/Qdrant, secrets management, reverse proxy, health checks.
- **Current implementation 🚧:** Build artifacts verified (tsup API bundle boots; Next standalone builds), Dockerfiles aligned to those targets. But every service runs only on localhost; dev mode (`tsx`/`next dev`); native Redis/Qdrant binaries; no reverse proxy/TLS; Docker images unbuilt/unvalidated (no Hyper-V on dev box).
- **Missing work ❌:** AWS provisioning (ECS Fargate web/api/runtime, RDS, ElastiCache, Qdrant on EFS, S3, ALB + ACM + Route 53), Secrets Manager, migration task, deployment, smoke test. Blocked by unvalidated images.
- **Priority:** **High** (P0 #1). Evidence: `docs/deployment/aws.md` (honesty note), VERIFICATION-REPORT §2, §9, §10.

## 2. Real Stripe billing checkout

- **Vision:** Tiered, monetizable workspaces with real payments.
- **Requirement:** A live, verified Stripe loop: checkout → webhook → subscription sync; portal; team seats; invoices; payment-failure notifications.
- **Current implementation 🚧:** Full service logic written and gated — router throws "not configured" unless keys/dev-mock present; no keys set; guard errors honestly. Tier config + usage row-counts exist.
- **Missing work ❌:** Real `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`STRIPE_PRICE_<TIER>`; live checkout/webhook/portal/seat verification; replace row-count usage with metered aggregation (future).
- **Priority:** **High** (P0 #2). Evidence: `docs/features/billing.md`, VERIFICATION-REPORT §3, §11.

## 3. Live cloud LLM inference

- **Vision:** Real AI inference across many models, not just a local binary.
- **Requirement:** At least one real cloud provider producing verified inference through the full agent loop (tools, streaming).
- **Current implementation 🚧:** 16 provider wirings in `llm-router`; live inference verified **only** on local Ollama; UI key persistence works; keys encrypted at rest. Two dead config keys (`githubCopilotKey`, `awsBedrockKey`) never consumed.
- **Missing work ❌:** Real provider keys; end-to-end cloud inference verification; dead-key cleanup; cloud-vs-GPU-Ollama decision for AWS.
- **Priority:** **High** (P0 #3). Evidence: VERIFICATION-REPORT §6, §11; `packages/llm-router/src/engine.ts`.

## 4. Real OAuth / SSO

- **Vision:** Enterprise-ready sign-in (SSO, SAML, MFA) per product/vision long-term.
- **Requirement:** Verified real OAuth (Google/GitHub) with secure refresh rotation; SAML + MFA truly wired.
- **Current implementation 🚧:** OAuth state + flow real (Redis-backed), login rate limiting, JWT/refresh. Not exercised with real provider credentials; single 7d refresh token (no rotation/blacklist); permissive email identity-linking; SAML/MFA are declared surfaces only.
- **Missing work ❌:** Real OAuth credential testing; refresh rotation + blacklist; SAML + TOTP/webauthn implementation.
- **Priority:** **High** (P0 #4). Evidence: `docs/features/authentication.md`, VERIFICATION-REPORT §11.

## 5. Channel integrations incl. WhatsApp end-to-end

- **Vision:** External users reach FlowMind through Telegram/Slack/Discord/WhatsApp and get replies back (docs/whatsapp/overview.md).
- **Requirement:** A reachable inbound path (webhook → runtime → agent) and a working outbound reply for each channel, end-to-end, via real adapters.
- **Current implementation 🚧:** Agent-runtime `/webhook/ingest` route **does not exist** → inbound is a 502 dead-end. Channel-gateway adapters are real code but not instantiated in app prod (`setupWebhook` real only for telegram/openhuman). WhatsApp: real outbound adapter but unwired; no Meta verify handshake; Baileys-shaped normalizer with no producer; no persistence.
- **Missing work ❌:** Implement `/webhook/ingest`; wire adapters into app prod; real listeners for slack/discord/whatsapp/email; full WhatsApp fix (verify handshake, Graph normalizer, adapter wiring, message store, templates, e2e test).
- **Priority:** **High** (P0 #5). Evidence: `docs/whatsapp/overview.md`, `docs/features/connectors.md`.

## 6. MCP + connector ecosystem breadth

- **Vision:** n8n-scale integrations; "every node can call an LLM"; rich external tool ecosystem.
- **Requirement:** A broad, real connector surface: many working SaaS integrations plus the MCP client bridging external tool servers.
- **Current implementation 🚧:** Real MCP client (stdio/SSE/streamable-http, security-guarded, tenant-persisted) + generic connectors (`http_request`, `sqliteQuery`, `transform`, `fileIo`, `email.send`). But 10 `flowmind.*` tools are stubs; `imageGenerate` simulated; per-SaaS/OAuth connectors and `mcpCall` pipeline node not built; no per-server tool cache.
- **Missing work ❌:** Implement the 10 stubs and a few flagship SaaS connectors; add OAuth-consumed connectors; `mcpCall` node; MCP tool caching; org-scoped shared servers → then scale the catalog (future).
- **Priority:** **High** (P1 #7). Evidence: VERIFICATION-REPORT §9, §10, §14; `docs/features/mcp-integration.md`.

## 7. Pipeline executor semantics (parallel / loop / server triggers)

- **Vision:** Visually build real, running automations — including concurrent branches, loops, and event-driven (webhook/cron) triggers.
- **Requirement:** The engine must actually execute the semantics its UI advertises.
- **Current implementation 🚧:** Sequential topo execution, retries, cancel, delete, streaming, batch, recovery all real. But `executionOrder: "parallel"` ignored; `parallelFork` only emits branch descriptors; `loop` sets vars but doesn't re-run downstream; `webhookTrigger` client-side only; human-approval resume re-runs whole graph; subPipeline unavailable.
- **Missing work ❌:** True parallel scheduling; loop subgraph re-execution; server-side webhook/cron listeners; resume-at-paused-node; sub-pipeline runner injection.
- **Priority:** **High** (P1 #6). Evidence: `docs/features/pipelines.md`, VERIFICATION-REPORT §4.

## 8. Vector RAG robustness

- **Vision:** Knowledge base with RAG search over uploaded documents (product/vision near-term).
- **Requirement:** Reliable insertion/search at scale with durable storage, tenant isolation, and verified retrieval quality.
- **Current implementation ✅/🚧:** Both engines back into real Qdrant; real scores verified (0.633–0.743); UUID ids; fallback explicit. But persistence/multi-replica/backups are unbuilt and scale/robustness untested beyond local.
- **Missing work 🚧→❌:** Durable Qdrant storage (EFS/EBS), snapshot/backup automation, multi-collection isolation, load testing at meaningful size → then RAG polish (chunking, re-ranking) is future.
- **Priority:** **Med** (P1 #13 + 🔮). Evidence: VERIFICATION-REPORT §9, §10, §13.

## 9. Marketplace economy

- **Vision:** Publish, discover, share, and monetize reusable skills/agents/integrations (product/vision).
- **Requirement:** A unified catalog with executable payloads for all item types and moderation/monetization.
- **Current implementation 🚧:** Real publish/install/fork/clone/version/rating for skills + generic listings. Two parallel non-unified catalogs; non-skill types lack executable payloads; no moderation/verified workflow.
- **Missing work ❌:** Unify catalogs; executable payload interop; per-type install; review/moderation; paid listings/payouts (future).
- **Priority:** **Med** (P2 → 🔮). Evidence: `docs/features/marketplace.md`.

## 10. Monitoring / observability

- **Vision:** A production service operators can trust (deployment.md §9).
- **Requirement:** Logs, metrics, error tracking, and alerting for API/web/runtime/data tier.
- **Current implementation 🚧:** `/metrics` endpoint works, Bearer-gated (verified 401/200); tier rate limits work. Not scraped by anything in prod; no CloudWatch/Sentry/alerting or uptime checks.
- **Missing work ❌:** CloudWatch Logs per service, Sentry wiring, Prometheus/CloudWatch metric scraping, CPU/memory/storage/heap alarms, uptime probes, Stripe-webhook-failure alerts.
- **Priority:** **Med** (P1 #10). Evidence: VERIFICATION-REPORT §3, §8; `docs/deployment/aws.md` §9.

## 11. Desktop packaging

- **Vision:** A distributable desktop app (REBUILD-PLAN Phase 3; product distribution).
- **Requirement:** Packaged app starts the API (+ runtime) from bundled resources and works standalone.
- **Current implementation 🚧:** Dev launcher only; hardcoded paths; electron-builder not configured; excluded from default turbo build; cannot run compiled output.
- **Missing work ❌:** Packaged lifecycle (start bundled API/runtime), electron-builder config, NSIS installer + prerequisites, auto-update channel.
- **Priority:** **Low** (P2 #14). Evidence: VERIFICATION-REPORT §9; REBUILD-PLAN Phase 3.

## 12. Multi-replica / durability

- **Vision:** Scale the API/web horizontally and survive instance loss (deployment.md §11).
- **Requirement:** Multiple stateless replicas sharing durable Postgres/Redis/Qdrant with correct run-recovery.
- **Current implementation 🚧:** API is stateless by design (state in Postgres/Redis/Qdrant); async pipeline + run-recovery exist and are tested on a single instance. Multi-replica has not been exercised; no connection-capacity plan.
- **Missing work ❌:** Validate horizontal scaling under load; shared Redis/Qdrant in prod; run-recovery under concurrent instances; DB/Redis/Qdrant sizing.
- **Priority:** **Low** (P2 #15). Evidence: VERIFICATION-REPORT §10, §13; `docs/deployment/aws.md` §11.

---

## Summary by priority

| Priority | Areas |
|----------|-------|
| High (P0) | AWS deployment, Stripe checkout, live cloud LLM, real OAuth/SSO, channels/WhatsApp |
| High (P1) | Pipeline semantics, connector breadth, CI/CD, valid images, monitoring, backups, load testing |
| Med (P1/P2) | Vector RAG robustness, marketplace economy, monitoring/observability |
| Low (P2) | Desktop packaging, multi-replica, CLI maturity |
| 🔮 Future | Connector scale, marketplace monetization, RAG polish, mobile, multi-region, enterprise, performance at scale |

**Guiding rule:** finish the High/P0 blockers before claiming production readiness. No item above a stub should be marked ✅ until it passes the honesty test against `docs/VERIFICATION-REPORT.md`.
