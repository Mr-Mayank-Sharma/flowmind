# FlowMind — Master Implementation Prompt (Verified Against Source Code)

## How to use this prompt

Feed this to an AI coding assistant (Claude, GPT-4, Cursor, etc.) along with access to your repo. It covers all 4 phases in priority order. Each phase is self-contained — you can run them sequentially across sessions.

---

## MASTER PROMPT

```
You are a senior full-stack engineer working on FlowMind — an open-source Agent OS built with TypeScript, React, ReactFlow, Prisma, tRPC, and Electron. The repo is at the current working directory.

## Project Context

FlowMind is a centralized platform to run AI agents, models, and tools. Monorepo with pnpm + Turborepo. 21 packages, 4 apps.

### Key existing packages (verified by source code audit):
- `packages/pipeline-engine/`: DAG execution engine. `engine.ts` has full execution with retry, abort, validation. `runners.ts` has 22+ node type runners (triggers, AI nodes, action nodes, flow control). Has `__tests__/` with 28 passing tests. IMPORTANT: AI node runners call `llmGenerate()` which hits the Python agent runtime at `AGENT_RUNTIME_URL/llm/generate` directly — they do NOT use the llm-router package.
- `packages/llm-router/`: LLM provider abstraction. `engine.ts` has 3 native providers (OpenAI, Anthropic, Google) + 14 OpenAI-compatible providers (Groq, DeepSeek, OpenRouter, Together, Mistral, Azure, Perplexity, DeepInfra, Cerebras, xAI, Cohere, Cloudflare, Venice AI, Alibaba). Has complete(), stream(), streamAsync(). NOT wired to pipeline engine.
- `packages/ollama-proxy/`: Standalone Ollama API proxy. ModelManager (list, pull, delete), generate, generateStream, getEmbeddings, checkHealth, GPU detection, cloud fallback badges. NOT integrated with llm-router.
- `packages/mcp-executor/`: MCP tool server registry, connection pool, tool router, OAuth providers (GitHub, Slack, Google, Linear).
- `packages/skill-engine/`: Sandboxed JS execution via isolated-vm, Prisma-backed, version tracking. Basic.
- `packages/channel-gateway/`: 6 adapters (Telegram, Slack, Discord, WhatsApp, Email).
- `packages/context-engine/`: Qdrant vector search + Ollama embeddings.
- `packages/session-engine/`: Message tracking, token compaction, event sourcing.
- `packages/tool-system/`: 10 built-in tools (edit, write, read, grep, glob, bash, webfetch, websearch, apply_patch, todo).
- `apps/api/`: Fastify + tRPC server. 20 routers (agents, auth, billing, chat, console, context, files, jobs, knowledge, marketplace, mcp, models, notifications, pipeline, playground, settings, system, tools, tools-v2, webhooks). Services: ChatService.ts (one-shot, no agent loop), MetricsService.ts.
- `apps/web/`: Next.js 14. Components: chat/, pipeline/ (pipeline-canvas.tsx, custom-nodes.tsx, inspector-panel.tsx, node-palette.tsx, pipeline-toolbar.tsx, runs-panel.tsx), marketplace/, home/, framework/, ui/.
- `apps/cli/`: CLI tool.
- `apps/desktop/`: Electron app.

### Critical architecture issue to fix first:
The pipeline AI node runners in `runners.ts` call `llmGenerate()` which hits the Python agent runtime directly. The `llm-router` package with 20 providers is a completely separate code path. These must be unified — pipeline nodes should call through llm-router, not the Python runtime directly.

### Coding Standards (from AGENTS.md)
- TypeScript with strict types, no `any` where avoidable
- Follow existing patterns in the codebase
- No comments unless necessary
- Use Lucide icons, never emoji strings
- Always run `tsc --noEmit` on both `apps/api` and `apps/web` after changes
- Keep both projects at zero TypeScript errors
- Be direct and concise — no preamble, no postamble
- Commit after each task: `feat(scope): description` or `fix(scope): description`

---

## PHASE 1: Fix Architecture + Make It Work End-to-End

### Task 1.1: Unify LLM Calling Path (HIGHEST PRIORITY)

Goal: Pipeline AI nodes use llm-router instead of calling Python agent runtime directly. All 20 providers become available to pipeline nodes.

Implementation:
1. In `packages/pipeline-engine/src/runners.ts`, replace the `llmGenerate()` function that calls `AGENT_RUNTIME_URL/llm/generate` with a call to `LLMEngine.complete()` from `@flowmind/llm-router`.
2. Add llm-router as a dependency of pipeline-engine in its package.json.
3. Modify the `llmGenerate()` function signature to accept a provider and model parameter, then route through `LLMEngine.complete()` with the appropriate provider.
4. Update each AI runner (aiAgent, contentWriter, dataExtractor, classifier, summarizer, webResearcher) to pass the model config from the node config to the LLM call, so users can select which provider/model to use per node.
5. In `apps/api/src/routers/pipeline.ts`, update the `loadOptions` procedure to fetch real available models from the llm-router engine based on configured API keys, instead of the hardcoded list in `engine.ts` defaultLoadOptions.
6. Add an `LLMEngine` instance to the pipeline execution context so all runners share the same configured engine.
7. Remove the direct `AGENT_RUNTIME_URL` dependency from runners.ts for LLM calls (keep it for agent-specific features if needed).
8. Run `tsc --noEmit` on both apps/api and apps/web. Fix any type errors.
9. Write test: mock llm-router, verify pipeline AI node calls go through LLMEngine.complete().

### Task 1.2: Merge Ollama into LLM Router as First-Class Provider

Goal: Local models appear alongside cloud models in llm-router. Selecting a local model routes through Ollama directly.

Implementation:
1. In `packages/llm-router/src/providers/`, create `ollama.ts` with an `OllamaProvider` class implementing `ProviderFacade`:
   - `listModels()`: calls Ollama `/api/tags`, returns models formatted as provider models
   - `complete(req)`: calls Ollama `/api/chat` or `/api/generate` with the messages
   - `stream(req, callbacks)`: streams from Ollama `/api/generate` with `stream: true`
   - `embed(text)`: calls Ollama `/api/embeddings`
2. Register Ollama as a provider in `engine.ts` with type `local`. Auto-register on engine init if Ollama is available (ping `http://localhost:11434/api/tags`).
3. Add an `ollamaBaseUrl` config option to `LLMConfig` (default `http://localhost:11434`).
4. Update `loadOptions` in pipeline router to include Ollama models in the response, with a `local: true` flag.
5. In the web UI model picker (wherever models are selected), show local models with a "Local" badge.
6. Refactor `packages/ollama-proxy/` to re-export from the new OllamaProvider, or mark it as deprecated with a redirect.
7. Run `tsc --noEmit`. Fix type errors.
8. Write test: mock Ollama API, verify model listing, completion, and embedding work through llm-router.

### Task 1.3: Upgrade Canvas Status Streaming

Goal: Replace 400ms polling with real-time streaming. Show node outputs, not just status.

Implementation:
1. In `apps/api/src/routers/pipeline.ts`, add a tRPC subscription `onRunStatus` using SSE/WebSocket that streams node status events as they happen (using the existing `onNodeStatus` callback in PipelineEngine).
2. In `apps/web/src/components/pipeline/pipeline-canvas.tsx`, replace the `setInterval(400ms)` polling in `onRun` with a subscription to the new `onRunStatus` procedure.
3. Update node visual states in real-time: pending (default), running (blue border + spinner), completed (green + checkmark), failed (red + error tooltip).
4. Show node output data on hover or in inspector panel after completion.
5. Add a "Cancel Run" button that sends an abort signal to the pipeline engine.
6. Run `tsc --noEmit`. Fix type errors.
7. Test: create a 2-node pipeline, trigger run, verify real-time status updates without polling.

### Task 1.4: Implement Iterative Agent Chat Loop

Goal: Chat is no longer one-shot. The agent calls tools, sees results, and decides next steps in a loop.

Implementation:
1. In `apps/api/src/services/ChatService.ts`, replace the single `callAgentRuntime()` flow with an agent loop:
   ```
   let messages = [systemPrompt, userMessage]
   let done = false
   let iterations = 0
   while (!done && iterations < maxIterations) {
     const response = await llmEngine.complete({ messages, tools: toolSystem.getToolDefinitions(), model })
     if (response.toolCalls && response.toolCalls.length > 0) {
       for (const toolCall of response.toolCalls) {
         const result = await toolSystem.execute(toolCall.name, toolCall.args)
         messages.push({ role: "tool", content: result, toolCallId: toolCall.id })
       }
       iterations++
       continue
     } else {
       reply = response.content
       done = true
     }
   }
   ```
2. Use `LLMEngine` from `@flowmind/llm-router` instead of the Python agent runtime for LLM calls.
3. Use `ToolSystem` from `@flowmind/tool-system` for tool execution.
4. Use `SessionEngine` from `@flowmind/session-engine` for token compaction when conversation exceeds context window.
5. Keep the existing `ContextEngine` integration (Qdrant search before sending).
6. Stream the loop to the web UI via SSE: show each tool call, tool result, and agent reasoning as it happens.
7. Add `maxIterations` config (default: 25) and `maxTokens` guard.
8. Add a "Stop" button in the chat UI that aborts the loop.
9. If a tool fails, feed the error back to the LLM (don't crash the loop).
10. Run `tsc --noEmit`. Fix type errors.
11. Write test: mock LLM + tools, send "read ./test.txt and summarize", verify agent calls read tool, gets content, then summarizes.

---

## PHASE 2: Skill Registry + Marketplace

### Task 2.1: Skill Packaging Format + Registry

Goal: Skills can be packaged, published to marketplace, cloned by others, and run in any FlowMind instance.

Implementation:
1. Define `skill.json` spec:
   ```json
   {
     "name": "seo-optimizer",
     "version": "1.0.0",
     "description": "Analyzes and optimizes webpage SEO",
     "author": "mayank",
     "runtime": "sandboxed-js",
     "entryPoint": "./index.js",
     "inputs": [{ "name": "url", "type": "string", "required": true }],
     "outputs": [{ "name": "report", "type": "object" }],
     "permissions": ["webfetch", "filewrite"],
     "compatibility": ">=1.0.0"
   }
   ```
2. Add `flowmind skill create <name>` CLI command (in apps/cli) that scaffolds skill.json + index.js template.
3. Add `flowmind skill publish` CLI command that validates skill.json and publishes to marketplace via tRPC API.
4. Add `flowmind skill install <name>` CLI command that fetches from marketplace, downloads, installs to local skills directory.
5. Add `flowmind skill list` and `flowmind skill run <name> --input '{}'` commands.
6. In the web marketplace, add a "Skills" tab. Show skill cards with description, author, version, install count, "Install" button.
7. Update `skill-engine` to load skills from installed skills directory and expose them as pipeline node types (drop a skill onto canvas as a node).
8. Add version tracking: bump version on update, keep history, allow pinning to specific version.
9. Add a new tRPC router `skills.ts` with: list, getById, install, publish, run, delete procedures.
10. Run `tsc --noEmit`. Fix type errors.
11. Write tests: create skill, publish, install in fresh instance, run with input, verify output.

### Task 2.2: Seed 5 Real Workflows

Goal: Marketplace has 5 workflows that work end-to-end. Not stubs.

1. **SEO Optimization Pipeline**
   - Nodes: HTTP Fetch (URL) → HTML Parser → AI Analyzer (LLM via llm-router) → AI Optimizer → Output Report
   - Inputs: website URL, target keywords
   - Outputs: JSON report with before/after meta tags, content suggestions, SEO score

2. **Email Triage Pipeline**
   - Trigger: Cron (default 7AM)
   - Nodes: Fetch Unread Emails (IMAP) → AI Classifier (urgent/newsletter/personal) → AI Summarizer → Send to Telegram
   - Inputs: email credentials, Telegram chat ID
   - Outputs: Telegram message with categorized email summary

3. **AI Code Review Pipeline**
   - Trigger: GitHub Webhook (PR opened)
   - Nodes: Fetch PR Diff (GitHub API) → AI Analyzer → Format Review → Post to GitHub
   - Inputs: GitHub repo, PR number
   - Outputs: GitHub PR comment with review

4. **Content Generation Pipeline**
   - Nodes: Topic Input → Web Research (websearch + webfetch) → AI Writer → AI SEO Optimizer → Output
   - Inputs: topic, target keywords, tone
   - Outputs: markdown article with meta description, title tag

5. **Data Extraction Pipeline**
   - Nodes: Input (URL) → Content Fetcher → AI Extractor (structured data from schema) → JSON Validator → Output
   - Inputs: source URL, extraction JSON schema
   - Outputs: structured JSON matching schema

For each: create in database, export to marketplace format, publish, verify clone + run works in fresh instance.

---

## PHASE 3: Control Plane — Integration Protocol

### Task 3.1: Integration Protocol Spec + MCP Extension

Goal: Any tool that speaks MCP can register. Any agent runtime with HTTP API is a dispatch target.

Implementation:
1. Write `docs/integration-protocol.md`: how external tools register (MCP or HTTP adapter), how runtimes register (POST `/api/runtime/register` with capabilities manifest), how FlowMind routes tasks.
2. Extend `mcp-executor` to support dynamic registration at runtime via API.
3. Add a `runtime-registry` package tracking all registered agent runtimes + capabilities.
4. Add a `dispatch` method that takes task + requirements and routes to best matching runtime.
5. Add "Runtimes" settings page in web UI.
6. Write tests: register mock runtime, dispatch task, verify routing.

### Task 3.2: OpenHuman Adapter

Goal: OpenHuman integrated as channel gateway adapter and pipeline tool.

Implementation:
1. Read OpenHuman API at https://github.com/tinyhumansai/openhuman.
2. Create `openhuman-adapter.ts` in channel-gateway following existing adapter patterns (authenticate, receiveMessage, sendMessage, normalizeMessage).
3. Register as channel in channel-gateway.
4. Add as pipeline node type.
5. Add to web UI channels settings.
6. Write tests: mock OpenHuman API, verify send/receive/normalize.

---

## PHASE 4: Production Quality

### Task 4.1: Test Suite
1. Set up Vitest across all packages.
2. Integration tests: llm-router (mock each provider), Ollama provider, MCP executor, chat loop, canvas→execution, marketplace clone+run, skill engine.
3. Set up CI to run tests on push.
4. Target: 80% coverage on pipeline-engine, llm-router, mcp-executor, ChatService, skill-engine.

### Task 4.2: Error Handling
1. Create `packages/errors/src/index.ts` with typed error classes: PipelineError, NodeExecutionError, GraphValidationError, CredentialError, LLMError, ProviderUnavailableError, RateLimitError, ContextLengthError, SkillError, MCPError, ToolNotFoundError, ToolExecutionError, ChannelError, AuthError.
2. Replace all string error returns with typed throws.
3. Add retry policies per error type.
4. Add dead letter queue for failed pipeline runs.
5. Surface errors in UI: node tooltips, chat banners, marketplace error states.

### Task 4.3: Documentation
1. `docs/getting-started.md`: install, configure, first pipeline, first chat
2. `docs/architecture.md`: system overview, package relationships, data flow
3. `docs/api-reference.md`: all tRPC endpoints
4. `docs/skill-development.md`: skill.json spec, creating, publishing, permissions
5. `docs/pipeline-authoring.md`: node types, expression engine, triggers, credentials
6. `docs/self-hosting.md`: Docker, env vars, database, Ollama, production deploy
7. `docs/integration-protocol.md`: how external tools register
8. Update README.md: one-line pitch, GIF, quick start, 3 demo workflows, architecture diagram, star CTA.

---

## EXECUTION RULES

1. Work through tasks in order. Do not skip ahead.
2. After each task: run `tsc --noEmit` on both apps/api and apps/web, run existing tests, run new tests, commit.
3. If you encounter a bug in existing code, fix it and note it in the commit.
4. If a task requires a decision not covered here, make the simplest choice that works and note it.
5. Do not add features not described in this prompt. No scope creep.
6. If you can't test something (no API keys, no running services), write mock-based tests with TODO comments for real API testing.
7. After completing all tasks in a phase, write a summary of what was done, what was skipped, and what needs manual verification.

Start with Task 1.1. Begin now.
```
