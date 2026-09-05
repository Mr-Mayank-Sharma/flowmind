# Product Vision

## What FlowMind Wants to Be

FlowMind aims to be an n8n-class AI workflow and automation platform — a place where users can visually build, run, and share AI-powered pipelines and agents.

The core belief is that AI workflows should be as accessible as drawing a diagram. A product manager should be able to drag together a trigger, an AI model call, a tool action, and a notification — and have it work. A developer should be able to build a complex multi-step agent with tool use, RAG, and MCP integrations — and share it with a community.

FlowMind is not just a pipeline builder. It is an "AI Agent OS": a complete environment for creating, running, sharing, and monetizing AI-powered automation. Every node can call an LLM. Every pipeline can be an agent. A community marketplace lets creators publish and consumers discover reusable skills, flows, templates, and integrations.

## Near-Term (Verifiable Local / Secure)

The near-term goal is a stable, secure, locally-verifiable platform:

- **Core pipeline execution** with visual canvas, 24+ node types, and real-time SSE streaming
- **Agent chat** with tool use (built-in tools + MCP external tools), streaming responses, and session memory
- **Knowledge base management** with RAG search over uploaded documents via Qdrant
- **MCP integration** connecting to external tool servers
- **Skill marketplace** for publishing and discovering reusable skills and flows
- **Multi-tenant security** with JWT auth, RBAC, encryption at rest, SSRF guards, and sandboxed execution
- **Honest error handling** — no fake success, no mocked responses, no silent failures

All of this works today on localhost with real infrastructure (PostgreSQL, Redis, Qdrant, Ollama).

## Long-Term (Public SaaS / n8n Parity)

The long-term vision extends to:

- **Public SaaS deployment** with multi-tenant isolation at scale
- **n8n feature parity** — conditional branching UI, parallel execution, pipeline versioning and rollback, custom node SDK
- **Enterprise features** — SSO (Okta, Azure AD), audit logs, compliance certifications (SOC 2, GDPR)
- **Community marketplace** at scale — publish and discover pipelines, skills, agents, and integrations with reviews, ratings, and monetization
- **On-premise deployment** — Helm charts, Kubernetes operators, air-gapped installs
- **Native mobile app** — trigger pipelines, monitor runs, chat with agents from your phone
- **External runtime ecosystem** — register and dispatch to custom runtimes beyond the built-in agent

## What It Is Not

FlowMind is not:
- A general-purpose LLM chatbot (though it has chat)
- A code editor (though it has LSP integration)
- A monitoring dashboard (though it has metrics and SSE streaming)
- A replacement for n8n (yet — it is building toward that parity)

FlowMind is an AI-native workflow platform that treats LLMs, tools, and knowledge as first-class citizens in a visual automation environment.
