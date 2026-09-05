# FlowMind Documentation Index

This directory is the **single source of truth** for FlowMind — for humans and for AI agents. The `docs/` tree is part of the product: when behavior changes (a port, an env var, a command, an endpoint, a security rule), the relevant doc must change with it.

> **New to this repo?** Start at [context/ai-context.md](context/ai-context.md). It is the first document both a new developer and a new AI agent should read before touching any code.

## Where to start

- **New human developer** → [context/ai-context.md](context/ai-context.md) (orientation + module relationships + security invariants), then [development/setup.md](development/setup.md) (full local walkthrough), then [development/project-structure.md](development/project-structure.md).
- **New AI agent** → [context/ai-context.md](context/ai-context.md) first. It is written explicitly for agents (project identity, package map, traced feature flows, known problems, security invariants). Then read [development/contribution.md](development/contribution.md) for the gates and commit style.

## Documentation map

```
docs/
  README.md                  This index — start here to navigate everything
  context/
    ai-context.md            FIRST STOP: AI/human onboarding, modules, security
    decisions.md             Key architectural decisions and why
    development-history.md   Development history / evolution
    project-context.md       Why FlowMind exists and its framing
    terminology.md           Domain vocabulary
  product/
    vision.md                Product vision (what FlowMind wants to be)
    idea.md                  Core idea
    problem-statement.md     Problem being solved
    users.md                 Target users
    use-cases.md             Concrete use cases
    features.md              Product feature overview
  architecture/
    overview.md              High-level system overview
    system.md                System boundaries and components
    backend.md               API / backend architecture
    frontend.md              Web frontend architecture
    api.md                   HTTP + tRPC API surface
    database.md              Database architecture
    integrations.md          External integrations
    deployment.md            Architecture view of deployment
  data-model/
    overview.md              Data model overview
    entities.md              Core entities
    relationships.md         Entity relationships
    schema.md                Prisma schema walkthrough
    data-flow.md             How data moves through the system
  features/
    pipelines.md             Visual pipeline builder
    chat.md                  Chat with agents
    agent-loop.md            Agent loop, tools, call/answer
    mcp-integration.md       MCP tool integration
    knowledge-rag.md         Knowledge bases / RAG
    marketplace.md           Skill marketplace
    skills.md                Skills
    cron-jobs.md             Cron scheduling
    connectors.md            Connectors
    providers-models.md      LLM providers and models
    runtimes-hosts.md        External runtimes and hosts
    authentication.md        Auth, JWT, RBAC, SSO
    multi-tenancy-org.md     Tenants and organizations
    billing.md               Stripe billing
  workflows/
    overview.md              Workflows at a glance
    chat-workflow.md         Chat end-to-end
    auth-workflow.md         Authentication flow
    pipeline-run-workflow.md Pipeline execution flow
    agent-tool-workflow.md   Agent + tool flow
    knowledge-ingest-workflow.md  RAG ingest flow
    marketplace-workflow.md  Marketplace flow
  whatsapp/
    overview.md              WhatsApp integration overview
    architecture.md          WhatsApp architecture
    workflow.md              WhatsApp message flow
    data-model.md            WhatsApp data model
    integration.md           WhatsApp integration / blockers
  development/
    setup.md                 Full local setup walkthrough (source of truth)
    project-structure.md     Monorepo navigation map
    local-development.md     Local dev workflows
    testing.md               Testing strategy and commands
    debugging.md             Debugging guidance
    contribution.md          Contribution, conventions, PR checklist
  deployment/
    overview.md              Deployment overview (honest status)
    environment.md           All environment variables (authoritative)
    infrastructure.md        Infrastructure requirements
    production-checklist.md  Production readiness checklist
    aws.md                   Recommended AWS architecture (planned, not built)
  roadmap/
    README.md                Roadmap index + status table (✅🚧❌🔮)
    completed.md             Everything genuinely done
    in-progress.md           Partially implemented items
    remaining.md             What remains, prioritized
    future.md                Long-term ideas
    gap-analysis.md          Vision -> requirement -> implementation chain
```

## Legacy / existing guides

These files predate the structured docs tree. Most content has been superseded by the directories above; the originals are kept for reference and searchability.

| File | Status | Note |
|------|--------|------|
| [getting-started.md](getting-started.md) | Superseded | Replaced by [development/setup.md](development/setup.md) |
| [architecture.md](architecture.md) | Superseded | Replaced by [architecture/overview.md](architecture/overview.md) and the `architecture/*` family |
| [self-hosting.md](self-hosting.md) | Superseded | Replaced by [deployment/overview.md](deployment/overview.md) and [deployment/infrastructure.md](deployment/infrastructure.md) |
| [pipeline-authoring.md](pipeline-authoring.md) | Active reference | Pipeline authoring reference; no modern replacement yet |
| [skill-development.md](skill-development.md) | Superseded | Content folded into [features/skills.md](features/skills.md) and [development/contribution.md](development/contribution.md) |
| [integration-protocol.md](integration-protocol.md) | Active reference | Internal integration protocol reference |
| [mcp-integration-spec.md](mcp-integration-spec.md) | Active reference | MCP integration spec; see also [features/mcp-integration.md](features/mcp-integration.md) |
| [plugin-spec.md](plugin-spec.md) | Active reference | Plugin spec |
| [prompt-pack-spec.md](prompt-pack-spec.md) | Active reference | Prompt pack spec |
| [agent-template-spec.md](agent-template-spec.md) | Active reference | Agent template spec |
| [qa-audit-report.md](qa-audit-report.md) | Historical | QA audit report |
| [disaster-recovery.md](disaster-recovery.md) | Active reference | Disaster recovery plan |
| [security-assumptions.md](security-assumptions.md) | Active reference | Security assumptions; see also [context/ai-context.md](context/ai-context.md) |
| [REBUILD-PLAN.md](REBUILD-PLAN.md) | Historical | Original rebuild plan; status tracked in [roadmap/README.md](roadmap/README.md) |
| [VERIFICATION-REPORT.md](VERIFICATION-REPORT.md) | Active reference | Live verification report; status source of truth |

## Status sources of truth

| Question | Source |
|----------|--------|
| What has been live-verified on this machine? | [VERIFICATION-REPORT.md](VERIFICATION-REPORT.md) |
| What is done / in progress / remaining / future? | [roadmap/README.md](roadmap/README.md) and its status files |
| What did the original audit find and fix? | [REBUILD-PLAN.md](REBUILD-PLAN.md) |
| What environment variables exist? | [deployment/environment.md](deployment/environment.md) |

**Honesty rule:** a feature that only runs locally is never marked "public production ready." A stub is never marked done (✅). When in doubt, read [VERIFICATION-REPORT.md](VERIFICATION-REPORT.md) and check the code before changing a status marker.

## How to keep these docs in sync

Documentation is part of the product — stale docs are treated as bugs. When you change behavior (a port, an env var, a command, an endpoint, a security rule, a package), update the matching doc in this tree in the same change. In particular:

- Environment variables → add to `deployment/environment.md`, `.env.example`, and `apps/api/.env.example`.
- Ports / commands / setup steps → update `development/setup.md` and the root `README.md`.
- Architecture / modules / security invariants → update `architecture/*` and `context/ai-context.md`.
- Status changes → update `roadmap/README.md` and its status files based on live verification, not intent.

See [development/contribution.md](development/contribution.md) for the full contribution and documentation rules.
