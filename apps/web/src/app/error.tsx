"use client"

import * as Sentry from "@sentry/react"
import { ErrorState } from "@/components/ui/error-state"
import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error)
    }
  }, [error])

  return (
    <div className="min-h-screen">
      <ErrorState
        message={error.message || "An unexpected error occurred. Please try again."}
        onRetry={reset}
      />
    </div>
  )
}
