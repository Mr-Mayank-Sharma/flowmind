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
