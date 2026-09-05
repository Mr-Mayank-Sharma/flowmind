# Architectural Decisions

Architecture Decision Records (ADRs) for FlowMind. Each entry documents a significant decision, the rationale, and the alternative rejected.

---

## ADR-001: Keep the Name "FlowMind" (Reject "Nomad")

**Status:** Accepted

**Context:** During early development, the project was temporarily referred to as "Nomad."

**Decision:** The name "FlowMind" was adopted permanently.

**Rationale:** "FlowMind" better communicates the product's dual nature: "Flow" for the visual pipeline/workflow editor, "Mind" for the AI agent intelligence. The name was already in the codebase, README, and schema. Renaming would have required sweeping changes across models, routes, and documentation with no functional benefit.

**Alternative rejected:** Rename to "Nomad" — rejected because the rename cost was high and the name "FlowMind" was already well-established.

---

## ADR-002: Env-Gated Admin Bootstrap (Reject Hardcoded Test Password)

**Status:** Accepted

**Context:** Early development used a hardcoded admin password for quick testing.

**Decision:** Admin bootstrap is env-gated. The `db:seed` script only creates an admin user if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set in the environment. Without these env vars, the seed script is a no-op.

**Rationale:** A hardcoded password in the repo is a security risk — even in a private repo, it sets a bad precedent and can leak into production via copy-paste. Env-gated seeding ensures the admin account is only created when explicitly configured, and the password never appears in source code.

**Alternative rejected:** Keep the hardcoded test password — rejected as a security anti-pattern after the production audit.

---

## ADR-003: Honest-Failure Philosophy (Reject Mocks and Fake Success)

**Status:** Accepted

**Context:** During the production audit, multiple instances of fake success were found:
- MCP tools returning mock tool definitions instead of connecting to real servers
- Chat returning canned replies flagged as real AI responses
- Stripe webhook handler returning `received: true` without signature verification
- Billing silently auto-upgrading tiers

**Decision:** Never fake success. Every external interaction must either succeed honestly or fail with a clear error. No mock responses pretending to be real, no canned replies without error flags, no unsigned webhook acceptance, no silent tier upgrades.

**Rationale:** Fake success is a correctness hazard — callers make decisions based on the response. A fake tool success can cause downstream failures. A fake webhook acceptance can cause duplicate processing. An honest error is always better than a lie.

**Alternative rejected:** Continue using mocks for faster development — rejected because the mocks masked real integration failures and created false confidence.

---

## ADR-004: API Bundle via tsup (Reject tsc Monorepo Compile)

**Status:** Accepted

**Context:** The monorepo had 23 internal packages. Compiling the API via `tsc` required resolving all internal packages in dependency order, which failed due to circular dependencies and Prisma client generation ordering.

**Decision:** The API is bundled via tsup into a single self-contained CJS file (`dist/index.js`). All `@flowmind/*` packages are inlined. Only `@prisma/client` and `isolated-vm` remain external (native modules).

**Rationale:** tsup resolves all internal packages in a single pass, producing a bootable bundle without worrying about compilation order. The trade-off is a larger bundle size (all packages inlined), but for a server-side application this is acceptable.

**Alternative rejected:** Fix the tsc monorepo compilation — rejected because the circular dependency graph across 23 packages made this a deep structural problem that would require significant refactoring for no functional gain.

---

## ADR-005: Native Windows Binaries for Redis and Qdrant (Reject Docker)

**Status:** Accepted

**Context:** The development machine runs Windows without Hyper-V enabled. Docker Desktop requires WSL2, which requires Hyper-V. Therefore Docker is impossible on this box.

**Decision:** Redis and Qdrant run as native Windows binaries. Redis runs on port 6379, Qdrant on port 6333.

**Rationale:** Native binaries are the only viable option given the hardware constraints. Both services work correctly as native binaries. Docker/k8s manifests exist in the repo for deployment on real infrastructure where Docker is available.

**Alternative rejected:** Enable Hyper-V / WSL2 — rejected because it requires BIOS-level changes and may conflict with other virtualization software on the dev box.

---

## ADR-006: Credentials at Rest with AES-256-GCM

**Status:** Accepted

**Context:** The platform manages API keys for 15+ cloud LLM providers (OpenAI, Anthropic, Google, etc.). These keys were initially stored as plaintext in the database.

**Decision:** Provider credentials are encrypted with AES-256-GCM before storage. Encryption uses the `ENCRYPTION_KEY` environment variable. Decryption happens in-memory only, during API startup.

**Rationale:** Storing API keys in plaintext in the database means anyone with database access (or a SQL injection) gets all provider keys. Encryption at rest means a database dump is useless without the encryption key. AES-256-GCM provides both confidentiality and integrity.

**Alternative rejected:** Leave credentials plaintext — rejected as a clear security gap after the production audit. Env-var-only keys (no DB storage) was also rejected because users need to configure keys through the UI.

---

## ADR-007: Async Pipelines with Active-Runs Registry

**Status:** Accepted

**Context:** Pipeline execution was initially synchronous — the tRPC mutation blocked until the entire pipeline completed. This caused timeouts for long-running pipelines.

**Decision:** Pipeline execution is async. A shared in-memory `active-runs` registry tracks all running pipelines. The tRPC mutation creates a `PipelineRun` record and starts execution in the background. SSE streams real-time progress to the client.

**Rationale:** Async execution prevents timeouts and allows the API to handle multiple concurrent pipeline runs. The active-runs registry enables run-recovery on API restart — incomplete runs are detected and either resumed or failed.

**Alternative rejected:** Keep synchronous execution with increased timeouts — rejected because it doesn't scale and doesn't allow concurrent runs.

---

## ADR-008: JWT Fallback Secret Throws in Production

**Status:** Accepted

**Context:** In development, a fallback JWT secret allows the server to start without `JWT_SECRET` configured. In production, this fallback would mean unsigned or weakly-signed tokens.

**Decision:** `apps/api/src/lib/jwt-secret.ts` uses the fallback only in development. In production (`NODE_ENV=production`), it throws an error immediately.

**Rationale:** A weak or default JWT secret in production means any attacker can forge tokens. Failing fast is better than running with an insecure configuration.

**Alternative rejected:** Allow the fallback in production with a warning log — rejected because warnings can be missed, and an insecure JWT secret is a critical vulnerability.

---

## ADR-009: Real MCP Client via @modelcontextprotocol/sdk

**Status:** Accepted

**Context:** The platform needed to connect to external MCP (Model Context Protocol) servers to extend agent capabilities.

**Decision:** Use the official `@modelcontextprotocol/sdk` package. Support stdio and streamable-http/SSE transports. Enforce stdio command allowlist and SSRF blocklist for security.

**Rationale:** A real MCP client ensures actual interoperability with the MCP ecosystem. The official SDK handles protocol versioning, transport negotiation, and error handling. Security constraints (command allowlist, SSRF blocklist) prevent abuse.

**Alternative rejected:** Implement a custom MCP client — rejected because the protocol has versioning and transport complexity that the official SDK handles. A custom implementation would be a maintenance burden and likely drift from the spec.

---

## ADR-010: Keep Dev-Mode Rather Than Force Production Build Locally

**Status:** Accepted

**Context:** The Next.js standalone build works on Linux/Docker but has issues on Windows (file path handling, tracing). Forcing a production build locally would require fixing Windows-specific Next.js build issues.

**Decision:** The app runs in dev mode locally (`tsx watch` for API, `next dev` for web). Production build artifacts are verified (tsup bundle boots, Next.js standalone builds in Docker) but the local experience uses dev mode.

**Rationale:** Dev mode is fully functional and provides a good development experience. The production build is verified in Docker builds. Fixing Windows-specific Next.js standalone build issues provides no functional benefit for local development.

**Alternative rejected:** Fix the Windows standalone build — rejected as low-value work that doesn't affect production deployment (which uses Docker/Linux).

---

## ADR-011: Shared LLM Factory Pattern

**Status:** Accepted

**Context:** LLM calls were scattered across multiple packages (llm-router, skill-engine, context-engine, agent-runtime) with inconsistent retry logic, logging, and token counting.

**Decision:** A single `llm-factory.ts` in `apps/api/src/lib/` serves as the call-site for all LLM interactions. The factory handles provider selection, retry logic, logging, and token counting.

**Rationale:** A single call-site ensures consistent behavior across all LLM interactions. Changes to retry logic, logging format, or token counting apply everywhere automatically.

**Alternative rejected:** Let each package implement its own LLM client — rejected because it leads to inconsistent behavior and duplicated logic.

---

## ADR-012: Run-Recovery on API Restart

**Status:** Accepted

**Context:** If the API crashes or is restarted while pipelines are running, those pipelines are left in a `RUNNING` state indefinitely.

**Decision:** On startup, `startRunRecovery()` scans for `PipelineRun` records with status `RUNNING` or `PENDING` and either resumes them (if the pipeline definition is still valid) or marks them as `FAILED`.

**Rationale:** Without recovery, crashed pipelines would appear to be running forever, confusing users and blocking resources. Recovery ensures the system is always in a consistent state after restart.

**Alternative rejected:** Require manual intervention to reset stuck pipelines — rejected as poor UX for a platform that aims to be autonomous.
