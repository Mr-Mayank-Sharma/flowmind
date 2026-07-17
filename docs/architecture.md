# Architecture

## System Overview

FlowMind is an AI Agent OS — a platform for building, running, and sharing AI-powered workflows and chat agents.

```
┌─────────────────────────────────────────────────────┐
│                    Web UI (Next.js)                  │
│  Pipeline Canvas · Chat · Marketplace · Settings     │
└──────────────────────┬──────────────────────────────┘
                       │ tRPC
┌──────────────────────┴──────────────────────────────┐
│                   API (Fastify)                      │
│  tRPC Routers · Auth · SSE Streaming                │
└───┬──────────┬──────────┬──────────┬────────────────┘
    │          │          │          │
┌───┴───┐ ┌───┴───┐ ┌───┴───┐ ┌───┴────────────┐
│ LLM   │ │Pipe-  │ │Skill  │ │Tool            │
│Router │ │line   │ │Engine │ │System          │
│       │ │Engine │ │       │ │(MCP/Registry)  │
└───┬───┘ └───┬───┘ └───┬───┘ └────────────────┘
    │         │         │
┌───┴─────────┴─────────┴──────────────────────┐
│              Shared Infrastructure            │
│  Provider Registry · Context Engine · DB     │
│  Channel Gateway · Session Engine            │
└──────────────────────────────────────────────┘
```

## Package Map

| Package | Purpose |
|---|---|
| `@flowmind/api` | Fastify server, tRPC routers, auth, SSE |
| `@flowmind/web` | Next.js 14 App Router, ReactFlow canvas, chat UI |
| `@flowmind/cli` | Commander.js CLI for pipeline/skill management |
| `@flowmind/llm-router` | LLM provider abstraction, agent loop, model routing |
| `@flowmind/pipeline-engine` | DAG execution, node runners, expression engine |
| `@flowmind/skill-engine` | Sandboxed JS skill execution, marketplace integration |
| `@flowmind/tool-system` | Tool registry, built-in tools (read, write, bash, etc.) |
| `@flowmind/mcp-executor` | MCP protocol executor, OAuth, built-in tool dispatch |
| `@flowmind/channel-gateway` | Multi-channel messaging (Telegram, Slack, Discord, etc.) |
| `@flowmind/context-engine` | Session/memory management, context assembly |
| `@flowmind/provider-registry` | LLM provider configuration and key management |
| `@flowmind/runtime-registry` | External runtime registration and task dispatch |
| `@flowmind/errors` | Typed error classes with codes and retry policies |
| `@flowmind/db` | Prisma schema, database client, seed data |
| `@flowmind/ui` | Shared React components (shadcn/ui) |
| `@flowmind/shared` | Common types and utilities |

## Data Flow

### Pipeline Execution

1. User triggers a pipeline (manual, cron, webhook, or chat)
2. `pipeline-engine` validates the graph and builds an execution plan
3. Nodes execute in topological order via `getRunner()` dispatch
4. Each node runner produces output; results flow to downstream nodes
5. SSE events stream progress to the web UI

### Chat Agent Loop

1. User sends a message via the chat UI
2. `ChatService` builds context (history, tools, memories)
3. `llm-router` sends to the configured provider
4. LLM may request tool calls → dispatched via `tool-system`
5. Tool results are fed back to the LLM until a final response is produced
6. Response streams back via SSE

### Skill Execution

1. User installs a skill from the marketplace (or creates locally)
2. Skill manifest (`skill.json`) defines inputs, outputs, permissions
3. `skill-engine` loads and executes the skill in a sandboxed `isolated-vm`
4. Skills can be used as pipeline nodes (`skill.*` type prefix)

## Database Models

Key models in `packages/db/prisma/schema.prisma`:

- **User** — Auth, roles, org membership
- **Pipeline** — Workflow definitions with graph JSON
- **PipelineRun** — Execution records with status and timing
- **MarketplaceFlow** — Published workflows with ratings
- **MarketplaceSkill** — Published skills with versions
- **ChatSession/ChatMessage** — Chat history
- **ApiKey/Credential** — Encrypted secrets
