# WhatsApp Integration Architecture

This document maps the WhatsApp integration as it exists in code. Every
component is explicitly labeled **REAL**, **STUB**, **DEAD-END**, or **MISSING**
so readers can reason about exactly what works today.

Related docs: [overview.md](./overview.md), [workflow.md](./workflow.md),
[data-model.md](./data-model.md), [integration.md](./integration.md),
[../architecture/integrations.md](../architecture/integrations.md).

---

## Component map

| Component | Path | Status |
|-----------|------|--------|
| `WhatsAppAdapter` (outbound + inbound parse) | `packages/channel-gateway/src/adapters/whatsapp.ts` | **REAL** (outbound) / **REAL** (parse) / `setupWebhook` **STUB** |
| `ChannelAdapter` interface / `ChannelGateway` | `packages/channel-gateway/src/index.ts` | **REAL** code, **NOT WIRED** into apps/api |
| `normalizeWhatsApp` | `packages/channel-gateway/src/message-normalizer.ts` (lines 93-113) | **REAL** but vestigial (Baileys shape, no producer) |
| `webhooks.whatsapp` route | `apps/api/src/routers/webhooks.ts` (line 103) | **REAL**; forward is **DEAD-END** |
| `webhooks.ingest` route | `apps/api/src/routers/webhooks.ts` (line 112) | **REAL**; forward is **DEAD-END** |
| Agent runtime `/webhook/ingest` | `packages/agent-runtime/src/main.py` | **MISSING** |
| Meta verify GET handshake | anywhere | **MISSING** |
| Pipeline `integrationNode` / send runners | `packages/pipeline-engine/src/runners.ts` (lines 880-907) | **REAL** code, **DEAD-END** target |
| WhatsApp message templates | anywhere | **MISSING** |
| WhatsApp persistence tables | Prisma schema | **MISSING** |

---

## 1. The adapter — `WhatsAppAdapter` (**REAL outbound; stub setupWebhook**)

File: `packages/channel-gateway/src/adapters/whatsapp.ts`

Constructed as `new WhatsAppAdapter(phoneNumberId, accessToken, apiVersion = "v21.0")`.

### Outbound — `sendMessage` (**REAL**)

`sendMessage(message)` posts to
`https://graph.facebook.com/{apiVersion}/{phoneNumberId}/messages` with:

- text body: `{ messaging_product: "whatsapp", to, text: { body }, context?: { message_id } }`
- media (files): one request per file, typed by MIME prefix into
  `image` / `video` / `audio` / `document`, with `link` and optional `caption`
  (the text becomes a caption on media).
- voice: `audio` with `link` from `message.voiceUrl`.

This is a genuine Meta Graph API outbound call and would deliver a real message
if invoked.

### Inbound — `handleUpdate` (**REAL** parse)

`handleUpdate(payload)` unwraps the Meta webhook envelope:
`entry[0].changes[0].value.messages[0]`. It:

- reads the text from `msg.text.body` or `msg.caption`;
- detects media (`image` / `video` / `audio` / `document`) and its `id`;
- resolves the media id to a download URL via
  `GET https://graph.facebook.com/{apiVersion}/{mediaId}` with the bearer token;
- returns a normalized `ChannelMessage` with `channelId`/`userId` from
  `msg.from` / `contact.wa_id`, reply context from `msg.context.id`, and
  `metadata.wamId` from the entry id.

The parse logic is real and matches Meta's Graph webhook schema.

### `setupWebhook` (**STUB**)

```ts
async setupWebhook(url: string): Promise<void> {
  await Promise.resolve(url)   // no-op
}
```

Meta does not support a runtime `setWebhook`-style API the way Telegram does, so
this is a declared no-op. It does not perform the Meta verify handshake.

---

## 2. The gateway — `ChannelGateway` (**REAL code, NOT WIRED**)

File: `packages/channel-gateway/src/index.ts`

Defines the `ChannelAdapter` interface (`sendMessage`, optional `handleUpdate`,
optional `setupWebhook`) and a `ChannelGateway` that registers adapters and
dispatches sends/incoming/webhook setup.

- The interface and gateway are real TypeScript.
- **`registerAdapter` is never called** anywhere in the repo. `getAdapter`,
  `processIncoming`, `setupWebhook`, and `sendMessage` (gateway-level) are never
  invoked from production code.
- The gateway and adapters are only exercised in tests
  (`packages/channel-gateway/src/__tests__/whatsapp.test.ts` and others).
- No adapter — WhatsApp included — is wired into `apps/api` boot.

Other adapters in the same package (telegram/slack/discord/email/openhuman) are
real code but equally unwired. Only `telegram` and `openhuman` implement a real
`setupWebhook`; `slack`, `discord`, `whatsapp`, and `email` are no-op stubs.

---

## 3. The normalizer — `normalizeWhatsApp` (**REAL but vestigial**)

File: `packages/channel-gateway/src/message-normalizer.ts` (lines 93-113)

`normalizeWhatsApp` reads **Baileys-shaped** fields:

- `key.remoteJid` / `chatId` for the channel id;
- `key.participant` / `author` for the user id;
- `key.id` / `id` for the message id;
- `mediaKey` / `mimetype` / `fileName` for media.

Baileys is the Node library for the unofficial WhatsApp Web protocol. A grep for
`baileys` / `bridge` / `self-chat` in the repo returns nothing. There is **no
producer** of this payload shape, and WhatsApp has no Baileys dependency. This
normalizer is a vestigial bridge interface that would never receive the Graph
envelope it is meant to handle — the actual Graph shape is parsed by
`WhatsAppAdapter.handleUpdate` and by `extractText("whatsapp", ...)` in the webhook
router instead.

---

## 4. Webhook routes — `apps/api` (**REAL; forward is DEAD-END**)

File: `apps/api/src/routers/webhooks.ts`

Two mutation routes accept WhatsApp payloads:

- `webhooks.whatsapp` (line 103) — takes `body` + optional `secret`, verifies the
  channel secret, calls `extractText("whatsapp", body)`, then forwards to the
  agent runtime.
- `webhooks.ingest` (line 112) — generic route whose channel enum includes
  `whatsapp` (line 114); same verify + extract + forward path. This is the route
  the pipeline's channel send node targets.

### Secret verification

`verifyChannelSecret` resolves the expected secret from
`WHATSAPP_WEBHOOK_SECRET` (or fallback `WEBHOOK_SECRET`). If none is configured:

- in production (unless `ALLOW_UNVERIFIED_WEBHOOKS=true`) the request is rejected;
- otherwise (dev) it is allowed through.

### Text extraction

`extractText("whatsapp", body)` unwraps `entry[0].changes[0].value.messages[0]`
and captures text, `from`, `phone_number_id`, and any media id/type/mime/filename.

### The dead-end — `forwardToAgentRuntime` (**DEAD-END**)

```ts
response = await fetch(`${agentUrl}/webhook/ingest`, {
  method: "POST",
  body: JSON.stringify({ channel, payload }),
  ...
});
```

The Python agent runtime exposes `/health`, `/models*`, `/knowledge*`,
`/llm/generate`, and `/chat/*` — but **not** `/webhook/ingest`. The forward
therefore fails: if the runtime is unreachable it throws `BAD_GATEWAY`; if the
runtime is reachable it returns the 404 it received, which is also surfaced as
`BAD_GATEWAY`. Either way, **every WhatsApp webhook delivery dead-ends with a
502.**

This confirms the integration is end-to-end non-functional on the inbound path.

---

## 5. Agent runtime — `/webhook/ingest` (**MISSING**)

File: `packages/agent-runtime/src/main.py`

There is no `/webhook/ingest` FastAPI route. The ingest endpoint that the API
forwards to simply does not exist.

---

## 6. Meta verify GET handshake (**MISSING**)

Meta's Cloud API requires a `GET` on the webhook URL with `hub.mode`,
`hub.verify_token`, and `hub.challenge`, returning the challenge to prove you own
the endpoint. No such GET route exists for WhatsApp (or any channel). Until it is
added and configured with a token matching `WHATSAPP_VERIFY_TOKEN` (or whichever
token Meta is told to expect), Meta will not activate webhook delivery.

---

## 7. Pipeline channel path (**REAL code, DEAD-END target**)

File: `packages/pipeline-engine/src/runners.ts` (lines 880-907)

The `integrationNode` runner (and the send-message runner) can target
`whatsapp` when the node `provider` is one of telegram/slack/discord/whatsapp/email.
It POSTs:

```ts
{ channel: provider, action, channelId, message, ...config }
```

to `${apiUrl}/trpc/webhooks.ingest`. Because that route forwards to the
non-existent Python route, a WhatsApp pipeline send also ends in a 502. Even the
route it calls is the generic `ingest` (whose channel includes `whatsapp`), never
`webhooks.whatsapp` — so the pipeline path routes through `forwardToAgentRuntime`
just like inbound webhooks.

---

## 8. Environment variables

| Variable | Source | Read by | Status |
|----------|--------|---------|--------|
| `WHATSAPP_PHONE_NUMBER_ID` | root `.env.example` line 38 | nothing in code | **MISSING (unused)** |
| `WHATSAPP_ACCESS_TOKEN` | root `.env.example` line 39 | nothing in code | **MISSING (unused)** |
| `WHATSAPP_VERIFY_TOKEN` | root `.env.example` line 40 | nothing in code (only README table) | **MISSING (unused)** |
| `WHATSAPP_WEBHOOK_SECRET` | `apps/api/.env.example` line 40 | `webhooks.ts` `verifyChannelSecret` | **REAL (inbound secret)** |
| `WEBHOOK_SECRET` | `apps/api/.env.example` line 36 | `webhooks.ts` fallback | **REAL (fallback)** |
| `AGENT_RUNTIME_URL` | `apps/api/.env.example` line 13 | `forwardToAgentRuntime` | **REAL** |
| `ALLOW_UNVERIFIED_WEBHOOKS` | `apps/api/.env.example` line 42 | `webhooks.ts` dev bypass | **REAL** |

Note: `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` are documented in the
root `.env.example` but are **never read by any code** — one symptom of the adapter
never being wired into the application. `WHATSAPP_VERIFY_TOKEN` is likewise never
read; the only secret actually consulted for inbound validation is
`WHATSAPP_WEBHOOK_SECRET`.

---

## 9. Summary of state by responsibility

| Responsibility | State |
|----------------|-------|
| Parse inbound Graph webhook envelope | **REAL** (`handleUpdate`, `extractText`) |
| Resolve media id to URL | **REAL** (media GET) |
| Send outbound message via Graph API | **REAL** (`sendMessage`) |
| Instantiate/register adapter in production | **MISSING** |
| Verify webhook secret on inbound | **REAL** |
| Forward inbound to a handler | **DEAD-END** (route missing) |
| Meta verify GET handshake | **MISSING** |
| Normalize Baileys payloads | **REAL but orphaned** (no producer) |
| Pipeline send to whatsapp | **REAL code, DEAD-END target** |
| Persist WhatsApp messages | **MISSING** (see [data-model.md](./data-model.md)) |
