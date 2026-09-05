# WhatsApp Workflows

This document describes the two WhatsApp workflows — **inbound** (user message
into FlowMind) and **outbound** (FlowMind reply to the user) — both as they
**exist in code today** (with the dead-end annotated) and as they **should** work
once fixed.

Related docs: [overview.md](./overview.md), [architecture.md](./architecture.md),
[integration.md](./integration.md).

---

## Inbound workflow (user → FlowMind)

### As it exists today

```mermaid
sequenceDiagram
    participant U as WhatsApp user
    participant M as Meta Graph API
    participant A as apps/api (routers/webhooks.ts)
    participant R as Python agent runtime

    U->>M: sends message to number
    M->>A: POST webhook (entry[0].changes[0].value.messages[0])
    Note over A: verifyChannelSecret("whatsapp")<br/>uses WHATSAPP_WEBHOOK_SECRET
    A->>A: extractText("whatsapp", body)<br/>unwrap text + media id/type
    A->>R: POST /webhook/ingest {channel, payload}
    Note over R: No route exists
    R-->>A: 404 Not Found
    A-->>M: BAD_GATEWAY / 502
```

**Key facts about the current inbound path:**

- The API receives the raw Meta notification and validates the secret
  (dev bypass unless `WHATSAPP_WEBHOOK_SECRET`/`WEBHOOK_SECRET` set and prod/enforced).
- `extractText` correctly unwraps the Graph envelope, including media id/type.
- The path then **dead-ends**: it forwards to `AGENT_RUNTIME_URL/webhook/ingest`,
  which does not exist. Result is a 502 for every inbound WhatsApp message.
- There is **no Meta verify GET handshake**, so Meta would not deliver the
  webhook at all even if the forward worked.

### How it should work once fixed

```mermaid
sequenceDiagram
    participant U as WhatsApp user
    participant M as Meta Graph API
    participant A as apps/api (webhooks router)
    participant R as Python agent runtime
    participant LLM as Agent / pipeline

    U->>M: sends message to number
    Note over A,M: (prerequisite) Meta GET verify handshake<br/>hub.mode / verify_token / challenge
    M->>A: GET /webhook/whatsapp (verify challenge)
    A-->>M: returns hub.challenge (200)
    M->>A: POST webhook (inbound message)
    Note over A: verify secret (WHATSAPP_WEBHOOK_SECRET)
    A->>A: extract + normalize to ChannelMessage
    A->>R: POST inbound message<br/>(either /webhook/ingest once implemented,<br/>or a direct API channel path)
    R->>LLM: route to agent / pipeline
    LLM-->>R: generates reply
    R->>A: reply ready
    A->>R: (see outbound flow below)
```

The essential difference: after extraction, the message must reach a real handler
instead of a non-existent route, and a Meta GET verification endpoint must sit in
front so Meta delivers at all.

**What is missing to make inbound work:**

- The Meta GET verification handshake route.
- A real destination for the extracted message (implement `/webhook/ingest` in
  the Python runtime, or route inbound through the API channel layer directly,
  or call `WhatsAppAdapter.handleUpdate` + a response path — see
  [integration.md](./integration.md#recommended-fix-path)).
- Reconcile the payload shape between `extractText`/`handleUpdate` (Graph) and
  `normalizeWhatsApp` (Baileys) so there is one consistent normalization.

---

## Outbound workflow (FlowMind → user)

### As it exists today (via pipeline)

```mermaid
sequenceDiagram
    participant P as Pipeline runner (runners.ts)
    participant A as apps/api (webhooks.ingest)
    participant R as Python agent runtime
    participant G as Meta Graph API

    P->>A: POST /trpc/webhooks.ingest {channel:"whatsapp", body}
    Note over P: integrationNode / send message<br/>provider = whatsapp
    A->>A: extractText("whatsapp", body)
    A->>R: POST /webhook/ingest
    Note over R: No route exists
    R-->>A: 404
    A-->>P: BAD_GATEWAY / 502
    Note over G: WhatsAppAdapter never invoked<br/>no outbound message sent
```

**Key facts:**

- The pipeline can target `whatsapp` in its `integrationNode` / send runners.
- It routes through the generic `webhooks.ingest` route (the same dead-end as
  inbound), so the send fails with 502.
- Crucially, **`WhatsAppAdapter.sendMessage` is never called.** There is no code
  path from the pipeline or the API to the Graph API outbound call.

### How it should work once fixed

```mermaid
sequenceDiagram
    participant P as Pipeline runner / API
    participant A as apps/api
    participant AD as WhatsAppAdapter
    participant G as Meta Graph API
    participant U as WhatsApp user

    P->>A: request outbound send (channelId, text, files)
    A->>AD: sendMessage(OutgoingMessage)
    Note over AD: real adapter, constructed with<br/>phoneNumberId + accessToken
    AD->>G: POST /{apiVersion}/{phoneNumberId}/messages
    G-->>U: delivers to WhatsApp user
    U->>U: receives reply
```

The outbound fix is comparatively simple: **wire and call `WhatsAppAdapter` with
real credentials.** The adapter's `sendMessage` already implements the Graph API
POST correctly; it just needs to be instantiated, registered with the
`ChannelGateway`, and reached from the send path.

**What is missing to make outbound work:**

- Instantiate `WhatsAppAdapter` with `WHATSAPP_PHONE_NUMBER_ID` +
  `WHATSAPP_ACCESS_TOKEN` and register it with the `ChannelGateway`.
- Route pipeline/API sends to the adapter (instead of the dead-end `ingest`).
- Decide whether outbound replies ride through the agent runtime or straight
  from the API channel layer.
