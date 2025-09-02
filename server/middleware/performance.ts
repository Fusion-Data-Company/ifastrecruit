import type { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { cacheManager, CacheKeyBuilder } from '../services/cache';

// Performance monitoring middleware
export interface PerformanceMetric {
  endpoint: string;
  method: string;
  duration: number;
  timestamp: number;
  statusCode: number;
  userAgent?: string;
  ip?: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 10000; // Keep last 10k metrics

  addMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  getMetrics(timeframe: number = 3600000): PerformanceMetric[] {
    const cutoff = Date.now() - timeframe;
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  getAggregatedMetrics(timeframe: number = 3600000) {
    const recentMetrics = this.getMetrics(timeframe);
    
    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        medianResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        requestsPerSecond: 0,
        slowestEndpoints: [],
        fastestEndpoints: [],
        statusCodeDistribution: {},
      };
    }

    // Calculate basic stats
    const durations = recentMetrics.map(m => m.duration).sort((a, b) => a - b);
    const totalRequests = recentMetrics.length;
    const averageResponseTime = durations.reduce((a, b) => a + b, 0) / totalRequests;
    const medianResponseTime = durations[Math.floor(durations.length / 2)];
    const p95ResponseTime = durations[Math.floor(durations.length * 0.95)];
    const p99ResponseTime = durations[Math.floor(durations.length * 0.99)];
    
    // Error rate
    const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = (errorCount / totalRequests) * 100;
    
    // Requests per second
    const timeSpan = (Math.max(...recentMetrics.map(m => m.timestamp)) - 
                     Math.min(...recentMetrics.map(m => m.timestamp))) / 1000;
    const requestsPerSecond = totalRequests / timeSpan;

    // Endpoint analysis
    const endpointStats = new Map<string, { count: number; totalTime: number; errors: number }>();
    
    recentMetrics.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`;
      const existing = endpointStats.get(key) || { count: 0, totalTime: 0, errors: 0 };
      
      existing.count++;
      existing.totalTime += metric.duration;
      if (metric.statusCode >= 400) existing.errors++;
      
      endpointStats.set(key, existing);
    });

    const endpointAnalysis = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        averageTime: stats.totalTime / stats.count,
        count: stats.count,
        errorRate: (stats.errors / stats.count) * 100,
      }));

    const slowestEndpoints = endpointAnalysis
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10);

    const fastestEndpoints = endpointAnalysis
      .filter(e => e.count >= 5) // Only consider endpoints with sufficient data
      .sort((a, b) => a.averageTime - b.averageTime)
      .slice(0, 10);

    // Status code distribution
    const statusCodeDistribution: Record<string, number> = {};
    recentMetrics.forEach(metric => {
      const code = metric.statusCode.toString();
      statusCodeDistribution[code] = (statusCodeDistribution[code] || 0) + 1;
    });

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      medianResponseTime: Math.round(medianResponseTime),
      p95ResponseTime: Math.round(p95ResponseTime),
      p99ResponseTime: Math.round(p99ResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
      slowestEndpoints,
      fastestEndpoints,
      statusCodeDistribution,
    };
  }

  clearMetrics() {
    this.metrics = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Performance tracking middleware
export const performanceTracker = (req: Request, res: Response, next: NextFunction) => {
  const start = performance.now();
  
  res.on('finish', () => {
    const duration = Math.round(performance.now() - start);
    
    performanceMonitor.addMetric({
      endpoint: req.route?.path || req.path,
      method: req.method,
      duration,
      timestamp: Date.now(),
      statusCode: res.statusCode,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  });
  
  next();
};

// Response compression middleware
export const compressionOptimizer = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(body: any) {
    // Set compression headers for large responses
    if (typeof body === 'string' && body.length > 1024) {
      res.set('Content-Encoding', 'gzip');
    }
    
    // Set performance headers
    const startTime = req.get('x-request-start');
    const responseTime = startTime ? Date.now() - parseInt(startTime) : 0;
    res.set('X-Response-Time', `${responseTime}ms`);
    res.set('X-Powered-By', 'iFast-Broker-Enterprise');
    
    return originalSend.call(this, body);
  };
  
  // Add request start time
  req.headers['x-request-start'] = Date.now().toString();
  
  next();
};

// Database query optimization middleware
export const queryOptimizer = (req: Request, res: Response, next: NextFunction) => {
  // Add query hints to request context
  (req as any).queryHints = {
    useIndex: true,
    cacheResults: true,
    maxResults: parseInt(req.query.limit as string) || 100,
    includeCount: req.query.includeCount === 'true',
  };
  
  next();
};

// Memory usage monitoring
export const memoryMonitor = () => {
  const memUsage = process.memoryUsage();
  
  return {
    rss: Math.round(memUsage.rss / 1024 / 1024), // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024),
    arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024),
  };
};

// CPU usage monitoring
export const cpuMonitor = () => {
  const cpuUsage = process.cpuUsage();
  
  return {
    user: Math.round(cpuUsage.user / 1000), // Convert to milliseconds
    system: Math.round(cpuUsage.system / 1000),
  };
};

// API response caching with intelligent cache keys
export const intelligentCaching = (ttlSeconds: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate intelligent cache key
    const cacheKey = CacheKeyBuilder.apiCall(req.originalUrl, {
      query: req.query,
      headers: {
        accept: req.get('Accept'),
        'user-agent': req.get('User-Agent'),
      },
    });

    try {
      // Check cache
      const cached = await cacheManager.get(cacheKey);
      if (cached) {
        res.set('X-Cache', 'HIT');
        res.set('Cache-Control', `public, max-age=${ttlSeconds}`);
        return res.json(cached);
      }

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function(body: any) {
        if (res.statusCode === 200) {
          cacheManager.set(cacheKey, body, ttlSeconds).catch(console.error);
        }
        
        res.set('X-Cache', 'MISS');
        res.set('Cache-Control', `public, max-age=${ttlSeconds}`);
        
        return originalJson.call(this, body);
      };

      next();
    } catch (error) {
      console.error('Caching middleware error:', error);
      next();
    }
  };
};

// Performance optimization headers
export const performanceHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Security and performance headers
  res.set({
    'X-DNS-Prefetch-Control': 'on',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  });

  // Static asset caching
  if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  next();
};

// Request size limiter for performance
export const requestSizeLimiter = (maxSizeMB: number = 10) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes
    
    if (req.headers['content-length']) {
      const contentLength = parseInt(req.headers['content-length']);
      if (contentLength > maxSize) {
        return res.status(413).json({
          error: 'Request entity too large',
          maxSizeMB,
          receivedSizeMB: Math.round(contentLength / 1024 / 1024),
        });
      }
    }
    
    next();
  };
};

// Database connection pooling optimizer
export const connectionPoolOptimizer = {
  maxConnections: process.env.NODE_ENV === 'production' ? 20 : 5,
  idleTimeout: 30000,
  connectionTimeout: 10000,
  statementTimeout: 30000,
  
  getOptimalConfig() {
    return {
      max: this.maxConnections,
      idleTimeoutMillis: this.idleTimeout,
      connectionTimeoutMillis: this.connectionTimeout,
      statementTimeoutMillis: this.statementTimeout,
    };
  },
};

// Export performance utilities
export const performanceUtils = {
  measureAsync: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      console.log(`Performance: ${name} took ${Math.round(duration)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.log(`Performance: ${name} failed after ${Math.round(duration)}ms`);
      throw error;
    }
  },

  measureSync: <T>(name: string, fn: () => T): T => {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      console.log(`Performance: ${name} took ${Math.round(duration)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.log(`Performance: ${name} failed after ${Math.round(duration)}ms`);
      throw error;
    }
  },
};