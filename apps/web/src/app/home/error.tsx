"use client"

import { ErrorState } from "@/components/ui/error-state"

export default function HomeError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-[400px]">
      <ErrorState
        message={error.message || "Dashboard error"}
        onRetry={reset}
      />
    </div>
  )
}
