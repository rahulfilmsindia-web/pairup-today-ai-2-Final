import { useState, useEffect, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
}

const memoryCache = new Map<string, CacheEntry<any>>();

export const CACHE_STALE_TIMES = {
  PROFILE: 5 * 60 * 1000,    // 5 minutes
  DISCOVERY: 2 * 60 * 1000,  // 2 minutes
  BOOKINGS: 1 * 60 * 1000,   // 1 minute
  STATIC: 10 * 60 * 1000     // 10 minutes
};

/**
 * Executes or deduplicates an asynchronous data fetch with Stale-While-Revalidate caching.
 */
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { staleTime?: number; forceRefresh?: boolean } = {}
): Promise<T> {
  const staleTime = options.staleTime ?? CACHE_STALE_TIMES.DISCOVERY;
  const now = Date.now();
  const cached = memoryCache.get(key);

  if (!options.forceRefresh && cached) {
    if (now - cached.timestamp < staleTime) {
      return cached.data;
    }
    // Stale: If a fetch is already in flight, reuse it
    if (cached.promise) {
      return cached.promise;
    }
  }

  const promise = fetcher()
    .then((data) => {
      memoryCache.set(key, { data, timestamp: Date.now() });
      return data;
    })
    .finally(() => {
      const entry = memoryCache.get(key);
      if (entry) delete entry.promise;
    });

  if (cached) {
    cached.promise = promise;
  } else {
    memoryCache.set(key, { data: null as any, timestamp: 0, promise });
  }

  return promise;
}

/**
 * Invalidates cache entries matching an exact key or key prefix.
 */
export function invalidateClientCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Lightweight React Hook providing SWR-style client caching with staleTime.
 */
export function useClientQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: { staleTime?: number; enabled?: boolean } = {}
) {
  const enabled = options.enabled ?? true;
  const staleTime = options.staleTime ?? CACHE_STALE_TIMES.PROFILE;

  const getInitialData = (): T | undefined => {
    if (!key) return undefined;
    const cached = memoryCache.get(key);
    return cached?.data;
  };

  const [data, setData] = useState<T | undefined>(getInitialData);
  const [loading, setLoading] = useState<boolean>(!getInitialData() && enabled && !!key);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(
    async (force = true) => {
      if (!key) return;
      try {
        setLoading(true);
        const result = await fetchWithCache(key, fetcher, { staleTime, forceRefresh: force });
        setData(result);
        setError(null);
        return result;
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [key, fetcher, staleTime]
  );

  useEffect(() => {
    if (!enabled || !key) return;
    refetch(false);
  }, [key, enabled, refetch]);

  return { data, loading, error, refetch };
}
