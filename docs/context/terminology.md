# Terminology

A glossary of terms used in the FlowMind codebase, grounded in the actual Prisma schema, tRPC routers, and package names.

---

## Core Domain Models

| Term | Definition | Schema Location |
|------|-----------|----------------|
| **User** | A registered user of the platform. Has a `UserRole` (USER, ADMIN, SUPER_ADMIN) and a `Tier` (FREE, PRO, TEAM, ENTERPRISE). | `users` table |
| **Org** | An organization. Groups users, pipelines, MCP tokens, and marketplace listings. Has a slug, optional SAML config, and a billing tier. | `orgs` table |
| **OrgMember** | Join table linking Users to Orgs with a role (OWNER, ADMIN, MEMBER, VIEWER). | `org_members` table |
| **HostGroup** | A collaboration group within an Org. Owns pipelines, skills, and knowledge bases. Supports proposals (PRs for pipelines). | `host_groups` table |
| **HostGroupMember** | Join table linking Users to HostGroups with a role (OWNER, ADMIN, MEMBER, VIEWER). | `host_group_members` table |
| **HostClient** | A client application connected to a HostGroup. Has a connect token, status (PENDING, ACTIVE, REVOKED), and sync timestamps. | `host_clients` table |
| **HostConnection** | A user's connection to an external host. Stores access/refresh tokens and group membership. | `host_connections` table |

## Pipeline & Execution

| Term | Definition | Schema Location |
|------|-----------|----------------|
| **Pipeline** | A visual workflow consisting of nodes (triggers, AI agents, actions, flow control) connected by edges. Stored as a JSON graph. | `pipelines` table |
| **PipelineRun** | A single execution of a pipeline. Has a `RunStatus` (PENDING, RUNNING, SUCCESS, FAILED, CANCELLED, AWAITING_APPROVAL), input/output JSON, cost, and token counts. | `pipeline_runs` table |
| **RunLog** | Per-node execution log within a PipelineRun. Records node type, input, output, error, duration, tokens, and cost. | `run_logs` table |
| **RunStatus** | Enum: PENDING, RUNNING, SUCCESS, FAILED, CANCELLED, AWAITING_APPROVAL. | Schema enum |
| **PipelineStatus** | Enum: DRAFT, ACTIVE, ARCHIVED. | Schema enum |
| **PipelineProposal** | A proposed change to a pipeline within a HostGroup (like a pull request). Has status (PROPOSED, APPROVED, REJECTED, MERGED), base/proposed graphs, and diff. | `pipeline_proposals` table |
| **ProposalStatus** | Enum: PROPOSED, APPROVED, REJECTED, MERGED. | Schema enum |
| **active-runs** | In-memory singleton registry tracking all currently running PipelineRuns. Used for run-recovery on API restart. | `apps/api/src/services/active-runs.ts` |
| **run-recovery** | On API startup, scans for incomplete PipelineRun records and recovers or fails them. | `apps/api/src/services/run-recovery.ts` |

## AI & Agents

| Term | Definition | Schema Location |
|------|-----------|----------------|
| **Agent** | A configured AI agent with a model, temperature, max tokens, and tool count. Tracks success rate and message count. | `agents` table |
| **AgentStatus** | Enum: RUNNING, STOPPED, ERROR, DEPLOYING. | Schema enum |
| **agent loop** | The iterative process where an LLM receives a prompt, decides to CALL_TOOL or return FINAL_ANSWER, and repeats until done. Implemented in `llm-router`. | `packages/llm-router/src/` |
| **CALL_TOOL** | Agent loop step type: the LLM wants to call a tool (read, write, bash, webFetch, MCP tool, etc.). | `packages/llm-router/src/` |
| **FINAL_ANSWER** | Agent loop step type: the LLM has finished and is returning the final response. | `packages/llm-router/src/` |
| **Session** | A chat session. Contains messages, embeddings, and optional memory references. | `sessions` table |
| **Message** | A single message in a session. Has a `MessageRole` (USER, ASSISTANT, SYSTEM, TOOL), content, optional tool calls/results, model info, token counts, and duration. | `messages` table |
| **MessageRole** | Enum: USER, ASSISTANT, SYSTEM, TOOL. | Schema enum |

## Skills & Marketplace

| Term | Definition | Schema Location |
|------|-----------|----------------|
| **Skill** | A reusable code snippet or workflow owned by a user or HostGroup. Has trigger pattern, code, version, success rate, and use count. | `skills` table |
| **MarketplaceSkill** | A published skill in the marketplace with name, description, author, manifest, code, version, tags, downloads, and ratings. | `marketplace_skills` table |
| **MarketplaceListing** | A generic marketplace item supporting 7 types. Has title, description, tags, manifest, payload reference, visibility, fork chain, and ratings. | `marketplace_listings` table |
| **MarketplaceItemType** | Enum: SKILL, PIPELINE, WORKFLOW, PROMPT_PACK, AGENT_TEMPLATE, MCP_INTEGRATION, PLUGIN. | Schema enum |
| **MarketplaceFlow** | A pipeline published to the marketplace. Linked to a Pipeline, with category, title, tags, price, downloads, ratings, and fork chain. | `marketplace_flows` table |
| **Visibility** | Enum: PRIVATE, PUBLIC, TEAM. Controls who can see a MarketplaceListing. | Schema enum |

## Memory & Knowledge

| Term | Definition | Schema Location |
|------|-----------|----------------|
| **Memory** | A piece of information stored for a user, optionally linked to a session. Has content, summary, type, relevance score, and embedding vector. | `memories` table |
| **KnowledgeBase** | A collection of documents for RAG (Retrieval-Augmented Generation). Has a model (default: nomic-embed-text), status, and document/chunk counts. | `knowledge_bases` table |
| **KnowledgeBaseStatus** | Enum: READY, INDEXING, ERROR. | Schema enum |
| **KnowledgeDocument** | A document within a KnowledgeBase. Has type (PDF, TXT, MD, CSV, JSON), size, chunk count, status, and content. | `knowledge_documents` table |
| **DocumentStatus** | Enum: INDEXED, INDEXING, ERROR. | Schema enum |

## Provider & Credentials

| Term | Definition | Schema Location |
|------|-----------|----------------|
| **ProviderCredential** | An encrypted API key for a cloud LLM provider. Stored as AES-256-GCM encrypted value. Scoped to a user. | `provider_credentials` table |
| **provider-registry** | Package managing API keys for 15+ cloud providers. Keys loaded from DB at startup, decrypted in-memory. | `packages/provider-registry/` |
| **llm-router** | Package that routes LLM calls to the appropriate provider, handles fallback, and implements the agent loop. | `packages/llm-router/` |
| **llm-factory** | Centralized call-site for all LLM interactions. Handles provider selection, retry, logging, token counting. | `apps/api/src/lib/llm-factory.ts` |

## MCP (Model Context Protocol)

| Term | Definition | Schema Location |
|------|-----------|----------------|
| **McpServer** | A configured MCP server connection. Has transport (STDIO, STREAMABLE_HTTP, SSE), command/args for stdio, baseUrl/headers for HTTP, and tenant scope. | `mcp_servers` table |
| **McpServerTransport** | Enum: STDIO, STREAMABLE_HTTP, SSE. | Schema enum |
| **McpToken** | OAuth token for MCP server authentication. Scoped to an org. | `mcp_tokens` table |
| **mcp-executor** | Package implementing MCP protocol execution with OAuth support. | `packages/mcp-executor/` |
| **flowmind.* tools** | Built-in MCP tools registered by FlowMind (10 are currently stubs returning placeholder responses). | Registered in tool-system |

## Security & Auth

| Term | Definition | Schema Location |
|------|-----------|----------------|
| **UserRole** | Platform-level role: USER, ADMIN, SUPER_ADMIN. | Schema enum |
| **OrgRole** | Organization-level role: OWNER, ADMIN, MEMBER, VIEWER. | Schema enum |
| **GroupRole** | HostGroup-level role: OWNER, ADMIN, MEMBER, VIEWER. | Schema enum |
| **Tier** | Subscription tier: FREE, PRO, TEAM, ENTERPRISE. | Schema enum |
| **ApiKey** | A programmatic API key. Has name, provider, hashed key, last four digits, expiry, and active status. | `api_keys` table |
| **SSRF guard** | Security mechanism blocking outbound HTTP to internal/private IP ranges. All external HTTP goes through `fetchPublic`. | `packages/tool-system/` |
| **isolated-vm sandbox** | V8 isolate sandbox for executing `codeExecute` nodes. Prevents arbitrary code from accessing the host system. | `packages/pipeline-engine/` |
| **FetchPublic** | Safe HTTP fetch function with SSRF blocklist. Used by all outbound HTTP in tool-system and pipeline-engine. | `packages/tool-system/` |
| **ENCRYPTION_KEY** | Environment variable holding the AES-256-GCM key for encrypting provider credentials at rest. | `apps/api/src/lib/crypto.ts` |
| **JWT_SECRET** | Environment variable for JWT signing. Falls back to a dev-only default; throws in production if not set. | `apps/api/src/lib/jwt-secret.ts` |

## Billing & Subscriptions

| Term | Definition | Schema Location |
|------|-----------|----------------|
| **Subscription** | Per-user Stripe subscription. Has tier, status, period dates, and cancel-at-period-end flag. | `subscriptions` table |
| **OrgSubscription** | Per-org Stripe subscription. Includes member limit and usage tracking. | `org_subscriptions` table |
| **UsageRecord** | Metered usage tracking. Records subject type/id, metric, quantity, and period. | `usage_records` table |
| **CreatorRevenue** | Revenue earned by marketplace creators from flow sales. | `creator_revenue` table |

## Infrastructure & Packaging

| Term | Definition | Location |
|------|-----------|----------|
| **pipeline-engine** | Package implementing DAG execution, node runners, and async pipeline orchestration. | `packages/pipeline-engine/` |
| **tool-system** | Package defining built-in tools (read, write, edit, grep, glob, bash, webFetch, webSearch, http_request, applyPatch, todoWrite). | `packages/tool-system/` |
| **skill-engine** | Package for sandboxed skill execution and marketplace skill management. | `packages/skill-engine/` |
| **context-engine** | Package for session memory, context assembly, and Qdrant vector integration. | `packages/context-engine/` |
| **session-engine** | Package for chat session management and SSE streaming. | `packages/session-engine/` |
| **runtime-registry** | Package for dispatching to external runtimes (e.g., OpenHuman, custom adapters). | `packages/runtime-registry/` |
| **channel-gateway** | Package with messaging adapters: Telegram, Slack, Discord, WhatsApp, Email. | `packages/channel-gateway/` |
| **plugin-engine** | Package for plugin lifecycle management. | `packages/plugin-engine/` |
| **snapshot** | Package for pipeline version snapshots and rollback. | `packages/snapshot/` |
| **permission** | Package for file-level permission evaluation (minimatch-based rules). | `packages/permission/` |
| **lsp** | Package for LSP (Language Server Protocol) integration. | `packages/lsp/` |
| **errors** | Package providing typed error classes with machine-readable codes. | `packages/errors/` |
| **shared** | Package with common types and utilities used across all packages. | `packages/shared/` |
| **ui** | Package with shared shadcn/ui React components. | `packages/ui/` |
| **http-recorder** | Package for HTTP request recording. | `packages/http-recorder/` |
| **ollama-proxy** | Package for proxying requests to Ollama. | `packages/ollama-proxy/` |
| **agent-runtime** | Python FastAPI agent runtime (port 8001). Manages AI interactions with streaming, context, and skills. | `packages/agent-runtime/` |

## tRPC Router Names

The API exposes these tRPC routers (defined in `apps/api/src/routers/index.ts`):

| Router | Purpose |
|--------|---------|
| `auth` | User registration, login, logout, password reset, MFA, SSO |
| `chat` | Chat sessions, message history, streaming |
| `pipeline` | Pipeline CRUD, execution, run status |
| `tools` | Tool registry, tool execution (legacy) |
| `toolsV2` | Tool execution v2 with server-side approval |
| `mcp` | MCP server management, tool discovery, tool calling |
| `webhooks` | Webhook CRUD and execution |
| `skills` | Skill CRUD and execution |
| `billing` | Subscription management, Stripe integration |
| `marketplace` | Marketplace listings, reviews, forks, downloads |
| `knowledge` | Knowledge base and document management, RAG search |
| `agents` | Agent CRUD and configuration |
| `settings` | User and org settings |
| `models` | LLM model listing and configuration |
| `jobs` | Scheduled jobs and cron management |
| `files` | File upload and management |
| `console` | System console and logs |
| `notifications` | User notifications |
| `context` | Context and memory management |
| `runtime` | External runtime registration |
| `host` | HostGroup and HostClient management |
| `system` | System health and status |
