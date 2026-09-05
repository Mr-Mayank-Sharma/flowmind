# Future — Long-Term Ideas Grounded in Product Vision

These are ideas from `docs/product/vision.md` and the platform's trajectory that are **not yet scoped work** (no committed requirements). They are ordered by proximity to the current roadmap. Marker: 🔮

---

## n8n-scale connector ecosystem 🔮

The current connector surface is real but thin (MCP client, HTTP, SQLite, transform, file, email). The product vision names n8n-class parity:

- Conditional-branching UI, parallel execution, pipeline versioning/rollback, custom node SDK.
- A large, OAuth-consumed SaaS connector catalog (Slack, GitHub, Notion, Gmail/Google, Stripe, Salesforce, etc.), each backed by real, tested integrations rather than stubs.
- Webhook and scheduled-trigger ecosystem per connector.

**Why it matters:** connector breadth is the primary differentiator of an n8n-class platform. See [vision.md](../product/vision.md) "n8n feature parity".

**Now vs later:** implement the 10 `flowmind.*` stubs + a handful of flagship SaaS connectors first (P1); scale the catalog after the ecosystem/marketplace matures.

## Marketplace economy maturity 🔮

The marketplace currently supports publish/fork/clone/rating for skills and generic listings, with a legacy pipeline marketplace sitting parallel. Maturity path:

- Unify the parallel catalogs into one.
- Executable payload interop for all item types (not just skills).
- Moderation, verified badges, reviews workflow.
- Monetization: paid pipelines/agents, creator payouts, subscription-based reuse.

**Why it matters:** the vision frames FlowMind as a place to "share and monetize" AI automation. See [vision.md](../product/vision.md) and [marketplace.md](../features/marketplace.md).

## RAG / vector polish 🔮

Qdrant-backed retrieval works. Long-term polish:

- Chunking strategies, embedding model selection/tuning, hybrid (BM25 + vector) search, re-ranking.
- Multi-collection tenant isolation and per-tenant embedding spaces at scale.
- Knowledge ingestion pipelines and automatic index upkeep as document volumes grow.

**See also:** remaining.md #13 (vector RAG robustness at scale) — the durable-storage baseline that future RAG features build on.

## Mobile app 🔮

The vision lists a native mobile app: trigger pipelines, monitor runs, chat with agents from a phone. This is plausible (the platform has streaming SSE + bot/notifications surfaces), and a thin mobile client could reuse the existing tRPC API. It is **not** required for the near-term desktop/web product.

**Now vs later:** defer until the web product is publicly deployed and connector/chat surfaces are stable.

## Multi-region / high-availability 🔮

Beyond single-region AWS deployment (remaining.md P0):

- Multi-AZ / multi-region Postgres (RDS cross-region, Aurora), Redis cluster mode, Qdrant replication.
- Read replicas for heavy analytics; regional failover for API/web.
- Geographically distributed LLM fallback (provider × region).

**Depends on:** a validated single-region deployment and real traffic first.

## Enterprise features 🔮

- Deep SAML integration (Okta, Azure AD) — a declared-only surface today; see [gap-analysis.md](./gap-analysis.md#4-real-oauth--sso) and `docs/features/authentication.md`.
- Real SSO across all providers; TOTP/webauthn MFA.
- Audited billing (full invoice lineage, tax, receipts), SCIM provisioning.
- Audit logs for all mutations; compliance certifications (SOC 2, GDPR).
- On-premise distribution: Helm charts, Kubernetes operators, air-gapped installs.

**See:** [vision.md](../product/vision.md) "Enterprise features", [authentication.md](../features/authentication.md).

## Performance / scaling at customer scale 🔮

- Horizontal API/web scaling validated (multi-replica), run-recovery under concurrent instances.
- SSE fan-out at 10k+ concurrent streams; MCP tool-discovery caching; LLM provider routing/fallback under saturation.
- Cost-aware model routing and token/cost metering (see billing.md — replace row-count usage with metered aggregation).
- Load-tested tier limits and rate-limiting under real traffic patterns.

Depends on remaining.md #12 (load/perf testing) and #15 (multi-replica).

## External runtime ecosystem 🔮

The vision describes registering and dispatching to custom runtimes beyond the built-in agent. Long-term: user-hosted runtimes, custom node SDKs, and a plugin registry. See [vision.md](../product/vision.md) "External runtime ecosystem" and the `runtime-registry`/`plugin-engine` packages (real code, currently thin).

---

## Sequencing note

Future items are intentionally **not** commitments. The recommended order of the whole roadmap:

1. **P0 remaining:** AWS deployment, real Stripe, live cloud LLM, real OAuth, channel/WhatsApp end-to-end.
2. **P1 remaining:** pipeline semantics, connector breadth, CI/CD, valid images, monitoring, backups, load testing.
3. **Then** mature the marketplace, RAG polish, mobile, enterprise, and multi-region (P2 → 🔮).
