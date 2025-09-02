import { performance } from 'perf_hooks';
import { cacheManager } from './cache';
import { errorLogger } from '../middleware/errorBoundary';
import { performanceMonitor } from '../middleware/performance';

// Advanced observability and monitoring service
export class ObservabilityService {
  private metrics = new Map<string, any>();
  private alerts: Array<{
    id: string;
    level: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    timestamp: number;
    resolved: boolean;
  }> = [];

  // System health scoring
  calculateHealthScore(): {
    score: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
    factors: Record<string, { score: number; weight: number; status: string }>;
  } {
    const factors = {
      performance: this.assessPerformance(),
      errors: this.assessErrors(),
      memory: this.assessMemory(),
      cache: this.assessCache(),
      dependencies: this.assessDependencies(),
    };

    let totalScore = 0;
    let totalWeight = 0;

    Object.values(factors).forEach(factor => {
      totalScore += factor.score * factor.weight;
      totalWeight += factor.weight;
    });

    const overallScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (overallScore >= 80) status = 'healthy';
    else if (overallScore >= 60) status = 'degraded';
    else status = 'unhealthy';

    return {
      score: Math.round(overallScore),
      status,
      factors,
    };
  }

  private assessPerformance() {
    const metrics = performanceMonitor.getAggregatedMetrics();
    
    let score = 100;
    if (metrics.averageResponseTime > 1000) score -= 30;
    else if (metrics.averageResponseTime > 500) score -= 15;
    
    if (metrics.p95ResponseTime > 2000) score -= 20;
    else if (metrics.p95ResponseTime > 1000) score -= 10;
    
    if (metrics.errorRate > 5) score -= 25;
    else if (metrics.errorRate > 1) score -= 10;

    return {
      score: Math.max(0, score),
      weight: 0.3,
      status: score >= 80 ? 'good' : score >= 60 ? 'degraded' : 'poor',
    };
  }

  private assessErrors() {
    const errorStats = errorLogger.getErrorStats();
    
    let score = 100;
    if (errorStats.totalErrors > 100) score -= 40;
    else if (errorStats.totalErrors > 50) score -= 20;
    else if (errorStats.totalErrors > 10) score -= 10;

    return {
      score: Math.max(0, score),
      weight: 0.25,
      status: score >= 80 ? 'good' : score >= 60 ? 'warning' : 'critical',
    };
  }

  private assessMemory() {
    const memUsage = process.memoryUsage();
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    let score = 100;
    if (heapUsagePercent > 90) score -= 50;
    else if (heapUsagePercent > 80) score -= 30;
    else if (heapUsagePercent > 70) score -= 15;

    return {
      score: Math.max(0, score),
      weight: 0.2,
      status: score >= 80 ? 'good' : score >= 60 ? 'warning' : 'critical',
    };
  }

  private assessCache() {
    const cacheStats = cacheManager.getStats();
    
    let score = 100;
    if (cacheStats.hitRate < 50) score -= 30;
    else if (cacheStats.hitRate < 70) score -= 15;

    return {
      score: Math.max(0, score),
      weight: 0.15,
      status: score >= 80 ? 'good' : score >= 60 ? 'degraded' : 'poor',
    };
  }

  private assessDependencies() {
    // This would check external dependencies
    // For now, return a baseline score
    return {
      score: 85,
      weight: 0.1,
      status: 'good',
    };
  }

  // Alert management
  createAlert(
    level: 'info' | 'warning' | 'error' | 'critical',
    message: string
  ): string {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.alerts.push({
      id,
      level,
      message,
      timestamp: Date.now(),
      resolved: false,
    });

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    // Auto-escalate critical alerts
    if (level === 'critical') {
      this.escalateAlert(id);
    }

    return id;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }

  getActiveAlerts(level?: 'info' | 'warning' | 'error' | 'critical') {
    return this.alerts
      .filter(alert => !alert.resolved)
      .filter(alert => !level || alert.level === level)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  private escalateAlert(alertId: string) {
    // In production, this would send notifications via email, Slack, etc.
    console.error(`CRITICAL ALERT ESCALATED: ${alertId}`);
  }

  // Performance benchmarking
  async runBenchmarks(): Promise<{
    database: { readTime: number; writeTime: number; };
    cache: { readTime: number; writeTime: number; };
    memory: { allocationTime: number; gcTime: number; };
    api: { responseTime: number; throughput: number; };
  }> {
    const results = {
      database: await this.benchmarkDatabase(),
      cache: await this.benchmarkCache(),
      memory: this.benchmarkMemory(),
      api: await this.benchmarkAPI(),
    };

    // Store benchmark results
    this.metrics.set('lastBenchmark', {
      timestamp: Date.now(),
      results,
    });

    return results;
  }

  private async benchmarkDatabase() {
    const iterations = 10;
    
    // Read benchmark
    const readStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      // This would test actual database operations
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    const readTime = (performance.now() - readStart) / iterations;

    // Write benchmark
    const writeStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      // This would test actual database writes
      await new Promise(resolve => setTimeout(resolve, 2));
    }
    const writeTime = (performance.now() - writeStart) / iterations;

    return { readTime, writeTime };
  }

  private async benchmarkCache() {
    const iterations = 100;
    
    // Cache write benchmark
    const writeStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await cacheManager.set(`benchmark_${i}`, { data: `test_${i}` }, 60);
    }
    const writeTime = (performance.now() - writeStart) / iterations;

    // Cache read benchmark
    const readStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await cacheManager.get(`benchmark_${i}`);
    }
    const readTime = (performance.now() - readStart) / iterations;

    return { readTime, writeTime };
  }

  private benchmarkMemory() {
    // Memory allocation benchmark
    const allocStart = performance.now();
    const arrays = [];
    for (let i = 0; i < 1000; i++) {
      arrays.push(new Array(1000).fill(i));
    }
    const allocationTime = performance.now() - allocStart;

    // Force garbage collection if available
    const gcStart = performance.now();
    if (global.gc) {
      global.gc();
    }
    const gcTime = performance.now() - gcStart;

    return { allocationTime, gcTime };
  }

  private async benchmarkAPI() {
    // Simulate API calls
    const iterations = 10;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    const totalTime = performance.now() - start;
    const responseTime = totalTime / iterations;
    const throughput = (iterations / totalTime) * 1000; // requests per second

    return { responseTime, throughput };
  }

  // Real-time monitoring
  startRealTimeMonitoring() {
    // Monitor system health every 30 seconds
    setInterval(() => {
      this.checkSystemHealth();
    }, 30000);

    // Run benchmarks every 5 minutes
    setInterval(() => {
      this.runBenchmarks().catch(console.error);
    }, 300000);

    // Cleanup old alerts every hour
    setInterval(() => {
      this.cleanupOldAlerts();
    }, 3600000);
  }

  private checkSystemHealth() {
    const health = this.calculateHealthScore();
    
    if (health.score < 60) {
      this.createAlert('critical', `System health score dropped to ${health.score}`);
    } else if (health.score < 80) {
      this.createAlert('warning', `System health score is ${health.score}`);
    }

    // Check specific metrics
    const memUsage = process.memoryUsage();
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    if (heapUsagePercent > 90) {
      this.createAlert('critical', `Memory usage critical: ${heapUsagePercent.toFixed(1)}%`);
    }

    const errorStats = errorLogger.getErrorStats();
    if (errorStats.totalErrors > 100) {
      this.createAlert('error', `High error rate: ${errorStats.totalErrors} errors in last hour`);
    }
  }

  private cleanupOldAlerts() {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(alert => 
      alert.timestamp > oneDayAgo || !alert.resolved
    );
  }

  // Reporting
  generateReport(timeframe: number = 3600000) {
    const health = this.calculateHealthScore();
    const performanceMetrics = performanceMonitor.getAggregatedMetrics(timeframe);
    const errorStats = errorLogger.getErrorStats(timeframe);
    const cacheStats = cacheManager.getStats();
    const activeAlerts = this.getActiveAlerts();

    return {
      summary: {
        healthScore: health.score,
        status: health.status,
        totalRequests: performanceMetrics.totalRequests,
        errorRate: performanceMetrics.errorRate,
        averageResponseTime: performanceMetrics.averageResponseTime,
        cacheHitRate: cacheStats.hitRate,
        activeAlerts: activeAlerts.length,
      },
      details: {
        health,
        performance: performanceMetrics,
        errors: errorStats,
        cache: cacheStats,
        alerts: activeAlerts.slice(0, 10), // Top 10 recent alerts
      },
      recommendations: this.generateRecommendations(health, performanceMetrics, errorStats),
      timestamp: new Date().toISOString(),
    };
  }

  private generateRecommendations(health: any, performance: any, errors: any) {
    const recommendations = [];

    if (health.factors.performance.score < 70) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Consider optimizing slow endpoints and implementing caching',
      });
    }

    if (health.factors.memory.score < 70) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        message: 'Memory usage is high. Consider optimizing memory allocation or increasing resources',
      });
    }

    if (performance.errorRate > 1) {
      recommendations.push({
        type: 'reliability',
        priority: 'medium',
        message: 'Error rate is elevated. Review error logs and implement additional error handling',
      });
    }

    if (health.factors.cache.score < 70) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        message: 'Cache hit rate is low. Review caching strategy and cache key patterns',
      });
    }

    return recommendations;
  }
}

// Global observability service instance
export const observabilityService = new ObservabilityService();

// Start monitoring when module is loaded
observabilityService.startRealTimeMonitoring();