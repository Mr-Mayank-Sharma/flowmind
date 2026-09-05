# Schema Reference

> Last verified against `packages/db/prisma/schema.prisma` on 2026-09-05.

## Table Name Map

| Model | @@map table |
|---|---|
| User | users |
| ProviderCredential | provider_credentials |
| Org | orgs |
| OrgMember | org_members |
| HostGroup | host_groups |
| HostGroupMember | host_group_members |
| HostClient | host_clients |
| HostConnection | host_connections |
| Account | accounts |
| Session | sessions |
| Message | messages |
| Skill | skills |
| MarketplaceSkill | marketplace_skills |
| SkillVersion | skill_versions |
| SkillReview | skill_reviews |
| Memory | memories |
| ApiKey | api_keys |
| McpToken | mcp_tokens |
| McpServer | mcp_servers |
| Pipeline | pipelines |
| PipelineProposal | pipeline_proposals |
| PipelineProposalComment | pipeline_proposal_comments |
| PipelineRun | pipeline_runs |
| RunLog | run_logs |
| MarketplaceFlow | marketplace_flows |
| FlowReview | flow_reviews |
| FlowClone | flow_clones |
| FlowExecution | flow_executions |
| CreatorRevenue | creator_revenue |
| FlowCategory | flow_categories |
| MarketplaceListing | marketplace_listings |
| MarketplaceListingVersion | marketplace_listing_versions |
| MarketplaceReview | marketplace_reviews |
| MarketplaceFork | marketplace_forks |
| OrgSubscription | org_subscriptions |
| UsageRecord | usage_records |
| FrameworkConfig | framework_configs |
| FrameworkStatusRecord | framework_status_records |
| SystemMetricsLog | system_metrics_logs |
| AuditLog | audit_logs |
| Subscription | subscriptions |
| CronJob | cron_jobs |
| Notification | notifications |
| KnowledgeBase | knowledge_bases |
| KnowledgeDocument | knowledge_documents |
| Agent | agents |

All 46 models map to snake_case plural table names except `CreatorRevenue` -> `creator_revenue` (singular).

## Enums

| Enum | Values |
|---|---|
| UserRole | USER, ADMIN, SUPER_ADMIN |
| OrgRole | OWNER, ADMIN, MEMBER, VIEWER |
| Tier | FREE, PRO, TEAM, ENTERPRISE |
| MessageRole | USER, ASSISTANT, SYSTEM, TOOL |
| PipelineStatus | DRAFT, ACTIVE, ARCHIVED |
| RunStatus | PENDING, RUNNING, SUCCESS, FAILED, CANCELLED, AWAITING_APPROVAL |
| GroupRole | OWNER, ADMIN, MEMBER, VIEWER |
| ProposalStatus | PROPOSED, APPROVED, REJECTED, MERGED |
| HostClientStatus | PENDING, ACTIVE, REVOKED |
| FrameworkStatus | RUNNING, STOPPED, ERROR, UNKNOWN |
| McpServerTransport | STDIO, STREAMABLE_HTTP, SSE |
| Visibility | PRIVATE, PUBLIC, TEAM |
| MarketplaceItemType | SKILL, PIPELINE, WORKFLOW, PROMPT_PACK, AGENT_TEMPLATE, MCP_INTEGRATION, PLUGIN |
| KnowledgeBaseStatus | READY, INDEXING, ERROR |
| DocumentStatus | INDEXED, INDEXING, ERROR |
| DocumentType | PDF, TXT, MD, CSV, JSON |
| AgentStatus | RUNNING, STOPPED, ERROR, DEPLOYING |

## @@unique Constraints

| Model | Unique fields |
|---|---|
| User | email |
| Org | slug |
| OrgMember | [orgId, userId] |
| HostGroup | [orgId, slug] |
| HostGroupMember | [groupId, userId] |
| Account | [provider, providerAccountId] |
| ProviderCredential | [userId, provider] |
| MarketplaceSkill | name |
| SkillReview | [skillId, reviewerId] |
| FlowReview | [flowId, reviewerId] |
| MarketplaceListingVersion | [listingId, version] |
| MarketplaceReview | [listingId, reviewerId] |
| OrgSubscription | orgId |
| FrameworkConfig | [userId, frameworkId] |
| FrameworkStatusRecord | [userId, frameworkId] |
| Subscription | userId |
| MarketplaceFlow | pipelineId |
| FlowCategory | slug |

## @@index Inventory

| Model | Indexed fields |
|---|---|
| ProviderCredential | [userId] |
| HostGroup | [orgId] |
| HostGroupMember | [userId] |
| HostConnection | [userId] |
| Session | [userId] |
| Message | [sessionId] |
| Skill | [userId], [groupId] |
| Memory | [userId], [sessionId] |
| ApiKey | [userId] |
| McpServer | [userId] |
| Pipeline | [userId], [orgId], [groupId], [hostPipelineId] |
| PipelineProposal | [groupId], [status] |
| PipelineProposalComment | [proposalId] |
| PipelineRun | [pipelineId] |
| RunLog | [runId] |
| MarketplaceFlow | [category], [creatorId] |
| FlowExecution | [flowId] |
| MarketplaceListing | [type], [category], [ownerId], [orgId] |
| UsageRecord | [subjectType, subjectId, metric], [periodStart, periodEnd] |
| SystemMetricsLog | [userId, recordedAt] |
| AuditLog | [orgId], [userId], [createdAt] |
| CronJob | [userId] |
| Notification | [userId, read] |
| KnowledgeBase | [userId], [groupId] |
| KnowledgeDocument | [kbId] |
| Agent | [userId] |

## Float[] Embedding Columns (Vector Search)

Two tables carry a `Float[]` array column intended for vector similarity search. These are stored as Postgres array columns, not a `pgvector` extension vector type:

- **Session.embedding** -- embeds the session summary/title for recalling past conversations.
- **Memory.embedding** -- embeds each memory record for relevant-memory retrieval.

The actual vector search / similarity computation is expected to be done in application code reading these arrays, or the vector store may live externally in Qdrant (see data-flow.md) with these columns as the Postgres-side coordinate source.

## Json Columns Inventory

Many models use `Json` for flexible/nested payloads. See the full inventory in entities.md under "CJK / Json / Float[] Column Index". Notable ones:

- `Pipeline.graph` (required Json) -- the DAG definition of a pipeline.
- `PipelineProposal.proposedGraph` (required Json) -- the proposed graph in a merge proposal.
- `Message.toolCalls` / `Message.toolResults` -- tool invocation payloads and outcomes.
- `MarketplaceListing.manifest` / `payloadRef` -- package metadata and payload location.
- `User.webauthnCredentials`, `Org.samlConfig` -- auth configuration blobs.

## BigInt / Other Specialty Columns

| Model | Column | Type |
|---|---|---|
| KnowledgeBase | totalSize | BigInt |

Only one BigInt column exists in the entire schema.
