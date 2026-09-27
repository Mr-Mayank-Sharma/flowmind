export enum UserRole {
  USER = "USER",
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN",
}

export enum OrgRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
  VIEWER = "VIEWER",
}

export enum Tier {
  FREE = "FREE",
  PRO = "PRO",
  TEAM = "TEAM",
  ENTERPRISE = "ENTERPRISE",
}

export enum MessageRole {
  USER = "USER",
  ASSISTANT = "ASSISTANT",
  SYSTEM = "SYSTEM",
  TOOL = "TOOL",
}

export enum PipelineStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
}

export enum RunStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export enum FrameworkStatus {
  RUNNING = "RUNNING",
  STOPPED = "STOPPED",
  ERROR = "ERROR",
  UNKNOWN = "UNKNOWN",
}

export enum Visibility {
  PRIVATE = "PRIVATE",
  PUBLIC = "PUBLIC",
  TEAM = "TEAM",
}

export enum MarketplaceItemType {
  SKILL = "SKILL",
  PIPELINE = "PIPELINE",
  WORKFLOW = "WORKFLOW",
  PROMPT_PACK = "PROMPT_PACK",
  AGENT_TEMPLATE = "AGENT_TEMPLATE",
  MCP_INTEGRATION = "MCP_INTEGRATION",
  PLUGIN = "PLUGIN",
}

/**
 * Where a listing's executable payload lives.
 *
 * INLINE   - the payload is in `manifest` (a skill's code + entrypoint, a plugin bundle)
 * REFERENCE- the payload lives elsewhere and `payloadRef` points at it (a flow's pipelineId)
 * NONE     - there is nothing to execute; the listing is documentation or a prompt document
 */
export enum MarketplacePayloadState {
  INLINE = "INLINE",
  REFERENCE = "REFERENCE",
  NONE = "NONE",
}

/**
 * Item types that are only useful if a consumer can actually run them. Publishing one
 * without a payload produces a dead listing, so the API rejects it instead.
 * PROMPT_PACK is deliberately absent: a pack of prompts is content, not code.
 */
export const EXECUTABLE_ITEM_TYPES: readonly MarketplaceItemType[] = [
  MarketplaceItemType.SKILL,
  MarketplaceItemType.PIPELINE,
  MarketplaceItemType.WORKFLOW,
  MarketplaceItemType.AGENT_TEMPLATE,
  MarketplaceItemType.MCP_INTEGRATION,
  MarketplaceItemType.PLUGIN,
]

export function requiresExecutablePayload(type: MarketplaceItemType): boolean {
  return EXECUTABLE_ITEM_TYPES.includes(type)
}

export type PayloadResolution = {
  state: MarketplacePayloadState
  executable: boolean
  /** Set when `executable` is false, so the UI can say why instead of guessing. */
  reason?: string
}

/**
 * Single source of truth for "can this listing be run?". Both payload fields win over the
 * persisted state so a row whose state drifted still reports the truth about its content.
 */
export function resolvePayloadState(
  type: MarketplaceItemType,
  payload: { manifest?: unknown; payloadRef?: unknown; state?: MarketplacePayloadState } | null | undefined,
): PayloadResolution {
  const hasManifest = payload?.manifest != null
  const hasRef = payload?.payloadRef != null

  const state = hasManifest
    ? MarketplacePayloadState.INLINE
    : hasRef
      ? MarketplacePayloadState.REFERENCE
      : (payload?.state ?? MarketplacePayloadState.NONE)

  if (state === MarketplacePayloadState.NONE) {
    return requiresExecutablePayload(type)
      ? { state, executable: false, reason: `${type} listings need a manifest or payloadRef to be executable` }
      : { state, executable: false, reason: `${type} listings are content only` }
  }

  return { state, executable: true }
}

/** The three tables the marketplace can read from, normalized onto one shape. */
export type CatalogSource = "listing" | "skill" | "flow"

export type CatalogEntry = {
  source: CatalogSource
  id: string
  type: MarketplaceItemType
  title: string
  description: string
  category: string | null
  tags: string[]
  downloads: number
  ratingAvg: number
  ratingCount: number
  version: string
  /** ISO timestamp; skills and flows use different columns, so the catalog normalizes them. */
  publishedAt: string
  ownerName: string | null
  /** Only listings carry curation state; skills and flows have no such column. */
  isVerified: boolean
  payload: PayloadResolution
}

export type User = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
  tier: Tier;
  orgId: string | null;
  stripeId: string | null;
  createdAt: Date;
};

export type Session = {
  id: string;
  userId: string;
  title: string | null;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Message = {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  error: boolean;
  toolCalls: ToolCall[] | null;
  toolResults: ToolResult[] | null;
  model: string | null;
  provider: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  createdAt: Date;
};

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ToolResult = {
  toolCallId: string;
  output: unknown;
  error: string | null;
  duration: number;
};

export type PipelineNode = {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
};

export type PipelineEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  label: string | null;
};

export type DAGGraph = {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
};

export type Pipeline = {
  id: string;
  userId: string | null;
  orgId: string | null;
  name: string;
  description: string | null;
  graph: DAGGraph;
  isActive: boolean;
  isPublic: boolean;
  version: number;
  versionHistory: DAGGraph[];
  category: string | null;
  tags: string[];
  icon: string | null;
  runCount: number;
  lastRunAt: Date | null;
  avgDurationMs: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Skill = {
  id: string;
  userId: string;
  name: string;
  description: string;
  triggerPattern: string | null;
  code: string;
  version: number;
  successRate: number | null;
  useCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Memory = {
  id: string;
  userId: string;
  sessionId: string | null;
  content: string;
  summary: string | null;
  type: string;
  relevanceScore: number | null;
  createdAt: Date;
};

export type Org = {
  id: string;
  name: string;
  slug: string;
  samlConfig: Record<string, unknown> | null;
  tier: Tier;
  billingId: string | null;
  createdAt: Date;
};

export type MarketplaceFlow = {
  id: string;
  pipelineId: string;
  creatorId: string;
  category: string;
  title: string;
  description: string;
  tags: string[];
  price: number | null;
  downloads: number;
  ratingAvg: number;
  isFeatured: boolean;
  isVerified: boolean;
  publishedAt: Date;
};

export type Framework = {
  id: string;
  name: string;
  type: string;
  port: number | null;
  status: FrameworkStatus;
  version: string | null;
  pid: number | null;
  lastSeenAt: Date | null;
};

export type SystemMetrics = {
  cpuPercent: number;
  ramMb: number;
  gpuPercent: number | null;
  vramMb: number | null;
  temperature: number | null;
};

export type StreamChunk = {
  type: "text" | "tool_call" | "tool_result" | "error" | "done";
  content: unknown;
  id?: string;
};

export type ModelConfig = {
  id: string;
  name: string;
  provider: string;
  isLocal: boolean;
  ollamaName: string | null;
  fallbackProvider: string | null;
  contextLength: number;
  maxTokens: number;
};

export * from "./events";
export * from "./catalog";
export * from "./permissions";
export * from "./workspace";
export * from "./commands";
export * from "./integrations";
export * from "./revert";
export * from "./questions";
