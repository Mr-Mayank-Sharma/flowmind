import { useState, useEffect, useCallback, useRef } from "react"

interface QueryState<T> {
  data: T | undefined
  loading: boolean
  error: Error | undefined
  refetch: () => void
}

interface QueryOptions {
  enabled?: boolean
  staleTime?: number
}

export function useQuery<T>(
  key: string | null | undefined,
  fetcher: () => Promise<T>,
  options: QueryOptions = {},
): QueryState<T> {
  const { enabled = true } = options
  const [data, setData] = useState<T | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>(undefined)
  const staleCache = useRef<Map<string, { data: T; timestamp: number }>>(new Map())
  const staleTime = options.staleTime ?? 30_000

  const execute = useCallback(async () => {
    if (!key) return

    const cached = staleCache.current.get(key)
    if (cached && Date.now() - cached.timestamp < staleTime) {
      setData(cached.data)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(undefined)
    try {
      const result = await fetcher()
      staleCache.current.set(key, { data: result, timestamp: Date.now() })
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [key, fetcher, staleTime])

  useEffect(() => {
    if (enabled) execute()
  }, [enabled, execute])

  return { data, loading, error, refetch: execute }
}

interface MutationState<TInput, TOutput> {
  mutate: (input: TInput) => Promise<TOutput | undefined>
  loading: boolean
  error: Error | undefined
  reset: () => void
}

export function useMutation<TInput, TOutput>(
  mutationFn: (input: TInput) => Promise<TOutput>,
  options?: {
    onSuccess?: (data: TOutput) => void
    onError?: (error: Error) => void
  },
): MutationState<TInput, TOutput> {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>(undefined)

  const mutate = useCallback(async (input: TInput) => {
    setLoading(true)
    setError(undefined)
    try {
      const result = await mutationFn(input)
      options?.onSuccess?.(result)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      options?.onError?.(error)
    } finally {
      setLoading(false)
    }
  }, [mutationFn, options])

  return { mutate, loading, error, reset: () => setError(undefined) }
}
