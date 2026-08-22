# Security Assumptions — Hosted Enterprise Mode

This document records the security model and assumptions behind the Hosted
Enterprise feature: shared model hosting, group pipelines/skills/RAG, and
external client connectivity.

## 1. Trust Model

| Actor | Trust level | Notes |
| --- | --- | --- |
| Host platform (this API) | Trusted | Owns the DB, model runtime (Ollama), and group data. |
| Group OWNER/ADMIN (platform user) | Trusted | Can create groups, publish canonical pipelines/skills/knowledge, approve/merge proposals, create connect tokens. |
| Group VIEWER / regular member | Semi-trusted | Read access to group content; no publish/approve. |
| Connected external client | Untrusted | Only ever sees the single group it connected to; never sees other groups or the platform user surface. |
| Model runtime (Ollama) | Semi-trusted | Hosted on the same node as the API in this deployment; prompts/results cross the loopback only. |

## 2. Authentication

- All host-management procedures (`host.*`) require a platform JWT
  (`protectedProcedure` / role checks).
- Connect tokens are **single-use** and hashed at rest
  (`hashConnectToken`, `services/host-auth.ts`). The plaintext is returned
  exactly once at creation and never stored.
- `host.connect` exchanges a connect token for a **host-client JWT** scoped to
  exactly one `groupId`. The token payload carries `hostClient`, `clientId`,
  `groupId`; middleware (`hostClientProcedure`) rejects any request without a
  valid host-client context.
- Host-client JWTs are signed with the same secret as platform JWTs but carry a
  distinct claim set. Revoking the client (or deleting the client record)
  invalidates access because the client id is re-checked on each protected
  host-client request path.

## 3. Group Scoping & Isolation

- Every group-scoped write (`host.upsertKnowledge`, `host.createPipeline`,
  `host.publishSkill`, `client.proposePipeline`, …) requires the caller to hold
  a role in that group (`userGroupRoles`, `services/group-access.ts`).
- `ContextEngine.search` always applies the `userId`/`groupId` filter; group RAG
  content is only retrievable via host-client search against that group.
- Personal routes (`knowledge.list/getById/delete`, `pipeline.getById`/`trigger`)
  filter by `userId`; group pipelines/knowledge carry `groupId` (userId null)
  and are only visible to group members via the group-aware lookup added in
  `routers/pipeline.ts` (`getById`).
- `client.pull` returns only the connected group's pipelines/skills/knowledge.

## 4. Proposal Review & Merge

- Only group OWNER/ADMIN can approve/reject/merge proposals
  (`assertCanReview`).
- Merging recomputes the diff against the **current** base version; a proposal
  created against an older version is validated at merge time (base version
  tracked on the proposal).
- The merge result is a new version; prior versions are preserved in
  `versionHistory` (capped at 50).

## 5. Model & Embedding Security

- `routeInference` falls back to an installed local (non-`:cloud`) model when
  the requested model is not installed; the caller is told which model resolved.
- Embeddings and inference run against the local Ollama endpoint; no prompts or
  docs leave the host node in this deployment.

## 6. Secrets & Encryption

- Platform JWTs use `JWT_SECRET`; connect-token hashing uses a dedicated salt
  derived from the secret. Change both in production.
- Any future at-rest encryption of group data should use `ENCRYPTION_KEY`.
- Production deployments must run TLS in front of both the API and the web app;
  host-client sessions (`localStorage: flowmind_host_client`) are subject to
  XSS risk and should be replaced with httpOnly cookies when a browser
  session-only flow is required.

## 7. Known Limits / Assumed Risks

- Qdrant is optional; without it the ContextEngine runs an in-memory cosine
  fallback (no persistence across API restarts). Group RAG isolation still
  holds in-memory.
- Connect tokens do not currently have a per-client spend limit beyond the
  single-use rule.
- External clients authenticate with email + token only; there is no
  per-client MFA or IP allow-listing in this build.
