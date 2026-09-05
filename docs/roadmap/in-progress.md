# In Progress — Partially Implemented

Items here have **real code** but are not complete or not end-to-end. For each: current state and what remains. These are distinguished from [remaining.md](./remaining.md) (not started) and [completed.md](./completed.md) (verified working).

---

## Cloud LLM & chat live integration

Status: 🚧

**Current state:** 16 cloud LLM providers are wired in `packages/llm-router/src/engine.ts` (OpenAI, Anthropic, Google, Groq, DeepSeek, OpenRouter, Together, Mistral, Perplexity, DeepInfra, Cerebras, xAI, Cohere, Cloudflare, Venice AI, Alibaba, Azure). Local Ollama inference is verified; provider-key persistence in the UI works. Provider keys are encrypted at rest (AES-256-GCM).

**What remains:**
- Live inference against at least one real cloud provider (no keys available locally — externally blocked).
- Verify the full agent loop (tool use + streaming) against a cloud provider, not just local Ollama.
- `initProviders` has two **dead config keys**: `githubCopilotKey` and `awsBedrockKey` are declared in `LLMConfig` but never consumed in `initProviders`. Wire or remove them.

**Evidence:** VERIFICATION-REPORT §6, §11; `packages/llm-router/src/engine.ts`.

## Pipeline flow semantics (parallel / loop / webhook / subPipeline)

Status: 🚧

**Current state:** Sequential topological execution, retries, cancel, delete, streaming, batch, recovery are all real and verified. But several runtime semantics are incomplete:

- `executionOrder: "parallel"` is accepted in settings but **ignored** — execution is strictly sequential.
- `parallelFork` only **emits branch descriptors** (`branches: [{ branchIndex, item, status: "pending" }]`); branches do not run concurrently.
- `loop` sets `$loop.index/item/total` variables but does **not** re-run downstream nodes per iteration.
- `webhookTrigger` is **client-side only** — returns the configured path but binds no listener.
- `humanApproval` returns `awaiting_approval`; the callback in `executeRunBackground` is a stub that immediately returns `{ approved: false }`, and `resume` re-runs the whole graph rather than resuming at the paused node.
- `subPipeline` requires `context.subPipelineRunner`, which the API never provides — the node errors with "not available".

**What remains:**
- Honest parallel scheduling for `parallelFork` and `executionOrder: "parallel"` (true concurrency).
- True loop re-execution of downstream subgraphs per iteration.
- A real webhook listener binding `webhookTrigger` paths (see also server-side triggers in remaining.md).
- Persistent human-approval resume at the exact paused node.
- Sub-pipeline execution via an injected runner.

**Evidence:** VERIFICATION-REPORT §4 ("present but not live-tested"); `docs/features/pipelines.md` Current Status/Future.

## `flowmind.*` MCP tool stubs

Status: 🚧 (stubs; implement)

**Current state:** 10 `flowmind.*` built-in MCP tools are **stubs** — declared but not genuinely implemented:

| Tool | Status |
|------|--------|
| `flowmind.git.pr` | 🚧 stub |
| `flowmind.db.query` | 🚧 stub |
| `flowmind.slack.message` | 🚧 stub |
| `flowmind.github.issue` | 🚧 stub |
| `flowmind.notion.page` | 🚧 stub |
| `flowmind.memory.search` | 🚧 stub |
| `flowmind.skill.run` | 🚧 stub |
| `flowmind.pipeline.trigger` | 🚧 stub |
| `flowmind.image.generate` | 🚧 stub |
| `flowmind.audio.transcribe` | 🚧 stub |

**What remains:** implement each tool over a real backend (e.g. `memory.search` over the Qdrant context engine, `pipeline.trigger` over the real pipeline engine). These are the counterpart to `imageGenerate` / `audio.transcribe` which are simulated (see below).

**Evidence:** VERIFICATION-REPORT §9 (Known Limitations — "still stubs").

## Outbound connector simulation

Status: 🚧

- `imageGenerate` pipeline node is **simulated** — returns a placeholder, Stable Diffusion not wired.
- `webhook` outbound node is fire-and-forget POST with no signature support.

**What remains:** real image generation; webhook signature/signing for outbound calls.

**Evidence:** `docs/features/connectors.md`.

## Channel gateway & WhatsApp

Status: 🚧 (gateway adapters exist but not wired into app prod; WhatsApp end-to-end non-functional)

**Current state (from `docs/whatsapp/overview.md`):**
- **Channel-gateway adapters are real code but NOT instantiated in application production code.** `setupWebhook` is real only for telegram/openhuman; slack/discord/whatsapp/email are stubs.
- WhatsApp is a **stub-to-real hybrid, end-to-end NON-FUNCTIONAL**:
  - Outbound `WhatsAppAdapter.sendMessage` makes a genuine Graph API call but is never instantiated in app prod (tests only).
  - Inbound webhook forward → `AGENT_RUNTIME_URL/webhook/ingest`, a route that **does not exist** → 502 every time.
  - No Meta verify GET handshake.
  - Normalizer is Baileys-shaped with no producer; the Graph envelope shape differs.
  - No WhatsApp message templates or persistence.

**What remains:**
- Instantiate and register channel adapters in application production code.
- Bind real webhook listeners for telegram/openhuman (real) and slack/discord/whatsapp/email (stubs).
- Implement the agent-runtime `/webhook/ingest` route (see below) and wire it.
- Full WhatsApp: Meta verify handshake, Graph-shaped normalizer, adapter instantiation, message persistence, end-to-end test.

**Evidence:** `docs/whatsapp/*`, `docs/features/connectors.md`, VERIFICATION-REPORT §9.

## Agent-runtime `/webhook/ingest` route

Status: 🚧 (missing route, breaks inbound channels)

**Current state:** The Python agent runtime has no `/webhook/ingest` route. The API `webhooks.*` procedures forward inbound payloads there with a 5s timeout and surface `BAD_GATEWAY` on failure. The route is the dead-end for every inbound channel.

**What remains:** implement `/webhook/ingest` in `packages/agent-runtime` and validate the full inbound path (webhook → runtime → agent reply).

**Evidence:** VERIFICATION-REPORT §9; `docs/whatsapp/overview.md`; `docs/features/connectors.md`.

## Desktop-packaged mode

Status: 🚧

**Current state:** The desktop app does not start the API or runtime in packaged mode — dev launcher only; hardcoded paths; excluded from the default turbo build. Electron can't run compiled output.

**What remains:** packaged lifecycle that starts the API (+ runtime) from bundled resources; fix electron-builder config; NSIS installer with prerequisites; auto-update channel. (REBUILD-PLAN Phase 3.)

**Evidence:** VERIFICATION-REPORT §9 (Desktop limitation); REBUILD-PLAN §1 architecture debt.

## Docker image validation

Status: 🚧

**Current state:** Dockerfiles exist and target the compiled outputs (`api` tsup bundle, `web-runner` Next standalone), but **images are unvalidated** — the dev box has no Docker/Hyper-V, so builds fail locally (`HCS_E_HYPERV_NOT_INSTALLED`). Redis/Qdrant run as native binaries for the same reason.

**What remains:** confirm images build on a working Docker host, boot via compose, and pass `/health` with `database:true` and `agentRuntime:true` (the bridge into AWS, per REBUILD-PLAN migration step 1).

**Evidence:** VERIFICATION-REPORT §9, §2, §13; `docs/deployment/aws.md` §15 migration step 1.

## CI/CD

Status: ❌ (not started)

No `.github/workflows` exist. There is no lint/typecheck gate, no e2e job, no image build/push, no deployment automation. E2E is not in CI.

**What remains:** the full pipeline recommended in `docs/deployment/aws.md` §12 (lint + typecheck → build images → push ECR → deploy ECS → db migrate → health-check gate). Note: this item is ❌ (not started) and lives in [remaining.md](./remaining.md) too.

**Evidence:** `docs/deployment/aws.md` §12 ("not implemented").

## Billing (Stripe)

Status: 🚧

**Current state:** The Stripe service is fully implemented (checkout, webhooks, portal, team seats, invoices, usage) but gated off — the router throws "Billing is not configured" unless `STRIPE_SECRET_KEY` is set or `ENABLE_DEV_BILLING_MOCK === "true"` (non-prod). No keys or mock are configured, so billing is inactive. Guard errors honestly on unconfigured checkout (verified).

**What remains:** enable real Stripe keys and verify the full checkout → webhook → subscription loop; or exercise the dev mock deliberately. Then real checkout testing (externally blocked without keys).

**Evidence:** VERIFICATION-REPORT §3 (honest error), §11; `docs/features/billing.md`.

## Marketplace

Status: 🚧

**Current state:** Publish/install/fork/clone/versioning/rating are real for skills and generic `MarketplaceListing`. Two **parallel, non-unified** marketplaces exist (generic `marketplace.*` and legacy pipeline `MarketplaceFlow`). Non-skill listing types store `manifest`/`payloadRef` but not an executable payload (only skills have a real run path). No moderation/verification workflow exists (`isVerified`/`isFeatured` fields not administered).

**What remains:** unify the catalogs; add executable payload interop and per-type install semantics; implement review-moderation and verified-badge workflows.

**Evidence:** `docs/features/marketplace.md`.

## LSP

Status: 🚧

**Current state:** LSP diagnostics honestly report "not supported in this deployment" via the API (fixed in `2c7b314`); the `lsp` package and `toolsV2.lsp*` procedures exist as surfaces.

**What remains:** wire a real analyzer / Language Server for diagnostics, go-to-definition, hover, and find-references.

**Evidence:** VERIFICATION-REPORT §8 finding 18; `docs/features/skills.md`; `docs/architecture/api.md`.

## Qdrant / vector RAG robustness

Status: 🚧

**Current state:** Real Qdrant-backed retrieval works in both engines (see completed.md). But persistence and multi-replica state are roadmap items.

**What remains:** durable Qdrant storage strategy (EFS/EBS), snapshot/backup automation, and validation of RAG behavior at meaningful collection sizes. See remaining.md for load/perf testing.

**Evidence:** VERIFICATION-REPORT §9, §10 (infrastructure gaps).
