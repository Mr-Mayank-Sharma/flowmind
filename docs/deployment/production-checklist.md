# Production Readiness Checklist

Use this checklist when moving FlowMind from the local dev box to a real, public deployment. Each section has a concrete go-live gate. Work top to bottom — security and data first, integrations and polish last.

Grade today: **local production-verifiable, not yet public-internet production-ready.**

---

## 1. Security

- [ ] **Replace every placeholder secret.** No real secret may be `change-me-in-production`, `flowmind` (as a password), or an empty string. See [environment.md](./environment.md) for the complete list.
- [ ] Generate strong secrets (openssl `rand -base64 48` for each):
  - `JWT_SECRET` (≥ 32 chars; production throws with no fallback)
  - `ENCRYPTION_KEY` (32-byte AES-256-GCM key; changing it later invalidates stored provider credentials)
  - `AGENT_API_KEY` / `INTERNAL_API_KEY`
  - `DATABASE_URL` password
  - Redis password (if using auth)
  - Stripe + webhook secrets, SMTP, channel, and OAuth secrets
- [ ] **Never bake secrets into images.** Inject at runtime via environment, secret manager, or k8s Secret — not a build ARG.
- [ ] Keep `ALLOW_UNVERIFIED_WEBHOOKS=false` (or unset) in production.
- [ ] Keep `ALLOW_PRIVATE_NETWORK_HTTP=false` — the `httpRequest` pipeline node blocks SSRF when false.
- [ ] Keep `PIPELINE_DB_ALLOW_WRITE=false` so pipelines cannot write to the app DB.
- [ ] Never set `ENABLE_DEV_BILLING_MOCK` in production.
- [ ] Add a reverse proxy / WAF in front: TLS termination, request-size limits (~50m already in the k8s ingress annotation), and headered auth if needed.
- [ ] Restrict database and cache ports to the private network only (no public `5432` / `6379` / `6333` exposure).
- [ ] Verify `/metrics` is gated: the API denies it in production without `AGENT_API_KEY`/`INTERNAL_API_KEY` configured.

## 2. Data, migrations, backups, durability

- [ ] Run `pnpm db:migrate` against the real database before first deploy, and make migrations part of the deployment pipeline (never run them ad hoc against prod on a Friday).
- [ ] Confirm `flowmind_contexts` (Qdrant collection) and Postgres data live on **durable** storage:
  - k8s: replace `emptyDir` with PersistentVolumeClaims — `postgres.yaml` and `qdrant.yaml` currently use `emptyDir` and will lose all data on pod restart.
  - compose: use named volumes (already present) and avoid `docker compose down -v`.
- [ ] Configure automated backups **before** enabling a public workload:
  - Postgres: `pg_dump -F c` (see [backup.sh](../../scripts/backup.sh)) or managed RDS automated snapshots + PITR.
  - Redis: RDB snapshots (backup.sh already does `SAVE` + copy).
  - Qdrant: snapshot API (backup.sh) or EBS snapshots of the volume.
  - The backup script assumes Docker containers; on native binaries or managed services adapt accordingly.
- [ ] Test a restore at least once (restore dump into a scratch database, start Qdrant from snapshot).
- [ ] Set up off-site copies (S3 versioning, RDS cross-region or at least a second bucket) with a retention policy.

## 3. Infrastructure

- [ ] **Validate images end-to-end.** The `Dockerfile` targets `api` and `web-runner` have never been built; `deploy/docker-compose.yml` images have never been built. Build them locally and boot the stack before anything else.
- [ ] Resolve the **port mismatch**: `infra/compose/production.yml`'s `agent` service publishes `8000:8000`, but `packages/agent-runtime/Dockerfile` runs uvicorn on `8001`. Align the port and `AGENT_RUNTIME_URL`.
- [ ] Replace placeholder `infra/k8s/secrets.yaml` values with real secrets (or move to external secret management).
- [ ] Configure health probes everywhere:
  - API: `/health` liveness + readiness (k8s `api.yaml` already has them; compose healthchecks exist only in `deploy/docker-compose.yml`).
  - Web: readiness on `/`.
  - Runtime: `/health`.
- [ ] Set resource limits (k8s `api.yaml` uses `256–512Mi` / `250–500m`; web `128–256Mi` / `100–250m`). Right-size for real traffic.
- [ ] Choose the deployment path — see [overview.md](./overview.md) decision guide. For anything beyond a single box, prefer the managed cloud path in [aws.md](./aws.md).
- [ ] If using the k8s ingress, replace the `flowmind.local` host with the real domain and terminate TLS (cert-manager or the ingress controller).

## 4. External integrations

### Billing (Stripe)

- [ ] Set live `STRIPE_SECRET_KEY` (`sk_live_...`) and `STRIPE_WEBHOOK_SECRET` (`whsec_...`).
- [ ] Register the webhook endpoint in the Stripe dashboard pointing at your production URL and subscribe to the events the billing code expects.
- [ ] Set price ids (`STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_YEARLY` — and any of `STRIPE_PRICE_FREE/PRO/TEAM/ENTERPRISE` your account uses) to live price ids.
- [ ] Verify the dev billing mock is off (`ENABLE_DEV_BILLING_MOCK` unset/never in prod).

### LLM providers

- [ ] Configure at least one real cloud key (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`, etc.) **or** a reachable local Ollama.
- [ ] If using local Ollama in production, pin a model set, monitor GPU/CPU, and have the trade-off documented — see [aws.md](./aws.md) cost/scale note.
- [ ] Never commit provider keys; inject via secret manager.

### OAuth / SSO

- [ ] Register production OAuth apps (GitHub, Google, Notion) with the **production** callback URLs.
- [ ] Set `CLIENT_ID` / `CLIENT_SECRET` pairs (`GITHUB_*`, `GOOGLE_*`, `NOTION_CLIENT_*`).
- [ ] Verify `APP_URL` / `API_URL` match what the OAuth provider dashboards expect.

### Channels (Telegram / Slack / Discord / WhatsApp)

- [ ] Set channel tokens and webhook secrets (`TELEGRAM_BOT_TOKEN`, `SLACK_CLIENT_*`, `DISCORD_BOT_TOKEN`, `WHATSAPP_*`).
- [ ] **WhatsApp requires the runtime-webhook fix first.** The Meta GET verification handshake is missing and `/webhook/ingest` does not exist on the Python agent runtime, so inbound webhooks currently dead-end with a 502. Follow the prioritized fix path in [../whatsapp/integration.md](../whatsapp/integration.md) before enabling WhatsApp in production.
- [ ] Register webhook URLs in each provider dashboard pointing at the production ingress.
- [ ] Confirm webhook secrets are verified inbound (`ALLOW_UNVERIFIED_WEBHOOKS=false`).

### Email (SMTP)

- [ ] Configure `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` and send a test message.

## 5. Monitoring

- [ ] Configure `SENTRY_DSN` (API + web) and verify a test error surfaces in Sentry.
- [ ] Confirm `/metrics` is exposed and protected (requires `AGENT_API_KEY` / `INTERNAL_API_KEY` in production).
- [ ] Ship logs: `LOG_LEVEL=info` at minimum; forward to CloudWatch / Loki / your logging backend.
- [ ] Set up uptime checks on the public health endpoint (`/health`).
- [ ] Add alerts for: API 5xx rate, database connections, Redis memory, Qdrant disk, agent-runtime reachability, Stripe webhook failures.

## 6. Final smoke test

Run this list against the deployed environment:

- [ ] `GET /health` returns `200` with `database:true` and `agentRuntime:true` from the deployed API.
- [ ] Load the web app over HTTPS; page loads without mixed-content warnings.
- [ ] Register / log in (SSO flow if configured) and confirm `JWT_SECRET` signing works.
- [ ] Create an org/workspace, run a pipeline end-to-end.
- [ ] Trigger the LLM path (cloud key or local Ollama) and confirm a model responds.
- [ ] Perform a vector search against `flowmind_contexts` and confirm results come back.
- [ ] Run billing: hit a paid plan change and confirm Stripe creates the checkout / subscription; complete a test webhook delivery.
- [ ] Send a channel message (Telegram at minimum; WhatsApp only after the runtime-webhook fix).
- [ ] Confirm metrics endpoint returns data when authenticated.
- [ ] Trigger a backup and confirm artifacts land in the backup target; restore once into a scratch environment.

---

## Still-open items tracked elsewhere

- WhatsApp inbound blockers: [docs/whatsapp/integration.md](../whatsapp/integration.md)
- Deployment grade / philosophy: [overview.md](./overview.md) — local production-verifiable, not yet public-internet production-ready.
- Cross-cutting infra defects (port mismatch, placeholder secrets, emptyDir): [infrastructure.md](./infrastructure.md).