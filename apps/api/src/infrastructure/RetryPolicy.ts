export interface RetryOptions {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  exponentialBackoff: boolean
  retryOn: (error: Error) => boolean
}

const defaultOptions: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 200,
  maxDelayMs: 5_000,
  exponentialBackoff: true,
  retryOn: () => true,
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<T> {
  const opts = { ...defaultOptions, ...options }
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt === opts.maxRetries) break
      if (!opts.retryOn(lastError)) break

      const delay = opts.exponentialBackoff
        ? Math.min(opts.baseDelayMs * Math.pow(2, attempt), opts.maxDelayMs)
        : opts.baseDelayMs

      await new Promise((r) => setTimeout(r, delay))
    }
  }

  throw lastError ?? new Error("Retry failed")
}
