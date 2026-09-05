# WhatsApp Data Model

This document describes how WhatsApp data touches the FlowMind data layer. The
short version: **WhatsApp has no dedicated persistence.** Messages pass through
the channel/webhook path as transient payloads and are not stored as first-class
records in Postgres.

Related docs: [overview.md](./overview.md),
[../data-model/overview.md](../data-model/overview.md),
[../data-model/entities.md](../data-model/entities.md).

---

## Bottom line

- **There is no dedicated WhatsApp table** in the Prisma schema
  (`packages/db/prisma/schema.prisma`).
- **Neither outbound nor inbound WhatsApp messages are persisted** as first-class
  records in the current schema. They exist only as in-flight HTTP payloads and
  objects in the adapter/normalizer.
- The only "channel" reference in the schema is the `channel` column on the
  `CronJob` model, which is unrelated to WhatsApp messaging.

---

## What touches WhatsApp and what doesn't

### Prisma models that are NOT WhatsApp-specific

| Model | Relation to WhatsApp |
|-------|----------------------|
| `Session` (line 302) | Backs the **chat UI** sessions, not WhatsApp threads. A curl of the column set (`userId`, `title`, `summary`, `embedding`) shows no channel/wa fields. |
| `Message` (line 320) | Stores **chat UI** message records (`role`, `content`, `toolCalls`, ...) scoped to a `Session`. Not a channel message store. |
| `McpToken` (line 457) | Stores **provider OAuth tokens** for MCP tools (e.g. github, notion) — not WhatsApp credentials. WhatsApp credentials live in env vars only. |

These three models are the ones most likely to be confused with WhatsApp storage,
so calling them out explicitly:

- `Message` is for the **in-app chat UI**, keyed by `sessionId` and
  `MessageRole` (user/assistant). It is unrelated to the WhatsApp channel.
- `McpToken` is a per-user/per-org **MCP tool credential** store (OAuth-based),
  not a WhatsApp token store. WhatsApp auth is done via the bearer
  `WHATSAPP_ACCESS_TOKEN` env var, not this table.
- `Session` is the chat-session container for the UI, with no WhatsApp linkage.

---

## Where WhatsApp data actually lives today (transient only)

- **Inbound:** the raw Meta Graph webhook envelope arrives at the API router as
  a JSON body, is parsed by `extractText` / `WhatsAppAdapter.handleUpdate`, and
  is forwarded (to a dead-end) — it is never written to the database.
- **Outbound:** `WhatsAppAdapter.sendMessage` is a Graph API call that has no
  persisted entity. There is no row created for a sent WhatsApp message.
- **Media:** the adapter resolves media ids to temporary URLs at runtime; the
  URLs are not stored.

In other words, WhatsApp activity is ephemeral: it lives in memory and HTTP
payloads only.

---

## Consequences of no persistence

- No message history for WhatsApp in Postgres — a conversation cannot be
  replayed or audited from the database today.
- No durable record of outbound sends (what was sent, when, to whom, success).
- No mapping from WhatsApp user id (`wa_id`) to a FlowMind `User` — identity is
  not bridged in the schema.

If message persistence is wanted (see [integration.md](./integration.md)), it is
a deliberate schema decision that does not exist yet — nothing in the current
schema documents or stores WhatsApp messages.

---

## Schema references

- Prisma schema: `packages/db/prisma/schema.prisma`
  - `model Session` — line 302
  - `model Message` — line 320
  - `model McpToken` — line 457
  - `model McpServer` — line 476
- Data model docs: [../data-model/overview.md](../data-model/overview.md),
  [../data-model/entities.md](../data-model/entities.md)
