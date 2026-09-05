# API Contract

This document describes the API surface of `apps/api` as it exists in the
repository: the tRPC procedure style, the wire format, the main routers and
procedures, the REST surface, SSE endpoints, webhook ingest, HTTP status
semantics, and the typed error model.

Sibling documents: [overview.md](./overview.md), [system.md](./system.md),
[backend.md](./backend.md), [database.md](./database.md),
[integrations.md](./integrations.md).

---

## Style

- **Transport**: HTTP. All tRPC procedures live under `/trpc` (Fastify plugin
  prefix, registered in `apps/api/src/index.ts`).
- **Auth**: Bearer JWT in the `Authorization` header for protected procedures.
  The web client attaches the token from the `flowmind_token` cookie.
- **Procedure types**: `publicProcedure` (no auth), `protectedProcedure`
  (auth + tier rate-limit + usage-limit), `adminProcedure` (admin + rate-limit).
  Defined in `apps/api/src/middleware/trpc.ts`.
- **Input validation**: zod schemas inline on every procedure.
- **Batching**: The web client uses tRPC `httpBatchLink`
  (`apps/web/src/lib/trpc.ts`) — multiple procedures may be sent in one HTTP
  request. The client sends a body shaped `{"0": <input>, "1": <input>, ...}`
  and the server responds with an array; the client reads
  `json[0].result.data` etc. A **single** unbatched call returns
  `{ result: { data } }` (this is what `apps/web/src/lib/api/core.ts` expects
  from `json.result?.data` when doing its own fetches).

---

## Routers and key procedures

The app router composes **22 routers** (`apps/api/src/routers/index.ts`).
Procedures listed below were verified from router source.

### auth (`apps/api/src/routers/auth.ts`)

- `auth.register` (public) — email + password (min 8), returns `{ user, token, refreshToken }`
- `auth.login` (public) — email + password, brute-force window via Redis
- `auth.me` (protected)
- `auth.refresh` (public)
- `auth.ssoUrl`, `auth.ssoCallback`, `auth.ssoProviders` (google/github; SAML)
- `auth.requestPasswordReset`, `auth.resetPassword`, `auth.changePassword`
- `auth.samlMetadata`, `auth.samlLogin`, `auth.samlCallback`, `auth.setupSaml`
- `auth.setupMfa`, `auth.getMfaStatus`, `auth.verifyMfa`, `auth.confirmMfa`, `auth.disableMfa`
- `auth.registerWebauthn`, `auth.verifyWebauthn`

### chat (`apps/api/src/routers/chat.ts`)

- `chat.createSession` (protected)
- `chat.getSessions`, `chat.getSession`, `chat.searchSessions` (protected)
- `chat.deleteSession` (protected)
- `chat.sendMessage` (protected) — runs `ChatService.sendMessageWithAgentLoop`,
  returns `{ message, streamUrl, iterations, toolCallCount }`

### pipeline (`apps/api/src/routers/pipeline.ts`)

- `pipeline.list`, `pipeline.create`, `pipeline.update`, `pipeline.delete`
  (protected)
- `pipeline.getById` (protected, owner or group member)
- `pipeline.trigger` (protected) — async; returns `{ runId, status: "RUNNING", ... }`
- `pipeline.cancelRun` (protected)
- `pipeline.resume` (protected) — resumes a run in `AWAITING_APPROVAL` with
  override decisions
- `pipeline.executeNode`, `pipeline.validate`, `pipeline.simulate`,
  `pipeline.loadOptions` (protected)
- `pipeline.getRuns`, `pipeline.getRunLogs`, `pipeline.getBatchStatus` (protected)
- `pipeline.batchTrigger` (protected) — up to 100 inputs, max 4 concurrent runs
- `pipeline.getVersionHistory`, `pipeline.restoreVersion`,
  `pipeline.exportPipeline`, `pipeline.importPipeline` (protected)
- `pipeline.listMarketplace`, `pipeline.getMarketplaceById`,
  `pipeline.marketplaceCategories` (public)
- `pipeline.publishToMarketplace`, `pipeline.cloneFromMarketplace` (protected)

### tools-v2 (`apps/api/src/routers/tools-v2.ts`)

- `toolsV2.listTools`, `toolsV2.getTool`, `toolsV2.approveToolExecution`,
  `toolsV2.executeTool` (protected)
- `toolsV2.getPermissionRules`, `toolsV2.updatePermissionRules`,
  `toolsV2.evaluatePermission` (protected)
- `toolsV2.lspOpenFile`, `toolsV2.lspGoToDefinition`,
  `toolsV2.lspFindReferences`, `toolsV2.lspGetHover`,
  `toolsV2.lspGetDiagnostics` (protected)
- `toolsV2.snapshotCreate`, `toolsV2.snapshotRevert`,
  `toolsV2.snapshotRestore`, `toolsV2.snapshotDiff`,
  `toolsV2.snapshotHistory` (protected)
- `toolsV2.sessionCompact`, `toolsV2.sessionGetMessages`,
  `toolsV2.sessionEstimateTokens`, `toolsV2.sessionClear` (protected)
- `toolsV2.listProviders`, `toolsV2.listModels`, `toolsV2.searchModels`,
  `toolsV2.getModel`, `toolsV2.setProviderKey`, `toolsV2.getProviderKeys`
  (protected)
- `toolsV2.listPlugins`, `toolsV2.loadPluginDir`, `toolsV2.updateTodos`

### mcp (`apps/api/src/routers/mcp.ts`)

- `mcp.list`, `mcp.create`, `mcp.delete`, `mcp.toggle` (protected)
- `mcp.providers` (public)
- `mcp.tools` (protected)
- `mcp.oauthInitiate` (protected), `mcp.oauthCallback` (public)
- `mcp.execute` (protected)

### webhooks (`apps/api/src/routers/webhooks.ts`)

- `webhooks.ingest` (public) — channel `telegram|slack|discord|whatsapp|generic`
- `webhooks.telegram`, `webhooks.slack`, `webhooks.discord`,
  `webhooks.whatsapp` (public)

All webhook procedures verify a channel secret (env
`TELEGRAM_WEBHOOK_SECRET`/`SLACK_WEBHOOK_SECRET`/`DISCORD_WEBHOOK_SECRET`/
`WHATSAPP_WEBHOOK_SECRET` or shared `WEBHOOK_SECRET`; dev allows unverified
when no secret is set and `ALLOW_UNVERIFIED_WEBHOOKS=true`). They forward
payloads to `${AGENT_RUNTIME_URL}/webhook/ingest` — which does **not exist** in
the agent-runtime (see [overview.md](./overview.md) "Known stubs / dead-ends").

### skills (`apps/api/src/routers/skills.ts`)

- `skills.list`, `skills.search`, `skills.getById`, `skills.versions` (public)
- `skills.install`, `skills.publish`, `skills.run`, `skills.delete` (protected)

### billing (`apps/api/src/routers/billing.ts`)

- `billing.getSubscription`, `billing.createCheckout`, `billing.createPortalSession`
- `billing.getUsage`, `billing.getInvoices`
- `billing.getOrgSubscription`, `billing.createOrgCheckout`, `billing.updateOrgMemberLimit`

Without `STRIPE_SECRET_KEY`, `createCheckout`/`createPortalSession` throw
`INTERNAL_SERVER_ERROR` with message `"Billing is not configured. Contact the
administrator."` unless `ENABLE_DEV_BILLING_MOCK=true` (dev only).

### knowledge (`apps/api/src/routers/knowledge.ts`)

- `knowledge.list`, `knowledge.getById`, `knowledge.create`, `knowledge.delete`
- `knowledge.uploadDocument`, `knowledge.deleteDocument`, `knowledge.search`

### marketplace (`apps/api/src/routers/marketplace.ts`)

- `marketplace.list`, `marketplace.getById`, `marketplace.getTypes` (public)
- `marketplace.clone`, `marketplace.search`, `marketplace.publish`,
  `marketplace.rate`, `marketplace.getByOwner`, `marketplace.createVersion`
  (protected)

### Other routers

`settings`, `models`, `jobs`, `tools` (v1), `files`, `agents`, `console`,
`notifications`, `context`, `runtime`, `host`, `system` — all listed in
[backend.md](./backend.md). Example key procedures:

- `settings.updateProfile`, `settings.getApiKeys`, `settings.createApiKey`,
  `settings.getConnections`, `settings.getMemories`, `settings.getAuditLog`,
  `settings.exportData`, `settings.deleteAccount`
- `models.list`, `models.getProviders`, `models.pullModel`,
  `models.deleteModel`, `models.searchModels`, `models.getRuntimeHealth`
- `jobs.list`, `jobs.create`, `jobs.update`, `jobs.delete`, `jobs.toggle`
- `tools.list`, `tools.execute`, `tools.toggle`, `tools.test`
- `notifications.sendEmail`, `notifications.list`, `notifications.markRead`,
  `notifications.markAllRead`
- `context.getSessions`, `context.getSkills`, `context.getMemories`,
  `context.deleteMemory`, `context.deleteSession`, `context.enableSkill`
- `runtime.list` (public), `runtime.register`/`runtime.unregister`/
  `runtime.dispatch` (admin), `runtime.healthCheck` (public)
- `system.getFrameworks` (public), `system.getMetrics`,
  `system.getRecentActivity`, `system.getGPUMetrics` (protected),
  `system.startFramework`/`system.stopFramework`/`system.killProcess` (admin)

---

## REST surface

`apps/api/src/index.ts` also registers plain Fastify routes:

| Method + path | Auth | Purpose |
|---------------|------|---------|
| `GET /health` | none | DB + agent-runtime probe; 200/503 + `{ status, version, uptime, checks }` |
| `GET /metrics` | Bearer `AGENT_API_KEY`/`INTERNAL_API_KEY` | Prometheus metrics (denied in prod without token) |
| `GET /api/chat/stream/:sessionId` | JWT in `Authorization` (Bearer) or `?token` (dev) | SSE chat stream |
| `GET /api/pipeline/stream/:runId` | JWT Bearer (or dev `?token`) | SSE pipeline stream |
| `POST /api/internal/create-pipeline` | `AGENT_API_KEY`/`INTERNAL_API_KEY` (`x-internal-token` or Bearer) | Internal: create a 2-node manual pipeline |
| `POST /api/internal/execute-tool` | same internal token | Internal: run a registered tool |
| `POST /api/stripe/webhook` | Stripe `stripe-signature` header | Stripe webhook (raw body) |

`GET /login` is not an API route — `/login` is a Next.js page in `apps/web`
(`apps/web/src/app/login/page.tsx`).

---

## SSE endpoints

Both SSE endpoints send `text/event-stream`, with a `: connected` comment, a
15-second heartbeat, a 120-second idle timeout, and a `[DONE]` terminator.

- **Chat** `GET /api/chat/stream/:sessionId`
  - Events: `step` (each `AgentLoopStep`), `done`, `error`.
- **Pipeline** `GET /api/pipeline/stream/:runId`
  - Events: `node` (running/completed/failed per node), `done`, `error`.

---

## HTTP status semantics

- tRPC errors map to HTTP statuses through the Fastify adapter. Common codes
  observed in the routers:
  - `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404 on
    cross-user/tenant access to avoid leaking existence), `CONFLICT` (409),
    `TOO_MANY_REQUESTS` (429), `BAD_REQUEST` (400),
    `INTERNAL_SERVER_ERROR` (500), `BAD_GATEWAY` (502).
- The REST routes use plain status codes: 200/503 for `/health`, 401/404 on SSE
  validation, 401/400/404/500 on internal endpoints, 400 on Stripe signature
  failure.

---

## Error model

`packages/errors/src/index.ts` defines `FlowMindError` with a `code`,
`statusCode`, `retryable`, and optional `context`, plus a typed hierarchy:

| Class | Code | HTTP |
|-------|------|------|
| `FlowMindError` | user-supplied | (default 500) |
| `PipelineError` | `PIPELINE_ERROR` | 500 |
| `NodeExecutionError` | `NODE_EXECUTION_ERROR` | 500 |
| `GraphValidationError` | `GRAPH_VALIDATION_ERROR` | 400 |
| `CredentialError` | `CREDENTIAL_ERROR` | 401 |
| `LLMError` | `LLM_ERROR` | 502 (retryable) |
| `ProviderUnavailableError` | `PROVIDER_UNAVAILABLE` | 502 (retryable) |
| `RateLimitError` | `RATE_LIMIT_ERROR` | 502 (retryable) |
| `ContextLengthError` | `CONTEXT_LENGTH_ERROR` | 502 |
| `SkillError` | `SKILL_ERROR` | 500 |
| `MCPError` | `MCP_ERROR` | 502 (retryable) |
| `ToolNotFoundError` | `TOOL_NOT_FOUND` | 404 |
| `ToolExecutionError` | `TOOL_EXECUTION_ERROR` | 500 |
| `ChannelError` | `CHANNEL_ERROR` | 502 (retryable) |
| `AuthError` | `AUTH_ERROR` | 401 |
| `BillingError` | `BILLING_ERROR` | 402 |
| `QuotaExceededError` | `QUOTA_EXCEEDED` | 402 |
| `SeatLimitError` | `SEAT_LIMIT_EXCEEDED` | 402 |
| `DowngradeError` | `DOWNGRADE_NOT_ALLOWED` | 402 |
| `TierNotAllowedError` | `TIER_NOT_ALLOWED` | 402 |

The web client maps failures to `ApiError` (`apps/web/src/lib/api/core.ts`)
with `code` + `httpStatus` and a user-facing message (including auto-refresh
on 401).