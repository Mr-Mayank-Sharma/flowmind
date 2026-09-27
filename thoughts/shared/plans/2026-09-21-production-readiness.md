# Production Readiness Implementation Plan

Date: 2026-09-21
Source design: thoughts/shared/designs/2026-09-21-production-readiness-design.md

## Progress

- ✅ **Batch 1 done** — llm-router streamAsync single-stream, resolveProvider model-prefix routing, native tool calling, tests. Verified: tsc clean (apps/api, apps/web), llm-router 28/28 tests pass.
- ✅ **Batch 2 done** — parallelFork real concurrency + partial failure aggregation, loop with `$loop` vars + iteration cap, server-side webhook trigger, humanApproval pause/resume at exact node on the same run record, subPipeline child-run execution with tenant scoping + depth guard (`MAX_SUB_PIPELINE_DEPTH=5`), node-cron cron trigger. Verified: tsc clean (pipeline-engine, apps/api, apps/web), pipeline-engine 65/66 tests pass (1 skipped).
- ✅ **Batch 3 done** — agent-runtime POST /webhook/ingest (channel payload normalization for telegram/slack/discord/whatsapp/generic, routes through AgentOrchestrator, returns reply) + GET /webhook/verify (Meta WhatsApp hub handshake against WHATSAPP_VERIFY_TOKEN). /webhook/* exempt from bearer auth (API is the trusted ingress). Structured request_id/channel/duration logging, never payload content. Verified: 6/6 pytest pass, live curl 200/403 on verify, 200 on ingest.
- ✅ **Batch 4 done** — all 10 `flowmind.*` MCP tools implemented over real backends: memory.search (injected context engine), db.query (read-only pg via exported assertSafeReadOnlySql + DATABASE_URL), skill.run (injected skill engine), pipeline.trigger (injected triggerPipelineForUser → real PipelineRun), image.generate + audio.transcribe (HuggingFace Inference via HF_TOKEN), git.pr + github.issue (GitHub REST via GITHUB_TOKEN), slack.message (chat.postMessage via SLACK_BOT_TOKEN), notion.page (Notion API via NOTION_TOKEN). All throw honest errors when a required token/context is missing. `McpExecutorContext` 5th constructor param; apps/api wires getContextEngine/SkillEngine/triggerPipelineForUser. Verified: tsc clean (mcp-executor, pipeline-engine, apps/api), mcp-executor 46/46 tests pass (27 new).
- ⏳ **Batches 5–10 pending.**

## Guiding rules

- Every change keeps `tsc --noEmit` at zero errors in apps/api and apps/web.
- All 242 existing tests must stay green; new tests added per batch.
- No fake/demo functionality. If a feature needs credentials we don't have, code the real path and document the blocker honestly.
- Comments explain WHAT/WHY/HOW, never restate code.
- After each batch: typecheck + run affected tests.

## Batch 1 — llm-router correctness (foundation)

Files: packages/llm-router/src/engine.ts, packages/llm-router/src/agent-loop.ts, packages/llm-router/src/providers/*

1. Fix `streamAsync()` double-stream bug: stream once, collect chunks via an async queue, yield them, propagate onError to the caller. Remove the no-op onChunk first call.
2. Remove dead config keys `githubCopilotKey`, `awsBedrockKey` from LLMConfig and any provider wiring that references them. Grep for usages across repo before deleting.
3. Fix `resolveProvider()`: route by model-prefix (e.g. `gpt-*`→openai, `claude-*`→anthropic, `gemini-*`→google, `llama*/qwen*/mistral*`→ollama) instead of defaulting to openai whenever req.model is set.
4. Native tool calling: add `tools`/`tool_choice` support for OpenAI-compatible providers; keep regex CALL_TOOL/FINAL_ANSWER fallback for Ollama. Guard with try/catch so a provider without native support falls back cleanly.
5. Add unit tests: streamAsync single-call (mock provider counts invocations), resolveProvider routing table, agent-loop tool execution with truncation.

Verification: tsc in apps/api + apps/web; run packages/llm-router tests.

## Batch 2 — pipeline flow semantics

Files: packages/pipeline-engine/src/runners.ts, packages/pipeline-engine/src/triggers.ts, packages/pipeline-engine/src/engine.ts (if exists), apps/api/src/routers/pipeline.ts, apps/api/src/services/pipeline-runner.ts (if exists)

1. `parallelFork`: real concurrency — execute the downstream subgraph per branch with Promise.allSettled, emit per-branch status, aggregate partial failures into run logs. Respect `executionOrder:'parallel'` for sibling nodes.
2. `loop`: for each iteration, re-execute the downstream subgraph with `$loop` vars bound; cap iterations (configurable, default e.g. 10) to avoid infinite loops.
3. `webhookTrigger` (triggers.ts): replace client-side `window.addEventListener` no-op with a real server-side event. The API already has webhooks.ingest; wire the trigger daemon to fire when the webhook arrives (match on trigger path/secret).
4. `humanApproval`: persist paused state — PipelineRun status `AWAITING_APPROVAL`, store paused node id + graph snapshot. `resume` continues from the paused node (execute remaining subgraph), not a full re-run. `requestApproval` in pipeline.ts router must be a real implementation that records the decision and resumes.
5. `subPipeline`: inject a real `subPipelineRunner` into context from the API (create a child PipelineRun and execute it), replacing the "not available" error.
6. `cron` trigger in triggers.ts: replace naive parseInt cron parsing with node-cron patterns (align with apps/api/src/services/cron-scheduler.ts which is already real).
7. Add tests: parallelFork branch concurrency + partial failure, loop iteration count + var binding, webhookTrigger fires on ingest, humanApproval pause/resume at exact node, subPipeline child run execution.

Verification: tsc; run pipeline-engine tests + API tests.

## Batch 3 — agent-runtime /webhook/ingest

Files: agent-runtime/app/main.py, agent-runtime/app/ (routers if present)

1. Add POST `/webhook/ingest` accepting `{channel, payload}`. Normalize payload to a text message (reuse the Graph/telegram/slack shapes the API already extracts). Route to the agent loop (same path as /chat/send) and return the reply text.
2. Add GET `/webhook/verify` for Meta WhatsApp handshake (hub.mode/hub.verify_token/hub.challenge) returning the challenge when token matches WHATSAPP_VERIFY_TOKEN env.
3. Log with request id, channel, duration; never log payload content beyond message text.
4. Add pytest: ingest round-trip with a fake agent loop, verify handshake success/failure.

Verification: run agent-runtime pytest suite; curl the route locally.

## Batch 4 — flowmind.* MCP tools (real backends)

Files: packages/mcp-executor/src/index.ts, packages/mcp-executor/src/tools/* (create), packages/context-engine/src/* (if needed)

Implement the 10 tools over real backends; all set implemented:true and throw honest errors when a required credential/env is missing:

1. `flowmind.memory.search` → context-engine Qdrant search (tenant-scoped).
2. `flowmind.db.query` → read-only pg via assertSafeReadOnlySql.
3. `flowmind.skill.run` → skill-engine execution.
4. `flowmind.pipeline.trigger` → create + execute a real PipelineRun.
5. `flowmind.image.generate` → HF inference API (real, like imageGenerate runner).
6. `flowmind.audio.transcribe` → HF Whisper inference; honest error if HF_TOKEN missing.
7. `flowmind.git.pr` → GitHub API via GITHUB_TOKEN.
8. `flowmind.github.issue` → GitHub API via GITHUB_TOKEN.
9. `flowmind.slack.message` → Slack webhook POST (like slackMessage runner).
10. `flowmind.notion.page` → Notion API via NOTION_TOKEN.

Dependencies from the API must be injected via the executor's context (db pool, qdrant, skill engine, pipeline engine) — no new hardcoded credentials.

Add tests: each tool's happy path against local backends (Qdrant, SQLite/pg, skill-engine) + missing-credential honest error.

Verification: tsc; mcp-executor tests.

## Batch 5 — channel-gateway production wiring

Files: apps/api/src/app.ts (or server bootstrap), packages/channel-gateway/src/*, agent-runtime additions from Batch 3

1. Instantiate channel-gateway adapters in the API process (currently tests-only). Wire telegram/openhuman real setupWebhook; slack/discord/whatsapp webhook receivers point at the API webhooks.* routes.
2. WhatsApp: fix normalizer to Graph API shape (entry[0].changes[0].value.messages[0]); ensure inbound flows to /webhook/ingest which now exists (Batch 3); add Meta verify GET handshake.
3. Outbound channel send: wire sendMessage paths to the real adapters (currently fire-and-forget webhook only).
4. Add tests: WhatsApp Graph payload normalization, telegram payload normalization, outbound send through adapter mock.

Verification: tsc; channel-gateway + API tests.

## Batch 6 — agents router honesty

Files: apps/api/src/routers/agents.ts

1. Remove fake 'DEPLOYING' status that never deploys. Either implement a minimal real lifecycle (agent = persisted config + runtime health check; status reflects last health check) or set status honestly to reflect what exists.
2. Update frontend agents page if it depends on fake states.
3. Add test: create → status reflects real state, toggle reflects runtime health.

Verification: tsc; API tests.

## Batch 7 — marketplace unification

Files: packages/marketplace (or apps/api marketplace router), apps/web marketplace pages

1. Unify the two parallel catalogs (generic marketplace.* + legacy MarketplaceFlow) into one listing model.
2. Non-skill types must carry an executable payload (or be honestly marked non-executable). No manifest/payloadRef-only dead listings.
3. Add test: unified listing query returns both skill and non-skill entries with valid payloads.

Verification: tsc; marketplace tests.

## Batch 8 — logging standardization

Files: apps/api/src/plugins/* (request logging), packages/*/src (key services)

1. Add requestId middleware (Fastify onRequest) generating/inheriting x-request-id; include in all logs: requestId, userId, operation, step, durationMs, status.
2. Audit log statements for secrets (tokens, keys, payloads) — redact; never log Authorization headers or webhook payloads.
3. Standardize error logging: detect → log (context) → handle → present. No empty catches; never log success on failure.
4. Add test: requestId propagation through a router, redaction of secrets in a sample log.

Verification: tsc; API tests.

## Batch 9 — CI/CD

Files: .github/workflows/ci.yml (create)

1. Workflow: checkout → setup node → install → lint → tsc (api, web) → unit tests → build (api tsup, web standalone) → e2e smoke (Playwright).
2. Gate on zero TS errors and all tests green.

Verification: workflow file lint (actionlint if available); no local run possible (no GitHub).

## Batch 10 — final verification + documentation

1. Run tsc --noEmit on apps/api and apps/web (zero errors).
2. Run full test suites (242 existing + new).
3. End-user pass over frontend pages: chat with Ollama, pipeline run with parallel/loop, webhook trigger, human approval flow, marketplace listing, agents page, settings. Fix anything broken found during the pass.
4. Update docs/roadmap: move completed items, mark credential-gated items, document external blockers (cloud LLM live, Stripe, OAuth/SSO, WhatsApp Meta e2e, Docker validation, AWS deployment, load testing).
5. Commit all changes in logical commits per batch.

## Out of scope (documented, not faked)

- Live cloud LLM calls (no keys) — code path real, gated on env presence.
- Stripe checkout, OAuth/SSO live — credential-gated.
- WhatsApp Meta end-to-end — needs real app credentials; verify handshake + Graph normalization implemented and tested locally.
- Docker image validation, AWS deployment, load testing — no Docker/WSL2/AWS in this environment.
- Desktop packaging — P2 deferral.