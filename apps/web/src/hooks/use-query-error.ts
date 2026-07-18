export function getErrorMessage(code: string | undefined, fallback: string): string {
  const messages: Record<string, string> = {
    RATE_LIMIT_ERROR: "Rate limited. Please wait a moment and retry.",
    PROVIDER_UNAVAILABLE: "AI provider is unavailable. Try a different model.",
    CONTEXT_LENGTH_ERROR: "Message too long. Try shortening your input.",
    NODE_EXECUTION_ERROR: "A pipeline node failed. Check the node configuration.",
    CREDENTIAL_ERROR: "Authentication required. Check your settings.",
    MCP_ERROR: "External tool error. The MCP server may be offline.",
    SKILL_ERROR: "Skill execution failed. Check the skill configuration.",
    PIPELINE_ERROR: "Pipeline execution failed.",
    TOOL_NOT_FOUND: "The requested tool was not found.",
  }
  return code ? (messages[code] ?? fallback) : fallback
}
