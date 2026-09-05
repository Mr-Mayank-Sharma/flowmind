# Target Users

## Primary Users

### Individual Developers & AI Enthusiasts
Who they are: Developers who want to build AI-powered automation without wiring LangChain, vector stores, and tool frameworks together from scratch.

What they need:
- Visual pipeline builder with 24+ node types
- Built-in tools (file I/O, web requests, code execution, MCP)
- Chat interface for ad-hoc agent interactions
- Command-line access via `flowmind` CLI

### AI Product Builders
Who they are: Builders creating products or internal tools that need AI workflows, RAG, and agent capabilities.

What they need:
- Knowledge base management with Qdrant vector search
- MCP integration to extend agent capabilities
- Programmatic access via API keys
- Pipeline execution with SSE streaming for real-time feedback

## Growth Users

### Small Teams & Organizations
Who they are: Teams of 2-50 that want to centralize AI workflows and share them across members.

What they need:
- Organizations (Orgs) with role-based access (OWNER, ADMIN, MEMBER, VIEWER)
- HostGroups for collaborative pipeline development with proposals (PR-style review)
- Shared knowledge bases and skills
- Team subscription tiers (FREE, PRO, TEAM, ENTERPRISE)

### Marketplace Creators
Who they are: Users who build high-quality skills, pipelines, templates, and MCP integrations they want to publish and monetize.

What they need:
- Marketplace publishing with 7 item types (SKILL, PIPELINE, WORKFLOW, PROMPT_PACK, AGENT_TEMPLATE, MCP_INTEGRATION, PLUGIN)
- Reviews and ratings from consumers
- Fork/clone chains to track derived work
- Creator revenue tracking

### Marketplace Consumers
Who they are: Users who prefer to discover and reuse existing skills and flows rather than build from scratch.

What they need:
- Searchable marketplace with categories and tags
- Clone/fork one-click installs
- Verified and featured listings

## Future Users

### Enterprise Organizations
Who they are: Large organizations requiring SSO, compliance, and on-premise deployment (planned, not yet implemented).

What they'll need:
- SAML/OIDC SSO (Okta, Azure AD) — planned
- Audit logs — partially implemented (`audit_logs` table exists)
- On-premise deployment / air-gapped — planned
- SOC 2, GDPR compliance — planned

### Mobile Users
Who they are: Users who want to trigger pipelines, monitor runs, and chat with agents from their phones (planned).
