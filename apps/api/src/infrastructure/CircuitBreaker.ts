export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: "closed" | "open" | "half-open" = "closed"

  constructor(
    private readonly threshold = 5,
    private readonly resetTimeoutMs = 30_000,
    private readonly halfOpenMaxRequests = 1,
  ) {}

  async call<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = "half-open"
      } else {
        if (fallback) return fallback()
        throw new Error("Circuit breaker is open")
      }
    }

    try {
      const result = await fn()
      if (this.state === "half-open") {
        this.state = "closed"
        this.failures = 0
      }
      return result
    } catch (err) {
      this.failures++
      this.lastFailureTime = Date.now()
      if (this.failures >= this.threshold) {
        this.state = "open"
      }
      if (fallback) return fallback()
      throw err
    }
  }

  getState(): "closed" | "open" | "half-open" {
    return this.state
  }

  reset(): void {
    this.failures = 0
    this.state = "closed"
    this.lastFailureTime = 0
  }
}
