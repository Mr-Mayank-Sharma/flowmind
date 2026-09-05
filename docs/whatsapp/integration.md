# WhatsApp Integration Checklist

This is the action list for making WhatsApp truly functional. It documents what
a developer must wire, the environment and Meta configuration needed, the current
blockers, and a recommended (prioritized) fix path. **This document only
describes the work; no code is changed here.**

Related docs: [overview.md](./overview.md), [architecture.md](./architecture.md),
[workflow.md](./workflow.md), [data-model.md](./data-model.md),
[../architecture/integrations.md](../architecture/integrations.md).

---

## Current blockers (in priority order)

1. **Meta verify GET handshake is MISSING.** Meta will not deliver webhooks
   until the endpoint answers a `GET` with `hub.mode` / `hub.verify_token` /
   `hub.challenge`. No such route exists for any channel.
2. **`/webhook/ingest` does not exist on the Python agent runtime.** Every
   inbound webhook and every pipeline channel send forwards there and gets a 502.
3. **The WhatsApp adapter is never instantiated.** `WHATSAPP_PHONE_NUMBER_ID`
   and `WHATSAPP_ACCESS_TOKEN` are read by no code; `ChannelGateway.registerAdapter`
   is never called in production.
4. **The normalizer shape mismatch.** `normalizeWhatsApp` expects Baileys
   payloads (`key.remoteJid`, `mediaKey`, ...) that no producer emits; the real
   inbound shape is the Meta Graph envelope (handled by `extractText` /
   `handleUpdate`).
5. **No persistence decision.** There is no first-class store for inbound or
   outbound WhatsApp messages (see [data-model.md](./data-model.md)).

---

## What must change (prioritized)

### 1. Add the Meta GET verification handshake

Add a GET route (e.g. `GET /webhook/whatsapp` or under the existing webhooks
router) that:

- answers Meta's challenge when `hub.mode === "subscribe"` and
  `hub.verify_token` matches the configured token;
- returns `hub.challenge` as a plain `text/plain` 200;
- returns 403 otherwise.

The token must match what is configured in the Meta app dashboard. The root
`.env.example` already documents `WHATSAPP_VERIFY_TOKEN`, but no code reads it
today — this is the natural consumer.

Channel: `apps/api/src/routers/webhooks.ts`.

### 2. Make inbound delivery reach a real handler

Two viable options:

- **Option A — implement the runtime route (completes the current design).**
  Add `POST /webhook/ingest` to `packages/agent-runtime/src/main.py`, accepting
  `{channel, payload}` and feeding the message into the agent orchestration (the
  runtime already has `/chat/*` and `/llm/generate` it could reuse). This matches
  what `forwardToAgentRuntime` already calls.
- **Option B — handle WhatsApp inbound directly in the API channel layer.**
  Replace the `webhooks.whatsapp` forward with an in-process path: construct the
  `WhatsAppAdapter`, call `handleUpdate` to normalize, then invoke the agent
  response path from the API. This removes the Python dependency for WhatsApp but
  diverges from the design used by the other channels.

Either way the extracted message must reach the agent/pipeline and a reply path
must exist.

### 3. Wire the outbound adapter

- Instantiate `WhatsAppAdapter` from `WHATSAPP_PHONE_NUMBER_ID` +
  `WHATSAPP_ACCESS_TOKEN` (API version `v21.0` unless bumped).
- `registerAdapter` it on the `ChannelGateway` (or otherwise inject it where the
  channel send path lives) at application boot.
- Change the pipeline `integrationNode` / send runners
  (`packages/pipeline-engine/src/runners.ts`) and/or the API channel layer to
  call `sendMessage` with the reply `OutgoingMessage`, instead of POSTing into
  the dead-end `webhooks.ingest`.

`WhatsAppAdapter.sendMessage` already implements the correct Graph API POST
(text, media, voice, reply context) and needs no changes.

### 4. Reconcile the payload shape in the normalizer

Decide on the canonical inbound shape. The Graph envelope is the real producer;
`normalizeWhatsApp` `(message-normalizer.ts` lines 93-113) expects Baileys fields.
Either:

- rework `normalizeWhatsApp` to consume Graph-shaped payloads (or reuse the
  parsing logic from `WhatsAppAdapter.handleUpdate` / `extractText`), or
- remove the Baileys variant and keep a single WhatsApp normalizer.

The adapter's `handleUpdate` already produces a `ChannelMessage`; prefer routing
through that instead of maintaining a second, incompatible parser.

### 5. Decide on message persistence

There is no WhatsApp table, and `Session`/`Message`/`McpToken` are for the chat UI
and MCP credentials respectively (see [data-model.md](./data-model.md)). Decide
whether WhatsApp needs first-class persistence:

- **No (MVP):** keep messages transient; document that history/audit is out of
  scope.
- **Yes:** add a channel-message model (e.g. `ChannelMessage` with channel type,
  wa user id, text, media refs, direction, status) or extend `Message` with a
  channel discriminator. Do not reuse `McpToken` for WhatsApp credentials.

---

## Environment setup

| Variable | Purpose | Location |
|----------|---------|----------|
| `WHATSAPP_PHONE_NUMBER_ID` | Required to construct the adapter | root `.env.example` line 38 |
| `WHATSAPP_ACCESS_TOKEN` | Bearer token for Graph API calls (outbound + media resolution) | root `.env.example` line 39 |
| `WHATSAPP_VERIFY_TOKEN` | Expected token for the Meta GET verify handshake (currently unused) | root `.env.example` line 40 |
| `WHATSAPP_WEBHOOK_SECRET` | Shared secret checked on inbound webhook POSTs | `apps/api/.env.example` line 40 |
| `WEBHOOK_SECRET` | Fallback webhook secret | `apps/api/.env.example` line 36 |
| `AGENT_RUNTIME_URL` | Where `forwardToAgentRuntime` posts (default `http://localhost:8001`) | `apps/api/.env.example` line 13 |
| `ALLOW_UNVERIFIED_WEBHOOKS` | Dev-only bypass for webhook secret checks (production rejects when unset) | `apps/api/.env.example` line 42 |

The first three exist in `.env.example` but are **not read by code** — wiring them
is part of the checklist.

---

## Meta developer configuration

- Create an app in the Meta developer portal and enable the WhatsApp product.
- Copy the phone number id and generate a permanent access token.
- Add the senders' phone numbers as approved recipients while in test mode
  (this restricts whom your app can message until the app passes review).
- Register the webhook to point at the API WhatsApp webhook URL.
- Configure `Verify token` in Meta to match `WHATSAPP_VERIFY_TOKEN`.
- Subscribe to the `messages` field so the `messages` webhook delivers.
- For media, the token must have `whatsapp_business_messaging` scope so the
  media resolution GET succeeds.

---

## Recommended fix path (summary)

1. **Wire the adapter** — instantiate + register `WhatsAppAdapter`; make the
   send path call it. (Smallest change, unblocks outbound.)
2. **Add the verify GET route** — unblocks Meta from delivering inbound webhooks.
3. **Implement Option A or B for inbound ingestion** — A (Python route) preserves
   the current design; B (API channel layer) removes the Python hop.
4. **Fix the normalizer** — one canonical WhatsApp shape (Graph), not Baileys.
5. **Decide persistence** — add a channel-message store or explicitly defer.

After any change to `apps/api` or `packages/pipeline-engine`, run
`tsc --noEmit` in those projects and keep both at zero TypeScript errors.