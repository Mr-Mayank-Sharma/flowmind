import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const errorMessages: Record<string, string> = {
  RATE_LIMIT_ERROR: "Rate limited. Please wait a moment and retry.",
  PROVIDER_UNAVAILABLE: "AI provider is unavailable. Try a different model.",
  CONTEXT_LENGTH_ERROR: "Message too long. Try shortening your input.",
  NODE_EXECUTION_ERROR: "A pipeline node failed. Check the node configuration.",
  CREDENTIAL_ERROR: "Authentication required. Check your settings.",
  MCP_ERROR: "External tool error. The MCP server may be offline.",
  AUTH_ERROR: "Authentication failed. Please sign in again.",
  PIPELINE_ERROR: "Pipeline execution failed.",
  SKILL_ERROR: "Skill execution failed.",
  TOOL_NOT_FOUND: "Tool not found.",
  CHANNEL_ERROR: "Channel error. The service may be temporarily unavailable.",
}

interface ErrorStateProps {
  message: string
  code?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({ message, code, onRetry, className }: ErrorStateProps) {
  const friendlyMessage = code ? errorMessages[code] ?? message : message

  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">{friendlyMessage}</p>
      {code && (
        <span className="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground mb-4">
          {code}
        </span>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
