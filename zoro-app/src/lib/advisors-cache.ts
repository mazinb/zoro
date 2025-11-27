/**
 * In-memory cache for advisor queries
 * Since advisor data updates infrequently, we cache results to reduce DB load
 */

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

class AdvisorsCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly EXACT_LOOKUP_TTL = 10 * 60 * 1000; // 10 minutes for exact registration lookups

  private getCacheKey(search: string, registration: string, page: number, perPage: number): string {
    return `advisors:${search}:${registration}:${page}:${perPage}`;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl ?? this.DEFAULT_TTL);
    this.cache.set(key, { data, expiresAt });
  }

  setExactLookup<T>(key: string, data: T): void {
    this.set(key, data, this.EXACT_LOOKUP_TTL);
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  getCacheKeyForQuery(search: string, registration: string, page: number, perPage: number): string {
    return this.getCacheKey(search, registration, page, perPage);
  }
}

// Singleton instance
export const advisorsCache = new AdvisorsCache();

