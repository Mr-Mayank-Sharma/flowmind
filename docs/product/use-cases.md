# Use Cases

Concrete, real-world use cases supported by current FlowMind features. Each maps to a verified capability.

---

## 1. Chat with a Local LLM via Ollama

**What you do:** Start a chat session, select a local Ollama model (e.g. `llama3.1`), and converse.

**How it works:** `chat` tRPC router → `ChatService` → `llm-router` → `provider-registry` → Ollama at `localhost:11434`. Responses stream via SSE.

**Status:** ✅ Works end-to-end with Ollama.

---

## 2. Build and Run a Pipeline with Trigger / AI / Action / Flow Nodes

**What you do:** Open the pipeline canvas, drag a trigger node, connect it to an AI agent node (with a prompt), add a tool action, and run.

**How it works:** React Flow canvas serializes the graph to a `Pipeline.graph` JSON. The pipeline router triggers execution. `pipeline-engine` walks the DAG, executing each node. Real-time status streams via SSE.

**Node categories:** Triggers (manual, cron, webhook), AI (agent, text generation), Actions (HTTP request, database query, code execution, file I/O, email), Flow Control (branch, loop, parallel).

**Status:** ✅ Works for linear/sequential flows. ⚠️ `parallelFork`/`loop` nodes exist but are not truly concurrent/re-iterating yet.

---

## 3. RAG Over Knowledge Bases

**What you do:** Upload documents (PDF, TXT, MD, CSV, JSON) to a knowledge base. When chatting or running a pipeline, the system retrieves relevant chunks and includes them in the LLM context.

**How it works:** Documents are chunked and embedded (default model: `nomic-embed-text` via Ollama), stored in Qdrant. `/knowledge` search returns real Qdrant results. `context-engine` assembles retrieved context for the LLM.

**Status:** ✅ Verified end-to-end with real Qdrant.

---

## 4. MCP (Model Context Protocol) Tool Integration

**What you do:** Connect a MCP server (stdio or streamable-http/SSE), discover its tools, and let your agent call them during a conversation.

**How it works:** `mcp` router → `mcp-client` service → `@modelcontextprotocol/sdk`. Servers are tenant-scoped and persisted in the database. Stdio commands are allowlisted; HTTP endpoints are SSRF-blocklisted.

**Status:** ✅ Real implementation, tested against in-repo demo server.

---

## 5. Agent with Built-In Tools

**What you do:** Chat with an agent that has file read/write, web fetch/search, HTTP request, code execution, and email capabilities.

**How it works:** The agent loop (CALL_TOOL / FINAL_ANSWER) in `llm-router` makes tool calls through `tool-system`. Tools are registered at API startup. Python agent-runtime can also execute tools via `/api/internal/execute-tool`.

**Status:** ✅ Works. ⚠️ `codeExecute` runs in `isolated-vm` sandbox (intentional). Some `flowmind.*` MCP tools are stubs.

---

## 6. Cron-Scheduled Pipelines

**What you do:** Set up a pipeline to run on a schedule (e.g., daily email summary, weekly report).

**How it works:** `jobs` tRPC router + `cron-scheduler` service using `node-cron`. Creates `CronJob` records in the database.

**Status:** ✅ Implemented for local scheduling.

---

## 7. Marketplace for Skills and Flows

**What you do:** Publish a skill (markdown/JS), browse the marketplace, clone featured pipelines, join a community.

**How it works:** `marketplace` tRPC router supports 7 item types (SKILL, PIPELINE, WORKFLOW, PROMPT_PACK, AGENT_TEMPLATE, MCP_INTEGRATION, PLUGIN). The unified `MarketplaceListing` model handles visibility, forks, reviews, and downloads.

**Status:** ✅ Foundation implemented. ⚠️ Marketplace is a marketplace data layer — a full consumer/creator front-end experience is partial.

---

## 8. Automation with Email Notifications

**What you do:** A pipeline node sends an email notification with results (per-user SMTP).

**How it works:** `flowmind.email.send` tool → nodemailer with per-user SMTP config. Verified via local SMTP capture.

**Status:** ✅ Verified locally.

---

## 9. Multi-Step Data Transformation

**What you do:** Extract data from an API, transform it with a JSON `transform` node, query a SQLite database, and write the combined result to a file.

**How it works:** Combination of `http_request` tool (SSRF-guarded), `transform` JSON node, `sqliteQuery` node, and `fileIo` node (traversal-guarded).

**Status:** ✅ All connectors implemented and verified locally.

---

## 10. Collaborative Pipeline Development (HostGroups)

**What you do:** A team creates a HostGroup, proposes changes to a shared pipeline via `PipelineProposal` (PR-style review), and merges approved proposals.

**How it works:** HostGroup membership (OWNER/ADMIN/MEMBER/VIEWER), proposals with base/proposed graphs and diffs, approval/rejection workflow.

**Status:** ✅ Schema + logic implemented. UI completeness varies.
