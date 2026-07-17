"use client"

import { ErrorState } from "@/components/ui/error-state"

export default function AgentsError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-[400px]">
      <ErrorState
        message={error.message || "Failed to load agents"}
        onRetry={reset}
      />
    </div>
  )
}
