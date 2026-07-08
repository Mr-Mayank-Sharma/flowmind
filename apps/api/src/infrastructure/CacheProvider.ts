interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class CacheProvider {
  private store = new Map<string, CacheEntry<unknown>>()
  private readonly defaultTtlMs: number

  constructor(defaultTtlMs = 30_000) {
    this.defaultTtlMs = defaultTtlMs
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    })
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  get size(): number {
    return this.store.size
  }

  evictExpired(): number {
    const now = Date.now()
    let evicted = 0
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key)
        evicted++
      }
    }
    return evicted
  }
}

export const cacheProvider = new CacheProvider()
