/**
 * Simple in-memory cache for API responses
 * Implements stale-while-revalidate pattern similar to Next.js ISR
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  staleTime: number;
  revalidateTime: number;
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();

  /**
   * Get cached data or fetch fresh data
   * @param key - Cache key
   * @param fetcher - Function to fetch fresh data
   * @param options - Cache options
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: {
      staleTime?: number;     // Time before data is considered stale (ms)
      revalidateTime?: number; // Time before forcing revalidation (ms)
    } = {}
  ): Promise<T> {
    const { staleTime = 60000, revalidateTime = 300000 } = options; // 1min stale, 5min revalidate

    const cached = this.cache.get(key);
    const now = Date.now();

    // Return fresh cache hit
    if (cached && now - cached.timestamp < cached.staleTime) {
      return cached.data;
    }

    // Return stale cache while revalidating in background
    if (cached && now - cached.timestamp < cached.revalidateTime) {
      // Trigger background revalidation
      this.revalidate(key, fetcher, { staleTime, revalidateTime }).catch(console.error);
      return cached.data;
    }

    // Cache miss or expired - fetch fresh data
    return this.fetch(key, fetcher, { staleTime, revalidateTime });
  }

  /**
   * Fetch fresh data and update cache
   */
  private async fetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: { staleTime: number; revalidateTime: number }
  ): Promise<T> {
    // Deduplicate concurrent requests for the same key
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending;
    }

    const promise = fetcher()
      .then((data) => {
        this.cache.set(key, {
          data,
          timestamp: Date.now(),
          staleTime: options.staleTime,
          revalidateTime: options.revalidateTime,
        });
        this.pendingRequests.delete(key);
        return data;
      })
      .catch((error) => {
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Revalidate stale cache entry in background
   */
  private async revalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: { staleTime: number; revalidateTime: number }
  ): Promise<void> {
    try {
      await this.fetch(key, fetcher, options);
    } catch (error) {
      // Silent fail - keep serving stale data
      console.error('Cache revalidation failed:', error);
    }
  }

  /**
   * Manually invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.pendingRequests.delete(key);
  }

  /**
   * Invalidate all cache entries matching pattern
   */
  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
    for (const key of this.pendingRequests.keys()) {
      if (pattern.test(key)) {
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; pending: number; keys: string[] } {
    return {
      size: this.cache.size,
      pending: this.pendingRequests.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clean up expired entries (call periodically)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.revalidateTime) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
export const apiCache = new APICache();

// Run cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => apiCache.cleanup(), 5 * 60 * 1000);
}

/**
 * Helper function for API routes to set cache headers
 */
export function setCacheHeaders(response: Response, options: {
  maxAge?: number;        // Browser cache time (seconds)
  sMaxAge?: number;       // CDN cache time (seconds)
  staleWhileRevalidate?: number; // Serve stale while revalidating (seconds)
}): Response {
  const {
    maxAge = 60,              // 1 minute browser cache
    sMaxAge = 300,            // 5 minutes CDN cache
    staleWhileRevalidate = 600, // 10 minutes stale-while-revalidate
  } = options;

  const headers = new Headers(response.headers);
  
  headers.set(
    'Cache-Control',
    `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`
  );
  
  headers.set('CDN-Cache-Control', `public, max-age=${sMaxAge}`);
  headers.set('Vercel-CDN-Cache-Control', `public, max-age=${sMaxAge}`);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default apiCache;
