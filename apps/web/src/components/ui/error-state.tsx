import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ErrorStateProps {
  message: string
  code?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({ message, code, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 mb-4">
        <AlertCircle className="h-6 w-6 text-red-500" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">{message}</p>
      {code && (
        <p className="text-xs text-muted-foreground font-mono mb-4">{code}</p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  )
}
