---
date: 2026-09-21
topic: "Production Readiness Program"
status: validated
---

# FlowMind Production Readiness Design

## Problem Statement

The master prompt (`p.txt`) requires transforming FlowMind from a localhost dev-mode application into a genuinely usable, production-ready product where every feature works end-to-end — no demo functionality, no fake connectors, no simulated pipelines, no dead buttons.

The repo already contains an honest, detailed audit (`docs/REBUILD-PLAN.md`, `docs/VERIFICATION-REPORT.md`, `docs/roadmap/*`). This design synthesizes that audit with fresh code verification and defines the work program to close every gap that is code-completable, while honestly documenting the externally-blocked items.

**Verified current state (spot-checked against code, 2026-09-21):**

- ✅ Real: auth/RBAC/tenant isolation, local Ollama chat, sequential pipeline execution with SSE streaming, real MCP stdio/HTTP/SSE client, real Qdrant RAG, real Redis state, 242 passing tests, security hardening.
- 🚧 Real but broken/incomplete: `streamAsync` double-stream bug in `llm-router`; dead config keys (`githubCopilotKey`, `awsBedrockKey`); regex-only agent tool protocol; `parallelFork`/`loop`/`webhookTrigger`/`humanApproval`/`subPipeline` semantics; naive interval "cron" in the trigger daemon; 10 `flowmind.*` MCP tool stubs (throw "not implemented"); agent-runtime missing `/webhook/ingest`; WhatsApp end-to-end dead (502); channel-gateway adapters not instantiated in prod; agent "deployment" is a status flip based on runtime health; two non-unified marketplaces; LSP reports "not supported".
- ❌ Externally blocked (can't be live-completed here): cloud LLM keys, Stripe keys, OAuth/SSO credentials, Meta/WhatsApp app credentials, Docker host, AWS account.

## Constraints

- **No real credentials** for cloud LLMs, Stripe, OAuth/SSO, WhatsApp/Meta, or SaaS APIs. Anything requiring live credentials gets code-completed and honestly gated, never faked.
- **No Docker/WSL2** on this box — container images cannot be validated locally.
- **No AWS account** — no public deployment.
- **Windows + PowerShell 5.1** environment; Postgres on `:5433`.
- **Zero TypeScript errors** required in `apps/api` and `apps/web` after every change (`tsc --noEmit`).
- All 242 existing tests must keep passing.
- Code must stay simple, modular, well-commented, and understandable to a junior developer (per `p.txt` §9–§10).

## Approach

**Three-tier strategy:**

1. **Code-complete** — every fake/broken/incomplete feature that needs only code gets fully implemented with tests.
2. **Credential-gated** — external integrations get correct code, honest gating, and documented activation steps; never a fake success.
3. **Documented** — everything externally blocked is recorded with exactly what's missing and how to finish it.

**Iterative loop:** audit → implement → test → re-audit → implement → end-user re-test, repeated until production-ready. The executor drives this loop; this design defines the target state for each workstream.

## Architecture (Target State)

### 1. LLM Router & Agent Loop (`packages/llm-router`)

**Fix `streamAsync`:** current generator invokes `provider.stream` twice (once no-op, once collecting) and yields from a second concurrent call. Replace with a single stream call whose `onChunk` pushes into an async queue that the generator drains.

**Remove dead config keys:** delete `githubCopilotKey` and `awsBedrockKey` from `LLMConfig` and `initProviders`.

**Native tool calling:** extend `runAgentLoop` to use provider-native tool calls (OpenAI-compatible `tools`/`tool_calls` shape) when the provider supports it, keeping the `CALL_TOOL:`/`FINAL_ANSWER:` text protocol as the Ollama fallback. This is the single biggest reliability upgrade for the "real production AI assistant" bar.

**Model routing:** `resolveProvider` currently returns the openai provider for any `req.model`; route by model prefix → provider instead.

### 2. Pipeline Semantics (`packages/pipeline-engine`, `apps/api`)

- **`parallelFork`:** execute branch subgraphs with real concurrency (`Promise.allSettled`), aggregate outputs.
- **`loop`:** re-execute the downstream subgraph per iteration with `$loop.index/item/total` bound per iteration.
- **`webhookTrigger`:** replace the client-side `window.addEventListener` with a server-side listener — the API binds an HTTP route per configured `webhookUrl` and fires the pipeline.
- **`humanApproval`:** persist a paused run (status `AWAITING_APPROVAL` + pending node id + graph snapshot); `resume` continues from the exact paused node instead of re-running the whole graph.
- **`subPipeline`:** API injects a real `subPipelineRunner` into the engine context that triggers the referenced pipeline and returns its output.
- **Trigger daemon cron:** replace the naive `setInterval` parsing with real `node-cron` semantics (the API's `cron-scheduler.ts` already uses node-cron correctly — reuse the pattern).

### 3. Agent Runtime (`packages/agent-runtime`)

**Implement `/webhook/ingest`:** accept `{ channel, payload }`, normalize via the existing channel extraction, route to the agent loop, return the reply. This unblocks the entire inbound chain (webhooks router → runtime → agent reply) that currently 502s.

### 4. `flowmind.*` MCP Tools (`packages/mcp-executor`)

Implement all 10 stubs over real backends, flipping `implemented: false` → `true`:

| Tool | Real backend |
|------|-------------|
| `flowmind.memory.search` | context-engine Qdrant search |
| `flowmind.pipeline.trigger` | pipeline engine trigger (creates a real run) |
| `flowmind.skill.run` | skill-engine execution |
| `flowmind.db.query` | read-only pg query (reuse `assertSafeReadOnlySql`) |
| `flowmind.image.generate` | HF inference API (same as pipeline `imageGenerate` runner) |
| `flowmind.audio.transcribe` | HF Whisper via token; honest error if `HF_TOKEN` absent |
| `flowmind.git.pr` | GitHub API via `GITHUB_TOKEN` |
| `flowmind.github.issue` | GitHub API via `GITHUB_TOKEN` |
| `flowmind.slack.message` | Slack webhook URL from credential config |
| `flowmind.notion.page` | Notion API via `NOTION_TOKEN` |

### 5. Channel Gateway (`packages/channel-gateway`, `apps/api`, `packages/agent-runtime`)

- Instantiate and register adapters in API production code (currently tests-only).
- Wire real webhook listeners: telegram (real), slack/discord/email (implement stubs), whatsapp (Graph-shaped normalizer + verify GET handshake).
- The `/webhook/ingest` route (workstream 3) is the inbound terminus.

### 6. Agents (`apps/api/src/routers/agents.ts`)

Replace the fake deploy lifecycle: `create` → `DEPLOYING` → toggle flips to `RUNNING`/`ERROR` based only on runtime health. Make agent status reflect real state (e.g., runtime reachability + configured model availability), or honestly mark the deploy surface as not-yet-real and remove the misleading status.

### 7. Marketplace (`packages/*`, `apps/api/src/routers/marketplace.ts`)

Unify the two parallel catalogs (generic `marketplace.*` and legacy `MarketplaceFlow`) into one listing model with per-type install semantics and an executable payload path for non-skill types.

### 8. Frontend Dead Surfaces (`apps/web`)

Audit every page during end-user testing; fix dead buttons, static-data pages, and misleading "coming soon" states. Pages to audit: agents, workspace, jobs, processes, governance, frameworks, templates, runtimes, files, install, tools, tools-v2, context, docs.

### 9. Logging & Observability

Standardize contextual logging (request/process id, user, operation, step, duration, status) across API, engine, and runtime. Never log secrets. Add a `requestId` middleware on the API.

### 10. CI/CD

Add `.github/workflows/ci.yml`: lint + typecheck gate → unit tests → build (tsup + next standalone) → e2e (Playwright). This is pure YAML, fully code-completable.

### 11. Desktop Packaging (deferrable, P2)

Documented as remaining; only fix if time permits — the web product is the primary surface.

## Data Flow (Inbound Channel, Target)

```
Telegram/Slack/WhatsApp webhook
  → API webhooks.* router (secret verify, extract text)
  → agent-runtime /webhook/ingest (NEW)
  → agent loop (reply)
  → response returned to channel adapter
```

## Error Handling

- Every new code path: detect → log (with ids) → handle → present meaningfully → recoverable where possible.
- `flowmind.*` tools must never fake success: missing tokens/creds → explicit error surfaced to the model.
- Pipeline semantics changes must keep the existing per-node retry + `continueOnFail` behavior.
- `streamAsync` fix must propagate `onError` to the generator consumer.

## Testing Strategy

- Unit tests for every changed package (llm-router, pipeline-engine, mcp-executor, channel-gateway, agent-runtime via pytest).
- Integration: pipeline parallel/loop/webhook/human-approval/sub-pipeline scenarios; `/webhook/ingest` round-trip; `flowmind.*` tool execution against real local backends (Qdrant, SQLite, skill-engine).
- Keep all 242 existing tests green; `tsc --noEmit` zero errors in api + web.
- End-user pass: register → chat → build/run a pipeline → use each node type → marketplace publish/install → settings.

## Open Questions

- Agent native tool-calling: which providers beyond OpenAI-compatible need bespoke handling (Anthropic/Google have their own shapes)? Resolve during implementation; OpenAI-compatible + regex fallback covers the verified local path.
- `flowmind.audio.transcribe`: Whisper needs a real model/endpoint — HF inference is the pragmatic backend; flag if `HF_TOKEN` is absent.
- Marketplace unification: migrate legacy `MarketplaceFlow` rows into the generic model, or keep both with a unified query surface? Prefer unified model with migration.

## Externally Blocked (Documented, Not Faked)

Cloud LLM live verification, Stripe checkout loop, OAuth/SSO live flows, WhatsApp Meta handshake end-to-end, Docker image validation, AWS deployment, load testing. Each is documented with exact required configuration in the roadmap's `remaining.md`.