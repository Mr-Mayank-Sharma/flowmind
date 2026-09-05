# Environment Variables Reference

FlowMind is configured entirely through environment variables. This document is the authoritative reference for every variable, whether it is required, whether it must be treated as a secret, and what production expects.

> **Never commit real values.** This document describes variable names and semantics only. Secrets are referenced as `<your-strong-secret>` placeholders everywhere in this repo. Rotate any value that has ever been committed to git.

## Legend

| Column | Meaning |
|--------|---------|
| **Required** | `Y` = must be set in every environment (prod or not). `Prod` = required for production. `Opt` = optional / feature-gated. |
| **Secret** | `Y` = treat as a secret (rotatable, per-environment, never in git, never baked into an image). `N` = safe in a ConfigMap / compose file. |
| **Prod note** | Anything production-specific, including fallbacks that must be disabled. |

The **core required set** for any production deployment is:

- `DATABASE_URL` (PostgreSQL connection)
- `JWT_SECRET` (session signing — production **throws** if missing rather than falling back)
- `ENCRYPTION_KEY` (AES-256-GCM master key for `ProviderCredential`)
- `AGENT_API_KEY` / `INTERNAL_API_KEY` (shared secret between the API and the agent runtime)
- At least one LLM provider key, or a reachable local Ollama

Everything else is feature-gated off until you configure it.

---

## Infrastructure

### Database

| Variable | Required | Secret | Prod note |
|----------|:--------:|:------:|-----------|
| `DATABASE_URL` | Y | Y | `postgresql://user:pass@host:5432/db`. Example manifests bake `5432` (the standard internal Postgres port). Your live dev DB may be on `5433` — that is only a connection-string detail. Managed RDS uses `5432` internally. |

### Cache / rate-limit / SSO state

| Variable | Required | Secret | Prod note |
|----------|:--------:|:------:|-----------|
| `REDIS_URL` | Prod | N (contains creds if auth) | `redis://host:6379`. Redis-backed rate limiting and SSO state make this a real dependency in production; a managed service (e.g. ElastiCache) is recommended. |

### Vector database

| Variable | Required | Secret | Prod note |
|----------|:--------:|:------:|-----------|
| `QDRANT_URL` | Prod | N | `http://host:6333`. Hosts the `flowmind_contexts` collection and related vector data. Durable and multi-replica capable (Track 2). |

### Object storage (files / assets)

| Variable | Required | Secret | Prod note |
|----------|:--------:|:------:|-----------|
| `S3_ENDPOINT` | Opt | N | Point at MinIO (`http://localhost:9000`) or an S3-compatible endpoint. On AWS prefer IAM roles over static keys (see [aws.md](./aws.md)). |
| `S3_ACCESS_KEY` | Opt | Y | Access key for the endpoint. |
| `S3_SECRET_KEY` | Opt | Y | Secret key for the endpoint. On AWS prefer IAM roles and omit static keys. |
| `S3_BUCKET` / bucket name | Opt | N | Check the exact variable name used by the local fileIo implementation before relying on it. |

### LLM providers

At least one of the following, or a reachable local Ollama, is required for inference.

| Variable | Required | Secret | Prod note |
|----------|:--------:|:------:|-----------|
| `OPENAI_API_KEY` | Opt | Y | Cloud provider key. |
| `ANTHROPIC_API_KEY` | Opt | Y | Cloud provider key. |
| `GOOGLE_AI_API_KEY` | Opt | Y | Also referenced as `GOOGLE_API_KEY` (Google AI / Gemini). |
| `GROQ_API_KEY` | Opt | Y | Cloud provider key. |
| `DEEPSEEK_API_KEY` | Opt | Y | Cloud provider key. |
| `OPENROUTER_API_KEY` | Opt | Y | Aggregator key. |
| `TOGETHER_API_KEY` | Opt | Y | Cloud provider key. |
| `MISTRAL_API_KEY` | Opt | Y | Cloud provider key. |
| `PERPLEXITY_API_KEY` | Opt | Y | Cloud provider key. |
| `DEEPINFRA_API_KEY` | Opt | Y | Cloud provider key. |
| `CEREBRAS_API_KEY` | Opt | Y | Cloud provider key. |
| `XAI_API_KEY` | Opt | Y | Cloud provider key. |
| `COHERE_API_KEY` | Opt | Y | Cloud provider key. |
| `CLOUDFLARE_API_KEY` | Opt | Y | Cloud provider key. |
| `VENICE_AI_API_KEY` | Opt | Y | Cloud provider key. |
| `ALIBABA_API_KEY` | Opt | Y | Cloud provider key. |
| `AZURE_OPENAI_ENDPOINT` | Opt | Y | Azure OpenAI endpoint. |
| `AZURE_OPENAI_API_KEY` | Opt | Y | Azure OpenAI key. |
| `OLLAMA_URL` | Opt | N | `http://host:11434`. Local LLM endpoint. In the compose/runtime setups this defaults to `http://host.docker.internal:11434`. |

---

## Auth / application / security

| Variable | Required | Secret | Prod note |
|----------|:--------:|:------:|-----------|
| `JWT_SECRET` | Y | Y | Session-signing secret, min 32 chars. **Production throws on a missing value** — there is no fallback. Example manifests use `change-me-in-production`; replace with `<your-strong-secret>`. |
| `ENCRYPTION_KEY` | Y | Y | AES-256-GCM master key used to encrypt `ProviderCredential` values at rest. Must be a 32‑byte key. **Changing it invalidates stored provider credentials.** |
| `APP_URL` | Prod | N | Public origin of the web app, e.g. `https://flowmind.example.com`. Used for links, redirects, Stripe success URLs. |
| `API_URL` | Prod | N | Public origin of the API, e.g. `https://flowmind.example.com` (when served behind the same host as the web app) or an explicit API host. |
| `NODE_ENV` | Y | N | `production` in prod. Built images already set `NODE_ENV=production`. |
| `LOG_LEVEL` | Opt | N | `info` default; `debug` for diagnosis. |
| `RATE_LIMIT_MAX` | Opt | N | Max requests per `RATE_LIMIT_WINDOW`. `200` default in the app compose file. |
| `RATE_LIMIT_WINDOW` | Opt | N | e.g. `1 minute`. |
| `API_PORT` | Opt | N | API listen port (`3001`). Specified as `3001` in compose/k8s ConfigMap. |
| `API_HOST` | Opt | N | API bind host (`0.0.0.0`). Do not expose on the public interface without a proxy. |
| `AGENT_RUNTIME_URL` | Prod | N | Where the API forwards agent calls, e.g. `http://runtime:8001`. Defaults to `http://localhost:8001`. |
| `SENTRY_DSN` | Opt | Y | Sentry error tracking DSN (web build arg `NEXT_PUBLIC_SENTRY_DSN` and API `SENTRY_DSN`). |
| `SENTRY_TRACES_SAMPLE_RATE` | Opt | N | Traces sample rate, default `0.1`. |

---

## API ↔ runtime secret

| Variable | Required | Secret | Prod note |
|----------|:--------:|:------:|-----------|
| `AGENT_API_KEY` | Prod | Y | Shared bearer secret the agent runtime requires. The runtime `.env.example` marks it **required for secure deployments**. |
| `INTERNAL_API_KEY` | Opt | Y | Internal inter-service secret; also used to gate `/metrics` in production. If unset, `/metrics` is denied in production. |

---

## Billing (Stripe)

| Variable | Required | Secret | Prod note |
|----------|:--------:|:------:|-----------|
| `STRIPE_SECRET_KEY` | Prod | Y | Live secret key (`sk_live_...`). Production must use a real key — never the dev mock. |
| `STRIPE_WEBHOOK_SECRET` | Prod | Y | `whsec_...`. Register the webhook endpoint and copy the signing secret. |
| `STRIPE_PRICE_ID_MONTHLY` | Prod | Y | Live price id for monthly plan. |
| `STRIPE_PRICE_ID_YEARLY` | Prod | Y | Live price id for yearly plan. |
| `ENABLE_DEV_BILLING_MOCK` | Never in prod | N | Dev-only opt-in to a local billing mock when `STRIPE_SECRET_KEY` is unset. **Never set in production.** |

The app `.env.example` also lists `STRIPE_PRICE_FREE`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM`, `STRIPE_PRICE_ENTERPRISE`. Set whichever price-id scheme your Stripe account uses and keep it consistent across the billing config.

---

## SMTP

| Variable | Required | Secret | Prod note |
|----------|:--------:|:------:|-----------|
| `SMTP_HOST` | Opt | N | SMTP relay host for transactional email. |
| `SMTP_PORT` | Opt | N | Default `587`. |
| `SMTP_USER` | Opt | Y | SMTP username. |
| `SMTP_PASS` | Opt | Y | SMTP password / app password. |
| `SMTP_FROM` | Opt | N | Sender address, e.g. `noreply@flowmind.example.com`. |

---

## Multi-channel gateway

| Variable | Required | Secret | Prod note |
|----------|:--------:|:------:|-----------|
| `TELEGRAM_BOT_TOKEN` | Opt | Y | Telegram bot token. |
| `SLACK_CLIENT_ID` | Opt | Y | Slack app client id. |
| `SLACK_CLIENT_SECRET` | Opt | Y | Slack app client secret. |
| `DISCORD_BOT_TOKEN` | Opt | Y | Discord bot token. |
| `WHATSAPP_PHONE_NUMBER_ID` | Opt | Y | Meta WhatsApp business phone number id. |
| `WHATSAPP_ACCESS_TOKEN` | Opt | Y | Bearer token for Graph API calls (outbound + media). |
| `WHATSAPP_VERIFY_TOKEN` | Opt | Y | Expected token for the Meta GET verify handshake. |

### Webhook secrets (per channel)

| Variable | Required | Secret | Prod note |
|----------|:--------:|:------:|-----------|
| `WEBHOOK_SECRET` | Opt | Y | Fallback webhook secret verified on inbound webhook POSTs. |
| `TELEGRAM_WEBHOOK_SECRET` | Opt | Y | Telegram webhook secret. |
| `SLACK_WEBHOOK_SECRET` | Opt | Y | Slack webhook secret. |
| `DISCORD_WEBHOOK_SECRET` | Opt | Y | Discord webhook secret. |
| `WHATSAPP_WEBHOOK_SECRET` | Opt | Y | WhatsApp inbound webhook secret. |

> **Before enabling WhatsApp in production**, resolve the blockers documented in [../whatsapp/integration.md](../whatsapp/integration.md). The Meta GET verification handshake is missing and the runtime `/webhook/ingest` endpoint does not exist, so inbound webhooks currently dead-end with a 502. See the production checklist for the fix pointer.

---

## OAuth / SSO

| Variable | Required | Secret | Prod note |
|----------|:--------:|:------:|-----------|
| `GITHUB_CLIENT_ID` | Opt | Y | GitHub OAuth app client id. |
| `GITHUB_CLIENT_SECRET` | Opt | Y | GitHub OAuth app client secret. |
| `GOOGLE_CLIENT_ID` | Opt | Y | Google OAuth client id. |
| `GOOGLE_CLIENT_SECRET` | Opt | Y | Google OAuth client secret. |
| `NOTION_CLIENT_ID` | Opt | Y | Notion OAuth client id. |
| `NOTION_CLIENT_SECRET` | Opt | Y | Notion OAuth client secret. |

OAuth callbacks must reference the public `APP_URL` / `API_URL`; credentials must be registered in the provider dashboards with the production callback URLs before SSO will work.

---

## Security switches

| Variable | Required | Secret | Prod note |
|----------|:--------:|:------:|-----------|
| `PIPELINE_CODE_EXECUTE_ENABLED` | Opt | N | Enable the `codeExecute` pipeline node (isolated-vm sandbox). Enabled by default; set `false` to disable as an operational kill switch. |
| `ALLOW_PRIVATE_NETWORK_HTTP` | Opt | N | `httpRequest` blocks SSRF (private/loopback/link-local) by default. Keep `false` in production. |
| `PIPELINE_DB_ALLOW_WRITE` | Opt | N | Set `false` in production to deny the pipeline write access to the app database. |
| `ALLOW_UNVERIFIED_WEBHOOKS` | Never in prod | N | Dev-only bypass that accepts webhooks without a secret. **Set `false` (or unset) in production.** |
| `ENABLE_DEV_BILLING_MOCK` | Never in prod | N | See Billing. Never active in production. |

---

## Runtime (packages/agent-runtime)

The Python agent runtime reads its own variables (see `packages/agent-runtime/.env.example`):

| Variable | Required | Secret | Prod note |
|----------|:--------:|:------:|-----------|
| `AGENT_API_KEY` | Prod | Y | Must match the API's `AGENT_API_KEY`. Required for secure deployments. |
| `OLLAMA_HOST` | Opt | N | `http://localhost:11434`. Compose defaults to `http://host.docker.internal:11434`. |
| `FLOWMIND_API_URL` | Prod | N | API base the runtime calls back into, e.g. `http://api:3001`. |
| `CORS_ORIGINS` | Opt | N | Allowed origins (comma-separated). Compose defaults to `http://localhost:3000,http://localhost:4000`. In production set the real web origin. |
| `LOG_LEVEL` | Opt | N | Runtime log level, `info` default. |

The runtime may also carry cloud provider keys when it performs inference directly (e.g. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`). Key `AGENT_API_KEY` and any provider keys as secrets.

---

## Minimum viable production set

A minimal production deployment that boots the API, web, and runtime with health checks green needs at minimum:

```
NODE_ENV=production
DATABASE_URL=postgresql://<user>:<your-strong-secret>@<host>:5432/flowmind
JWT_SECRET=<your-strong-secret>
ENCRYPTION_KEY=<your-32-byte-key>
REDIS_URL=redis://<host>:6379
QDRANT_URL=http://<host>:6333
APP_URL=https://flowmind.example.com
API_URL=https://flowmind.example.com
AGENT_RUNTIME_URL=http://runtime:8001
AGENT_API_KEY=<your-strong-secret>
INTERNAL_API_KEY=<your-strong-secret>
LOG_LEVEL=info
# One LLM:
OLLAMA_URL=http://<host>:11434
# or at least one cloud key:
OPENAI_API_KEY=<your-strong-secret>
```

Security switches for production: `ALLOW_PRIVATE_NETWORK_HTTP=false`, `PIPELINE_DB_ALLOW_WRITE=false`, `ALLOW_UNVERIFIED_WEBHOOKS=false` (or unset), and never `ENABLE_DEV_BILLING_MOCK`.
