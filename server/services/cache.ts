import { createHash } from 'crypto';

// Cache interface for different implementations
export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

// In-memory cache implementation for development
export class MemoryCache implements CacheService {
  private cache = new Map<string, { value: any; expiry: number | null }>();

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (item.expiry && Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiry = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
    this.cache.set(key, { value, expiry });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async has(key: string): Promise<boolean> {
    const exists = this.cache.has(key);
    if (!exists) return false;
    
    const item = this.cache.get(key)!;
    if (item.expiry && Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  // Cleanup expired entries periodically
  startCleanup(intervalSeconds = 300): void {
    setInterval(() => {
      const now = Date.now();
      const entries = Array.from(this.cache.entries());
      for (const [key, item] of entries) {
        if (item.expiry && now > item.expiry) {
          this.cache.delete(key);
        }
      }
    }, intervalSeconds * 1000);
  }

  getStats() {
    let expired = 0;
    const now = Date.now();
    
    const entries = Array.from(this.cache.entries());
    for (const [, item] of entries) {
      if (item.expiry && now > item.expiry) {
        expired++;
      }
    }
    
    return {
      size: this.cache.size,
      expired,
      active: this.cache.size - expired,
    };
  }
}

// Redis cache implementation for production
export class RedisCache implements CacheService {
  private client: any; // Redis client would be injected

  constructor(redisClient?: any) {
    this.client = redisClient;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Redis del error:', error);
    }
  }

  async clear(): Promise<void> {
    if (!this.client) return;
    
    try {
      await this.client.flushall();
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }

  async has(key: string): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }
}

// Cache manager with automatic fallback
export class CacheManager {
  private primary: CacheService;
  private fallback?: CacheService;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    errors: 0,
  };

  constructor(primary: CacheService, fallback?: CacheService) {
    this.primary = primary;
    this.fallback = fallback;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.primary.get<T>(key);
      if (value !== null) {
        this.stats.hits++;
        return value;
      }
      
      if (this.fallback) {
        const fallbackValue = await this.fallback.get<T>(key);
        if (fallbackValue !== null) {
          this.stats.hits++;
          // Populate primary cache
          await this.primary.set(key, fallbackValue);
          return fallbackValue;
        }
      }
      
      this.stats.misses++;
      return null;
    } catch (error) {
      this.stats.errors++;
      console.error('Cache get error:', error);
      
      if (this.fallback) {
        try {
          const value = await this.fallback.get<T>(key);
          if (value !== null) this.stats.hits++;
          else this.stats.misses++;
          return value;
        } catch (fallbackError) {
          console.error('Fallback cache error:', fallbackError);
        }
      }
      
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      await this.primary.set(key, value, ttlSeconds);
      if (this.fallback) {
        await this.fallback.set(key, value, ttlSeconds);
      }
      this.stats.sets++;
    } catch (error) {
      this.stats.errors++;
      console.error('Cache set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.primary.del(key);
      if (this.fallback) {
        await this.fallback.del(key);
      }
    } catch (error) {
      this.stats.errors++;
      console.error('Cache del error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.primary.clear();
      if (this.fallback) {
        await this.fallback.clear();
      }
    } catch (error) {
      this.stats.errors++;
      console.error('Cache clear error:', error);
    }
  }

  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
      : 0;
      
    return {
      ...this.stats,
      hitRate: parseFloat(hitRate.toFixed(2)),
    };
  }

  resetStats() {
    this.stats = { hits: 0, misses: 0, sets: 0, errors: 0 };
  }
}

// Cache key utilities
export class CacheKeyBuilder {
  static candidate(id: string): string {
    return `candidate:${id}`;
  }

  static candidateList(filters?: any): string {
    if (!filters) return 'candidates:all';
    const hash = createHash('md5').update(JSON.stringify(filters)).digest('hex');
    return `candidates:filtered:${hash}`;
  }

  static kpis(timeframe?: string): string {
    return `kpis:${timeframe || 'current'}`;
  }

  static apiCall(endpoint: string, params?: any): string {
    const hash = params 
      ? createHash('md5').update(JSON.stringify(params)).digest('hex')
      : 'default';
    return `api:${endpoint}:${hash}`;
  }

  static userSession(userId: string): string {
    return `session:${userId}`;
  }

  static systemStats(): string {
    return 'system:stats';
  }

  static externalApiHealth(): string {
    return 'external:health';
  }
}

// Cache decorators and helpers
export function memoize<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  cache: CacheService,
  keyBuilder: (...args: Parameters<T>) => string,
  ttlSeconds: number = 300
): T {
  return (async (...args: Parameters<T>) => {
    const key = keyBuilder(...args);
    
    // Try to get from cache first
    const cached = await cache.get(key);
    if (cached !== null) {
      return cached;
    }
    
    // Execute function and cache result
    const result = await fn(...args);
    await cache.set(key, result, ttlSeconds);
    
    return result;
  }) as T;
}

// HTTP response caching middleware
export function createCacheMiddleware(
  cache: CacheService,
  defaultTtl: number = 300
) {
  return (req: any, res: any, next: any) => {
    const originalSend = res.send;
    const cacheKey = `http:${req.method}:${req.originalUrl}`;
    
    // Check cache first for GET requests
    if (req.method === 'GET') {
      cache.get(cacheKey).then(cached => {
        if (cached) {
          res.set('X-Cache', 'HIT');
          res.set('Cache-Control', `public, max-age=${defaultTtl}`);
          return res.send(cached);
        } else {
          res.set('X-Cache', 'MISS');
          next();
        }
      }).catch(() => {
        res.set('X-Cache', 'ERROR');
        next();
      });
    } else {
      next();
    }

    // Override send to cache responses
    res.send = function(body: any) {
      if (req.method === 'GET' && res.statusCode === 200) {
        cache.set(cacheKey, body, defaultTtl).catch(console.error);
      }
      
      res.set('Cache-Control', `public, max-age=${defaultTtl}`);
      return originalSend.call(this, body);
    };
  };
}

// Global cache instances
const memoryCache = new MemoryCache();
memoryCache.startCleanup(300); // Clean up every 5 minutes

export const cacheManager = new CacheManager(memoryCache);

// Enhanced cache with performance monitoring
export class PerformanceCache extends CacheManager {
  private performanceMetrics = new Map<string, {
    count: number;
    totalTime: number;
    averageTime: number;
    lastAccess: number;
  }>();

  async get<T>(key: string): Promise<T | null> {
    const start = Date.now();
    const result = await super.get<T>(key);
    const duration = Date.now() - start;
    
    this.updateMetrics(key, duration);
    return result;
  }

  private updateMetrics(key: string, duration: number) {
    const existing = this.performanceMetrics.get(key) || {
      count: 0,
      totalTime: 0,
      averageTime: 0,
      lastAccess: 0,
    };
    
    existing.count++;
    existing.totalTime += duration;
    existing.averageTime = existing.totalTime / existing.count;
    existing.lastAccess = Date.now();
    
    this.performanceMetrics.set(key, existing);
  }

  getPerformanceMetrics() {
    const metrics = Array.from(this.performanceMetrics.entries())
      .map(([key, stats]) => ({ key, ...stats }))
      .sort((a, b) => b.averageTime - a.averageTime);
      
    return {
      topSlowest: metrics.slice(0, 10),
      topMostUsed: metrics
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      totalKeys: metrics.length,
      cacheStats: this.getStats(),
    };
  }
}

export const performanceCache = new PerformanceCache(memoryCache);