# Entity Encyclopedia

> Last verified against `packages/db/prisma/schema.prisma` on 2026-09-05.

Every model below reproduces exactly what the schema declares. All `id` fields are `String @id @default(cuid())` unless noted. Table names reflect `@@map`.

---

## 1. User

**Table**: `users`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| email | String | @unique |
| passwordHash | String? | |
| name | String? | |
| avatarUrl | String? | |
| role | UserRole | @default(USER) |
| tier | Tier | @default(FREE) |
| timezone | String | @default("UTC") |
| language | String | @default("en") |
| defaultModel | String? | |
| theme | String | @default("dark") |
| fontSize | String | @default("Medium") |
| chatDensity | String | @default("Comfortable") |
| stripeId | String? | |
| orgId | String? | FK -> Org.id |
| mfaSecret | String? | |
| mfaEnabled | Boolean | @default(false) |
| webauthnChallenge | String? | |
| webauthnCredentials | Json? | |
| passwordResetToken | String? | |
| passwordResetExpiresAt | DateTime? | |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Relations (outgoing)**: `org` (Org, on orgId); `sessions`, `skills`, `memories`, `apiKeys`, `pipelines`, `accounts`, `frameworks`, `reviews` (FlowReview), `skillReviews`, `clones` (FlowClone), `orgMembers`, `listings` (MarketplaceListing), `listingReviews`, `listingForks` (MarketplaceFork), `hostGroupMembers`, `hostConnections`, `knowledgeBases`, `providerCredentials`, `mcpServers`.

---

## 2. ProviderCredential

**Table**: `provider_credentials`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| userId | String | FK -> User.id |
| provider | String | |
| encryptedValue | String | |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Constraints**: `@@unique([userId, provider])`, `@@index([userId])`.

**Relations**: `user` (User, required).

---

## 3. Org

**Table**: `orgs`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| name | String | |
| slug | String | @unique |
| samlConfig | Json? | |
| tier | Tier | @default(FREE) |
| billingId | String? | |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Relations (outgoing)**: `members` (OrgMember), `pipelines`, `mcpTokens`, `users`, `subscription` (OrgSubscription, one-to-one), `listings` (MarketplaceListing), `groups` (HostGroup), `hostClients`.

---

## 4. OrgMember

**Table**: `org_members`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| orgId | String | FK -> Org.id |
| userId | String | FK -> User.id |
| role | OrgRole | @default(MEMBER) |

**Constraints**: `@@unique([orgId, userId])`.

**Relations**: `org` (Org, required), `user` (User, required).

---

## 5. HostGroup

**Table**: `host_groups`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| orgId | String? | FK -> Org.id |
| name | String | |
| slug | String | |
| description | String? | |
| tier | Tier | @default(ENTERPRISE) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Constraints**: `@@unique([orgId, slug])`, `@@index([orgId])`.

**Relations**: `org` (Org, optional); `members` (HostGroupMember), `pipelines`, `skills`, `knowledgeBases`, `proposals` (PipelineProposal).

---

## 6. HostGroupMember

**Table**: `host_group_members`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| groupId | String | FK -> HostGroup.id |
| userId | String | FK -> User.id |
| role | GroupRole | @default(MEMBER) |

**Constraints**: `@@unique([groupId, userId])`, `@@index([userId])`.

**Relations**: `group` (HostGroup, required, **onDelete: Cascade**), `user` (User, required, **onDelete: Cascade**).

---

## 7. HostClient

**Table**: `host_clients`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| orgId | String? | FK -> Org.id |
| name | String | |
| url | String? | |
| status | HostClientStatus | @default(ACTIVE) |
| connectTokenHash | String? | |
| connectTokenExpiresAt | DateTime? | |
| connectTokenGroupId | String? | |
| lastConnectedAt | DateTime? | |
| lastSyncAt | DateTime? | |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Relations**: `org` (Org, optional).

---

## 8. HostConnection

**Table**: `host_connections`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| userId | String | FK -> User.id |
| hostUrl | String | |
| hostName | String? | |
| email | String | |
| accessToken | String? | |
| refreshToken | String? | |
| tokenExpiresAt | DateTime? | |
| status | String | @default("connected") |
| groups | Json | |
| lastConnectedAt | DateTime? | |
| lastSyncAt | DateTime? | |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Constraints**: `@@index([userId])`.

**Relations**: `user` (User, required, **onDelete: Cascade**).

---

## 9. Account

**Table**: `accounts`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| userId | String | FK -> User.id |
| provider | String | |
| providerAccountId | String | |
| refreshToken | String? | |
| accessToken | String? | |
| expiresAt | Int? | |
| tokenType | String? | |
| scope | String? | |
| idToken | String? | |
| sessionState | String? | |

**Constraints**: `@@unique([provider, providerAccountId])`.

**Relations**: `user` (User, required).

---

## 10. Session

**Table**: `sessions`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| userId | String | FK -> User.id |
| title | String? | |
| summary | String? | |
| embedding | Float[] | Vector column for similarity search |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Constraints**: `@@index([userId])`.

**Relations**: `user` (User, required); `messages`, `memories`.

---

## 11. Message

**Table**: `messages`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| sessionId | String | FK -> Session.id |
| role | MessageRole | |
| content | String | |
| error | Boolean | @default(false) |
| toolCalls | Json? | |
| toolResults | Json? | |
| model | String? | |
| provider | String? | |
| tokensIn | Int? | |
| tokensOut | Int? | |
| duration | Int? | |
| createdAt | DateTime | @default(now()) |

**Note**: No `updatedAt`.

**Constraints**: `@@index([sessionId])`.

**Relations**: `session` (Session, required, **onDelete: Cascade**).

---

## 12. Skill

**Table**: `skills`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| userId | String? | FK -> User.id |
| groupId | String? | FK -> HostGroup.id |
| name | String | |
| description | String | |
| triggerPattern | String? | |
| code | String | |
| version | Int | @default(1) |
| successRate | Float? | |
| successCount | Int | @default(0) |
| useCount | Int | @default(0) |
| isActive | Boolean | @default(true) |
| hostGroupId | String? | |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Constraints**: `@@index([userId])`, `@@index([groupId])`.

**Relations**: `user` (User, optional), `group` (HostGroup, optional).

---

## 13. MarketplaceSkill

**Table**: `marketplace_skills`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| name | String | @unique |
| description | String | |
| author | String | |
| manifest | Json | |
| code | String | |
| version | String | |
| tags | String[] | |
| downloads | Int | @default(0) |
| ratingAvg | Float | @default(0) |
| ratingCount | Int | @default(0) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Relations (outgoing)**: `versions` (SkillVersion), `reviews` (SkillReview).

---

## 14. SkillVersion

**Table**: `skill_versions`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| skillId | String | FK -> MarketplaceSkill.id |
| version | String | |
| manifest | Json | |
| code | String | |
| createdAt | DateTime | @default(now()) |

**Relations**: `skill` (MarketplaceSkill, required, **onDelete: Cascade**).

---

## 15. SkillReview

**Table**: `skill_reviews`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| skillId | String | FK -> MarketplaceSkill.id |
| reviewerId | String | FK -> User.id |
| stars | Int | |
| body | String? | |
| createdAt | DateTime | @default(now()) |

**Constraints**: `@@unique([skillId, reviewerId])`.

**Relations**: `skill` (MarketplaceSkill, required, **onDelete: Cascade**), `reviewer` (User, required).

---

## 16. Memory

**Table**: `memories`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| userId | String | FK -> User.id |
| sessionId | String? | FK -> Session.id |
| content | String | |
| summary | String? | |
| type | String | @default("general") |
| relevanceScore | Float? | |
| embedding | Float[] | Vector column for similarity search |
| createdAt | DateTime | @default(now()) |

**Note**: No `updatedAt`.

**Constraints**: `@@index([userId])`, `@@index([sessionId])`.

**Relations**: `user` (User, required), `session` (Session, optional).

---

## 17. ApiKey

**Table**: `api_keys`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| userId | String | FK -> User.id |
| name | String | |
| provider | String | |
| keyHash | String | |
| lastFour | String | |
| lastUsedAt | DateTime? | |
| expiresAt | DateTime? | |
| isActive | Boolean | @default(true) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Constraints**: `@@index([userId])`.

**Relations**: `user` (User, required).

---

## 18. McpToken

**Table**: `mcp_tokens`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| orgId | String? | FK -> Org.id |
| userId | String? | Plain string, **no relation** |
| provider | String | |
| accessToken | String | |
| refreshToken | String? | |
| scope | String | |
| expiresAt | DateTime? | |
| isActive | Boolean | @default(true) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Relations (FK only)**: `org` (Org, optional). `userId` has **no Prisma relation** -- logical/implied ownership only.

---

## 19. McpServer

**Table**: `mcp_servers`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| userId | String | FK -> User.id |
| name | String | |
| transport | McpServerTransport | |
| command | String? | |
| args | Json? | |
| baseUrl | String? | |
| headers | Json? | |
| enabled | Boolean | @default(true) |
| lastError | String? | |
| lastConnectedAt | DateTime? | |
| lastToolCount | Int? | |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Constraints**: `@@index([userId])`.

**Relations**: `user` (User, required, **onDelete: Cascade**).

---

## 20. Pipeline

**Table**: `pipelines`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| userId | String? | FK -> User.id |
| orgId | String? | FK -> Org.id |
| groupId | String? | FK -> HostGroup.id |
| name | String | |
| description | String? | |
| graph | Json | |
| isActive | Boolean | @default(false) |
| isPublic | Boolean | @default(false) |
| status | PipelineStatus | @default(DRAFT) |
| version | Int | @default(1) |
| versionHistory | Json? | |
| category | String? | |
| tags | String[] | |
| icon | String? | |
| runCount | Int | @default(0) |
| lastRunAt | DateTime? | |
| avgDurationMs | Int? | |
| hostGroupId | String? | |
| hostPipelineId | String? | |
| hostSource | Json? | |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Constraints**: `@@index([userId])`, `@@index([orgId])`, `@@index([groupId])`, `@@index([hostPipelineId])`.

**Relations**: `user` (User, optional), `org` (Org, optional), `group` (HostGroup, optional); `runs` (PipelineRun), `marketplace` (MarketplaceFlow, optional one-to-one).

---

## 21. PipelineProposal

**Table**: `pipeline_proposals`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| groupId | String | FK -> HostGroup.id |
| proposedByUserId | String? | |
| proposedByClient | String? | |
| proposedByName | String? | |
| name | String | |
| description | String? | |
| basePipelineId | String? | |
| baseVersion | Int | @default(0) |
| baseGraph | Json? | |
| proposedGraph | Json | |
| diff | Json? | |
| message | String? | |
| status | ProposalStatus | @default(PROPOSED) |
| mergedByUserId | String? | |
| mergedAt | DateTime? | |
| rejectedByUserId | String? | |
| rejectedReason | String? | |
| rejectedAt | DateTime? | |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Constraints**: `@@index([groupId])`, `@@index([status])`.

**Relations**: `group` (HostGroup, optional); `comments` (PipelineProposalComment). Note `groupId` is required in the field but the relation is optional in the schema.

---

## 22. PipelineProposalComment

**Table**: `pipeline_proposal_comments`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| proposalId | String | FK -> PipelineProposal.id |
| authorId | String? | |
| authorName | String? | |
| body | String | |
| createdAt | DateTime | @default(now()) |

**Note**: No `updatedAt`.

**Constraints**: `@@index([proposalId])`.

**Relations**: `proposal` (PipelineProposal, required, **onDelete: Cascade**).

---

## 23. PipelineRun

**Table**: `pipeline_runs`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| pipelineId | String | FK -> Pipeline.id |
| status | RunStatus | @default(PENDING) |
| input | Json? | |
| output | Json? | |
| startedAt | DateTime? | |
| completedAt | DateTime? | |
| costCents | Int | @default(0) |
| tokensIn | Int | @default(0) |
| tokensOut | Int | @default(0) |
| createdAt | DateTime | @default(now()) |

**Note**: No `updatedAt`.

**Constraints**: `@@index([pipelineId])`.

**Relations**: `pipeline` (Pipeline, required); `logs` (RunLog).

---

## 24. RunLog

**Table**: `run_logs`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| runId | String | FK -> PipelineRun.id |
| nodeId | String | |
| nodeType | String | |
| input | Json? | |
| output | Json? | |
| error | String? | |
| duration | Int? | |
| tokensIn | Int? | |
| tokensOut | Int? | |
| costCents | Int? | |
| createdAt | DateTime | @default(now()) |

**Note**: No `updatedAt`.

**Constraints**: `@@index([runId])`.

**Relations**: `run` (PipelineRun, required, **onDelete: Cascade**).

---

## 25. MarketplaceFlow

**Table**: `marketplace_flows`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| pipelineId | String | FK -> Pipeline.id, **@unique** |
| creatorId | String | Plain string, **no relation** |
| category | String | |
| title | String | |
| description | String | |
| tags | String[] | |
| price | Int? | |
| downloads | Int | @default(0) |
| ratingAvg | Float | @default(0) |
| ratingCount | Int | @default(0) |
| isFeatured | Boolean | @default(false) |
| isVerified | Boolean | @default(false) |
| publishedAt | DateTime | @default(now()) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Constraints**: `@@index([category])`, `@@index([creatorId])`.

**Relations**: `pipeline` (Pipeline, required); `reviews` (FlowReview), `clones` (FlowClone), `executions` (FlowExecution). `creatorId` has **no Prisma relation** -- logical/implied ownership only.

---

## 26. FlowReview

**Table**: `flow_reviews`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| flowId | String | FK -> MarketplaceFlow.id |
| reviewerId | String | FK -> User.id |
| stars | Int | |
| body | String? | |
| createdAt | DateTime | @default(now()) |

**Note**: No `updatedAt`.

**Constraints**: `@@unique([flowId, reviewerId])`.

**Relations**: `flow` (MarketplaceFlow, required, **onDelete: Cascade**), `reviewer` (User, required).

---

## 27. FlowClone

**Table**: `flow_clones`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| sourceFlowId | String | FK -> MarketplaceFlow.id |
| clonePipelineId | String | Plain string, **no relation** |
| userId | String | FK -> User.id |
| clonedAt | DateTime | @default(now()) |

**Note**: No `createdAt`/`updatedAt` -- uses `clonedAt`.

**Relations**: `sourceFlow` (MarketplaceFlow, required), `user` (User, required). `clonePipelineId` has **no Prisma relation** -- logical reference to a Pipeline.id.

---

## 28. FlowExecution

**Table**: `flow_executions`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| userId | String | Plain string, **no relation** |
| flowId | String | FK -> MarketplaceFlow.id |
| pipelineRunId | String? | Plain string, **no relation** |
| source | String | @default("manual") |
| createdAt | DateTime | @default(now()) |

**Note**: No `updatedAt`.

**Constraints**: `@@index([flowId])`.

**Relations**: `flow` (MarketplaceFlow, required). `userId` and `pipelineRunId` have **no Prisma relations** -- logical/implied only.

---

## 29. CreatorRevenue

**Table**: `creator_revenue`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| creatorId | String | Plain string, **no relation** |
| flowId | String | Plain string, **no relation** |
| amount | Int | |
| currency | String | @default("usd") |
| stripeTransferId | String? | |
| periodStart | DateTime | |
| periodEnd | DateTime | |
| createdAt | DateTime | @default(now()) |

**Note**: No `updatedAt`. `creatorId` and `flowId` have **no Prisma relations** -- logical/implied only.

---

## 30. FlowCategory

**Table**: `flow_categories`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| name | String | |
| slug | String | @unique |
| icon | String? | |
| description | String? | |
| sortOrder | Int | @default(0) |

**Note**: No timestamps at all, no relations.

---

## 31. MarketplaceListing

**Table**: `marketplace_listings`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| type | MarketplaceItemType | |
| ownerId | String? | FK -> User.id |
| orgId | String? | FK -> Org.id |
| title | String | |
| description | String | |
| category | String? | |
| tags | String[] | |
| manifest | Json? | |
| payloadRef | Json? | |
| version | Int | @default(1) |
| downloads | Int | @default(0) |
| forkCount | Int | @default(0) |
| ratingAvg | Float | @default(0) |
| ratingCount | Int | @default(0) |
| visibility | Visibility | @default(PUBLIC) |
| forkedFromId | String? | FK -> MarketplaceListing.id (self-ref) |
| isFeatured | Boolean | @default(false) |
| isVerified | Boolean | @default(false) |
| publishedAt | DateTime | @default(now()) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Constraints**: `@@index([type])`, `@@index([category])`, `@@index([ownerId])`, `@@index([orgId])`.

**Relations**:
- `owner` (User, optional)
- `org` (Org, optional)
- `forkedFrom` (MarketplaceListing, optional, named relation **"ListingForks"**, self-referential)
- `forks` (MarketplaceListing[], named relation **"ListingForks"**, back-relation)
- `versions` (MarketplaceListingVersion)
- `reviews` (MarketplaceReview)
- `sourceForks` (MarketplaceFork[], named relation **"SourceForks"**)
- `forkTargets` (MarketplaceFork[], named relation **"ForkTargets"**)

---

## 32. MarketplaceListingVersion

**Table**: `marketplace_listing_versions`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| listingId | String | FK -> MarketplaceListing.id |
| version | Int | |
| manifest | Json? | |
| payloadRef | Json? | |
| changelog | String? | |
| createdAt | DateTime | @default(now()) |

**Note**: No `updatedAt`.

**Constraints**: `@@unique([listingId, version])`.

**Relations**: `listing` (MarketplaceListing, required, **onDelete: Cascade**).

---

## 33. MarketplaceReview

**Table**: `marketplace_reviews`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| listingId | String | FK -> MarketplaceListing.id |
| reviewerId | String | FK -> User.id |
| stars | Int | |
| body | String? | |
| createdAt | DateTime | @default(now()) |

**Note**: No `updatedAt`.

**Constraints**: `@@unique([listingId, reviewerId])`.

**Relations**: `listing` (MarketplaceListing, required, **onDelete: Cascade**), `reviewer` (User, required).

---

## 34. MarketplaceFork

**Table**: `marketplace_forks`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| sourceId | String | FK -> MarketplaceListing.id |
| forkListingId | String | FK -> MarketplaceListing.id |
| userId | String | FK -> User.id |
| forkedAt | DateTime | @default(now()) |

**Note**: No `createdAt`/`updatedAt` -- uses `forkedAt`.

**Relations**:
- `source` (MarketplaceListing, named **"SourceForks"**, required, **onDelete: Cascade**)
- `forkListing` (MarketplaceListing, named **"ForkTargets"**, required, **onDelete: Cascade**)
- `user` (User, required)

---

## 35. OrgSubscription

**Table**: `org_subscriptions`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| orgId | String | FK -> Org.id, **@unique** |
| stripeId | String? | |
| tier | Tier | @default(FREE) |
| status | String | @default("active") |
| memberLimit | Int | @default(5) |
| membersUsed | Int | @default(0) |
| currentPeriodStart | DateTime? | |
| currentPeriodEnd | DateTime? | |
| cancelAtPeriodEnd | Boolean | @default(false) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Relations**: `org` (Org, required).

---

## 36. UsageRecord

**Table**: `usage_records`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| subjectType | String | |
| subjectId | String | Plain string, **no relation** |
| metric | String | |
| quantity | Float | |
| metadata | Json? | |
| periodStart | DateTime | |
| periodEnd | DateTime | |
| createdAt | DateTime | @default(now()) |

**Note**: No `updatedAt`. `subjectId` is polymorphic (no FK).

**Constraints**: `@@index([subjectType, subjectId, metric])`, `@@index([periodStart, periodEnd])`.

---

## 37. FrameworkConfig

**Table**: `framework_configs`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| userId | String | FK -> User.id |
| frameworkId | String | Plain string, **no relation** |
| name | String | |
| port | Int? | |
| startCommand | String? | |
| stopCommand | String? | |
| logPath | String? | |
| configPath | String? | |
| envVars | Json? | |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Constraints**: `@@unique([userId, frameworkId])`.

**Relations**: `user` (User, required). `frameworkId` has **no Prisma relation** -- logical reference.

---

## 38. FrameworkStatusRecord

**Table**: `framework_status_records`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| userId | String | Plain string, **no relation** |
| frameworkId | String | Plain string, **no relation** |
| status | FrameworkStatus | @default(UNKNOWN) |
| pid | Int? | |
| version | String? | |
| lastSeenAt | DateTime? | |

**Note**: **No timestamps at all** (no createdAt/updatedAt).

**Constraints**: `@@unique([userId, frameworkId])`.

**Relations**: none (both `userId` and `frameworkId` are logical/implied references only).

---

## 39. SystemMetricsLog

**Table**: `system_metrics_logs`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| userId | String | Plain string, **no relation** |
| frameworkId | String? | Plain string, **no relation** |
| cpuPercent | Float | |
| ramMb | Float | |
| gpuPercent | Float? | |
| vramMb | Float? | |
| temperature | Float? | |
| recordedAt | DateTime | @default(now()) |

**Note**: No `updatedAt`; no `createdAt` either (uses `recordedAt`).

**Constraints**: `@@index([userId, recordedAt])`.

**Relations**: none (both `userId` and `frameworkId` are logical/implied references only).

---

## 40. AuditLog

**Table**: `audit_logs`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| orgId | String? | Plain string, **no relation** |
| userId | String | Plain string, **no relation** |
| action | String | |
| resource | String | |
| resourceId | String? | |
| details | Json? | |
| ipAddress | String? | |
| createdAt | DateTime | @default(now()) |

**Note**: No `updatedAt`.

**Constraints**: `@@index([orgId])`, `@@index([userId])`, `@@index([createdAt])`.

**Relations**: none (all references are logical/implied).

---

## 41. Subscription

**Table**: `subscriptions`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| userId | String | **@unique**, plain string, **no relation** |
| stripeId | String? | |
| tier | Tier | @default(FREE) |
| status | String | @default("active") |
| currentPeriodStart | DateTime? | |
| currentPeriodEnd | DateTime? | |
| cancelAtPeriodEnd | Boolean | @default(false) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Relations**: none (`userId` is logical/implied reference to User).

---

## 42. CronJob

**Table**: `cron_jobs`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| userId | String | Plain string, **no relation** |
| name | String | |
| expression | String | |
| pipelineId | String | Plain string, **no relation** |
| channel | String? | |
| isActive | Boolean | @default(true) |
| lastRunAt | DateTime? | |
| nextRunAt | DateTime? | |
| runCount | Int | @default(0) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Constraints**: `@@index([userId])`.

**Relations**: none (`userId` and `pipelineId` are logical/implied references).

---

## 43. Notification

**Table**: `notifications`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| userId | String | Plain string, **no relation** |
| type | String | |
| title | String | |
| body | String? | |
| read | Boolean | @default(false) |
| data | Json? | |
| createdAt | DateTime | @default(now()) |

**Note**: No `updatedAt`.

**Constraints**: `@@index([userId, read])`.

**Relations**: none (`userId` is logical/implied reference to User).

---

## 44. KnowledgeBase

**Table**: `knowledge_bases`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| userId | String? | FK -> User.id |
| groupId | String? | FK -> HostGroup.id |
| name | String | |
| description | String? | |
| model | String | @default("nomic-embed-text") |
| status | KnowledgeBaseStatus | @default(READY) |
| totalDocs | Int | @default(0) |
| totalChunks | Int | @default(0) |
| totalSize | BigInt | @default(0) |
| hostGroupId | String? | |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Constraints**: `@@index([userId])`, `@@index([groupId])`.

**Relations**: `user` (User, optional), `group` (HostGroup, optional); `documents` (KnowledgeDocument).

---

## 45. KnowledgeDocument

**Table**: `knowledge_documents`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| kbId | String | FK -> KnowledgeBase.id |
| name | String | |
| type | DocumentType | @default(TXT) |
| size | Int | @default(0) |
| chunks | Int | @default(0) |
| status | DocumentStatus | @default(INDEXING) |
| content | String? | |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Constraints**: `@@index([kbId])`.

**Relations**: `kb` (KnowledgeBase, required, **onDelete: Cascade**).

---

## 46. Agent

**Table**: `agents`

| Field | Type | Flags |
|---|---|---|
| id | String | @id @default(cuid()) |
| userId | String | Plain string, **no relation** |
| name | String | |
| description | String? | |
| model | String | @default("mistral:7b") |
| status | AgentStatus | @default(STOPPED) |
| tools | Int | @default(0) |
| temperature | Float | @default(0.3) |
| maxTokens | Int | @default(2048) |
| memory | String | @default("0.5 GB") |
| messages | Int | @default(0) |
| successRate | Float | @default(100) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

**Constraints**: `@@index([userId])`.

**Relations**: none (`userId` is logical/implied reference to User).

---

## CJK / Json / Float[] Column Index

| Model | Column | Type |
|---|---|---|
| Session | embedding | Float[] |
| Memory | embedding | Float[] |
| Message | toolCalls | Json? |
| Message | toolResults | Json? |
| Org | samlConfig | Json? |
| User | webauthnCredentials | Json? |
| Pipeline | graph | Json |
| Pipeline | versionHistory | Json? |
| Pipeline | hostSource | Json? |
| PipelineProposal | baseGraph | Json? |
| PipelineProposal | proposedGraph | Json |
| PipelineProposal | diff | Json? |
| PipelineRun | input | Json? |
| PipelineRun | output | Json? |
| RunLog | input | Json? |
| RunLog | output | Json? |
| HostConnection | groups | Json |
| McpServer | args | Json? |
| McpServer | headers | Json? |
| FrameworkConfig | envVars | Json? |
| AuditLog | details | Json? |
| UsageRecord | metadata | Json? |
| Notification | data | Json? |
| MarketplaceSkill | manifest | Json |
| SkillVersion | manifest | Json |
| MarketplaceListing | manifest | Json? |
| MarketplaceListing | payloadRef | Json? |
| MarketplaceListingVersion | manifest | Json? |
| MarketplaceListingVersion | payloadRef | Json? |
| KnowledgeBase | (totalSize is BigInt) | BigInt |
| MarketplaceSkill | tags | String[] |
| Pipeline | tags | String[] |
| MarketplaceFlow | tags | String[] |
| MarketplaceListing | tags | String[] |
