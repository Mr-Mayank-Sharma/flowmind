# FlowMind Roadmap & Status

Single source of truth for what FlowMind is, what works, what is partially done, and what remains. A new developer or AI should trust these documents over narrative docs to know the true state of the codebase.

**Last updated:** 2026-09-05 (from `docs/VERIFICATION-REPORT.md`, git history, and the roadmap gap analysis)

## Status markers

| Marker | Meaning |
|--------|---------|
| ✅ | Complete — genuinely implemented and verified working |
| 🚧 | In Progress — partially implemented; has real code but is unfinished or not end-to-end |
| ❌ | Missing — required for the vision but not started |
| 🔮 | Future — long-term idea grounded in the product vision |

## Status table

| Area | Status | Where to look |
|------|--------|---------------|
| Auth / tenant | ✅ | [completed.md](./completed.md#auth--tenant), [gap-analysis.md](./gap-analysis.md#4-real-oauth--sso) |
| Chat / inference | 🚧 | [in-progress.md](./in-progress.md#cloud-llm--chat-live-integration) |
| Pipelines | 🚧 | [in-progress.md](./in-progress.md#pipeline-flow-semantics-parallel--loop--webhook--subpipeline) |
| Security hardening | ✅ | [completed.md](./completed.md#security) |
| Connectors / MCP | 🚧 | [in-progress.md](./in-progress.md#flowmind-mcp-tool-stubs), [in-progress.md](./in-progress.md#channel-gateway--whatsapp) |
| Data / state (Redis, Qdrant) | ✅ | [completed.md](./completed.md#data--state) |
| Build / deploy artifacts | 🚧 | [in-progress.md](./in-progress.md#build--deploy-artifacts) |
| Tests | ✅ | [completed.md](./completed.md#tests) |
| Public deployment | ❌ | [remaining.md](./remaining.md#1-public-deployment-on-aws) |
| Billing (Stripe) | 🚧 | [remaining.md](./remaining.md#2-real-stripe-billing-checkout), [in-progress.md](./in-progress.md#billing-stripe) |
| Cloud LLM live | ❌ | [remaining.md](./remaining.md#3-live-cloud-llm-inference) |
| WhatsApp / channels | ❌ | [in-progress.md](./in-progress.md#channel-gateway--whatsapp) |

## How to read the roadmap

The mind-map is a **requirement chain**:

```
Vision → Requirement → Current Implementation → Missing Work → Priority
```

Each major area is traced through that chain in [gap-analysis.md](./gap-analysis.md). The three status files are the evidence behind it:

- [completed.md](./completed.md) — everything genuinely working, organized by area, with commit references.
- [in-progress.md](./in-progress.md) — partially implemented items: current state + what remains.
- [remaining.md](./remaining.md) — everything required for the current vision to be complete, prioritized.
- [future.md](./future.md) — long-term ideas grounded in the product vision.

## Sources of truth

- `docs/VERIFICATION-REPORT.md` — live-verification facts (2026-08-29, Track 2 2026-08-30, Track 3 2026-08-30).
- `docs/REBUILD-PLAN.md` — audit synthesis and phased plan (authoritative for the original issues).
- Git history on `main`: `2c7b314` (hardening), `cf3c5c1` (Track 1 build), `44cbdc0` (Track 2 durable state), `61730ce` (Track 3 connectors). Branch is clean and pushed to origin.

## Honesty rule

A stub is never marked ✅. A feature that only runs locally is never marked "public production ready." When in doubt, read `docs/VERIFICATION-REPORT.md` and verify against the code before changing a status marker.
