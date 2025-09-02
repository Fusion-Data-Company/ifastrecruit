import { cacheManager, CacheKeyBuilder } from "./cache";

// Database optimization and performance tuning service
export class DatabaseOptimizationService {
  private queryMetrics = new Map<string, {
    count: number;
    totalTime: number;
    averageTime: number;
    slowQueries: Array<{ query: string; duration: number; timestamp: number }>;
  }>();

  // Query performance monitoring
  async executeOptimizedQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    cacheKey?: string,
    cacheTTL: number = 300
  ): Promise<T> {
    const start = Date.now();
    
    // Try cache first if cache key provided
    if (cacheKey) {
      const cached = await cacheManager.get<T>(cacheKey);
      if (cached !== null) {
        this.recordQueryMetric(queryName, Date.now() - start, true);
        return cached;
      }
    }

    try {
      const result = await queryFn();
      const duration = Date.now() - start;
      
      // Cache the result if cache key provided
      if (cacheKey && result) {
        await cacheManager.set(cacheKey, result, cacheTTL);
      }
      
      this.recordQueryMetric(queryName, duration, false);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordQueryMetric(queryName, duration, false, true);
      throw error;
    }
  }

  private recordQueryMetric(
    queryName: string,
    duration: number,
    fromCache: boolean,
    error: boolean = false
  ) {
    const existing = this.queryMetrics.get(queryName) || {
      count: 0,
      totalTime: 0,
      averageTime: 0,
      slowQueries: [],
    };

    if (!fromCache) {
      existing.count++;
      existing.totalTime += duration;
      existing.averageTime = existing.totalTime / existing.count;

      // Track slow queries (>1000ms)
      if (duration > 1000) {
        existing.slowQueries.push({
          query: queryName,
          duration,
          timestamp: Date.now(),
        });

        // Keep only last 10 slow queries
        if (existing.slowQueries.length > 10) {
          existing.slowQueries = existing.slowQueries.slice(-10);
        }
      }
    }

    this.queryMetrics.set(queryName, existing);
  }

  // Connection pool optimization
  getOptimalPoolConfig() {
    const cores = require('os').cpus().length;
    const maxConnections = Math.min(cores * 2, 20); // Max 20 connections
    
    return {
      max: maxConnections,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      statementTimeoutMillis: 30000,
      acquireTimeoutMillis: 60000,
    };
  }

  // Index recommendations based on query patterns
  analyzeQueryPatterns() {
    const patterns = new Map<string, number>();
    
    for (const [queryName, metrics] of this.queryMetrics) {
      if (metrics.averageTime > 500) {
        patterns.set(queryName, metrics.averageTime);
      }
    }

    const recommendations = [];
    
    // Suggest indexes for slow queries
    for (const [queryName, avgTime] of patterns) {
      if (queryName.includes('candidates') && queryName.includes('search')) {
        recommendations.push({
          type: 'index',
          table: 'candidates',
          columns: ['name', 'email'],
          reason: `Search queries averaging ${avgTime}ms could benefit from composite index`,
          priority: avgTime > 1000 ? 'high' : 'medium',
        });
      }
      
      if (queryName.includes('stage') || queryName.includes('status')) {
        recommendations.push({
          type: 'index',
          table: 'candidates',
          columns: ['stage'],
          reason: `Stage filtering queries averaging ${avgTime}ms could benefit from index`,
          priority: avgTime > 1000 ? 'high' : 'medium',
        });
      }
    }

    return {
      slowQueries: Array.from(patterns.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10),
      recommendations,
      totalQueriesAnalyzed: this.queryMetrics.size,
    };
  }

  // Database statistics and health
  async getDatabaseStats() {
    try {
      // This would normally use database-specific queries
      // For now, return calculated statistics
      const queryStats = Array.from(this.queryMetrics.values());
      
      const totalQueries = queryStats.reduce((sum, stat) => sum + stat.count, 0);
      const totalTime = queryStats.reduce((sum, stat) => sum + stat.totalTime, 0);
      const averageQueryTime = totalQueries > 0 ? totalTime / totalQueries : 0;
      
      const slowQueries = queryStats
        .flatMap(stat => stat.slowQueries)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 20);

      return {
        totalQueries,
        averageQueryTime: Math.round(averageQueryTime),
        slowQueriesCount: slowQueries.length,
        slowQueries,
        topSlowQueries: Array.from(this.queryMetrics.entries())
          .sort(([,a], [,b]) => b.averageTime - a.averageTime)
          .slice(0, 10)
          .map(([name, stats]) => ({
            query: name,
            averageTime: Math.round(stats.averageTime),
            count: stats.count,
          })),
        recommendations: this.analyzeQueryPatterns().recommendations,
      };
    } catch (error) {
      console.error('Failed to get database stats:', error);
      return {
        error: 'Failed to retrieve database statistics',
        totalQueries: 0,
        averageQueryTime: 0,
        slowQueriesCount: 0,
        slowQueries: [],
        topSlowQueries: [],
        recommendations: [],
      };
    }
  }

  // Query optimization helpers
  optimizePagination(limit: number = 20, offset: number = 0) {
    // Prevent excessive limits
    const maxLimit = 1000;
    const safeLimit = Math.min(Math.max(1, limit), maxLimit);
    const safeOffset = Math.max(0, offset);
    
    return { limit: safeLimit, offset: safeOffset };
  }

  // Batch operations optimization
  async executeBatch<T>(
    operations: Array<() => Promise<T>>,
    batchSize: number = 10
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(op => op()));
      results.push(...batchResults);
    }
    
    return results;
  }

  // Transaction optimization
  async withOptimizedTransaction<T>(
    operations: (tx: any) => Promise<T>
  ): Promise<T> {
    // This would normally use the actual database transaction
    // For now, just execute the operations
    return operations(null);
  }

  // Cache warming for frequently accessed data
  async warmCache() {
    const cacheWarming = [
      this.warmCandidatesCache(),
      this.warmKPIsCache(),
      this.warmCampaignsCache(),
    ];

    await Promise.allSettled(cacheWarming);
  }

  private async warmCandidatesCache() {
    try {
      // This would normally fetch and cache recent candidates
      const cacheKey = CacheKeyBuilder.candidateList();
      await cacheManager.set(cacheKey, [], 300);
    } catch (error) {
      console.error('Failed to warm candidates cache:', error);
    }
  }

  private async warmKPIsCache() {
    try {
      const cacheKey = CacheKeyBuilder.kpis();
      await cacheManager.set(cacheKey, {
        todayApplicants: 0,
        todayApplicantsChange: 0,
        interviewsScheduled: 0,
        interviewsScheduledChange: 0,
        averageResponseTime: 0,
        averageResponseTimeChange: 0,
        conversionRate: 0,
        conversionRateChange: 0,
      }, 300);
    } catch (error) {
      console.error('Failed to warm KPIs cache:', error);
    }
  }

  private async warmCampaignsCache() {
    try {
      await cacheManager.set('campaigns:all', [], 300);
    } catch (error) {
      console.error('Failed to warm campaigns cache:', error);
    }
  }

  // Performance monitoring and alerting
  getPerformanceAlerts() {
    const alerts = [];
    
    for (const [queryName, metrics] of this.queryMetrics) {
      if (metrics.averageTime > 2000) {
        alerts.push({
          level: 'critical',
          message: `Query ${queryName} averaging ${metrics.averageTime}ms`,
          recommendation: 'Consider query optimization or indexing',
        });
      } else if (metrics.averageTime > 1000) {
        alerts.push({
          level: 'warning',
          message: `Query ${queryName} averaging ${metrics.averageTime}ms`,
          recommendation: 'Monitor query performance',
        });
      }
      
      if (metrics.slowQueries.length > 5) {
        alerts.push({
          level: 'warning',
          message: `Query ${queryName} has ${metrics.slowQueries.length} slow executions`,
          recommendation: 'Review query patterns and consider optimization',
        });
      }
    }
    
    return alerts;
  }

  // Clear metrics for cleanup
  clearMetrics() {
    this.queryMetrics.clear();
  }

  // Export performance report
  generatePerformanceReport() {
    const stats = Array.from(this.queryMetrics.entries()).map(([name, metrics]) => ({
      queryName: name,
      ...metrics,
      averageTime: Math.round(metrics.averageTime),
    }));

    return {
      summary: {
        totalQueries: stats.reduce((sum, s) => sum + s.count, 0),
        uniqueQueries: stats.length,
        averageResponseTime: Math.round(
          stats.reduce((sum, s) => sum + s.averageTime, 0) / Math.max(stats.length, 1)
        ),
        slowQueries: stats.filter(s => s.averageTime > 1000).length,
      },
      details: stats.sort((a, b) => b.averageTime - a.averageTime),
      recommendations: this.analyzeQueryPatterns().recommendations,
      alerts: this.getPerformanceAlerts(),
      timestamp: new Date().toISOString(),
    };
  }
}

// Global database optimization service
export const dbOptimizer = new DatabaseOptimizationService();

// Warm cache on startup
setTimeout(() => {
  dbOptimizer.warmCache().catch(console.error);
}, 5000); // Wait 5 seconds after startup