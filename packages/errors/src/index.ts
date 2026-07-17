export class FlowMindError extends Error {
  code: string
  readonly statusCode: number
  readonly retryable: boolean
  readonly context?: Record<string, unknown>

  constructor(
    message: string,
    opts: { code: string; statusCode?: number; retryable?: boolean; context?: Record<string, unknown> }
  ) {
    super(message)
    this.name = this.constructor.name
    this.code = opts.code
    this.statusCode = opts.statusCode ?? 500
    this.retryable = opts.retryable ?? false
    this.context = opts.context
  }
}

export class PipelineError extends FlowMindError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, { code: "PIPELINE_ERROR", statusCode: 500, context })
  }
}

export class NodeExecutionError extends FlowMindError {
  readonly nodeId: string
  readonly nodeType: string

  constructor(nodeId: string, nodeType: string, message: string, context?: Record<string, unknown>) {
    super(message, { code: "NODE_EXECUTION_ERROR", statusCode: 500, context })
    this.nodeId = nodeId
    this.nodeType = nodeType
  }
}

export class GraphValidationError extends FlowMindError {
  readonly errors: string[]

  constructor(errors: string[]) {
    super(`Graph validation failed: ${errors.join(", ")}`, {
      code: "GRAPH_VALIDATION_ERROR",
      statusCode: 400,
      context: { errors },
    })
    this.errors = errors
  }
}

export class CredentialError extends FlowMindError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, { code: "CREDENTIAL_ERROR", statusCode: 401, retryable: false, context })
  }
}

export class LLMError extends FlowMindError {
  readonly provider?: string
  readonly model?: string

  constructor(message: string, opts?: { provider?: string; model?: string; retryable?: boolean; context?: Record<string, unknown> }) {
    super(message, {
      code: "LLM_ERROR",
      statusCode: 502,
      retryable: opts?.retryable ?? true,
      context: opts?.context,
    })
    this.provider = opts?.provider
    this.model = opts?.model
  }
}

export class ProviderUnavailableError extends LLMError {
  constructor(provider: string, context?: Record<string, unknown>) {
    super(`Provider "${provider}" is unavailable`, { provider, retryable: true, context })
    this.code = "PROVIDER_UNAVAILABLE"
  }
}

export class RateLimitError extends LLMError {
  readonly retryAfterMs?: number

  constructor(provider: string, retryAfterMs?: number) {
    super(`Rate limited by provider "${provider}"`, { provider, retryable: true })
    this.code = "RATE_LIMIT_ERROR"
    this.retryAfterMs = retryAfterMs
  }
}

export class ContextLengthError extends LLMError {
  constructor(model: string, tokenCount: number, maxTokens: number) {
    super(`Context length exceeded: ${tokenCount} tokens (max: ${maxTokens}) for model "${model}"`, {
      model,
      retryable: false,
      context: { tokenCount, maxTokens },
    })
    this.code = "CONTEXT_LENGTH_ERROR"
  }
}

export class SkillError extends FlowMindError {
  readonly skillId: string

  constructor(skillId: string, message: string, context?: Record<string, unknown>) {
    super(message, { code: "SKILL_ERROR", statusCode: 500, context })
    this.skillId = skillId
  }
}

export class MCPError extends FlowMindError {
  readonly serverName?: string

  constructor(message: string, serverName?: string, context?: Record<string, unknown>) {
    super(message, { code: "MCP_ERROR", statusCode: 502, retryable: true, context })
    this.serverName = serverName
  }
}

export class ToolNotFoundError extends FlowMindError {
  readonly toolName: string

  constructor(toolName: string) {
    super(`Tool not found: ${toolName}`, { code: "TOOL_NOT_FOUND", statusCode: 404 })
    this.toolName = toolName
  }
}

export class ToolExecutionError extends FlowMindError {
  readonly toolName: string

  constructor(toolName: string, message: string, context?: Record<string, unknown>) {
    super(message, { code: "TOOL_EXECUTION_ERROR", statusCode: 500, context })
    this.toolName = toolName
  }
}

export class ChannelError extends FlowMindError {
  readonly channelType: string

  constructor(channelType: string, message: string, context?: Record<string, unknown>) {
    super(message, { code: "CHANNEL_ERROR", statusCode: 502, retryable: true, context })
    this.channelType = channelType
  }
}

export class AuthError extends FlowMindError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, { code: "AUTH_ERROR", statusCode: 401, retryable: false, context })
  }
}
