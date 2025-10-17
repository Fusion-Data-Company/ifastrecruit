import { db } from "../db";
import {
  usageTracking,
  usageAlerts,
  subscriptions,
  subscriptionPlans,
  InsertUsageTracking,
  UsageTracking
} from "@shared/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { subscriptionService } from "./subscription.service";

export type UsageMetric = 
  | "messages" 
  | "storage" 
  | "api_calls" 
  | "active_users" 
  | "integrations" 
  | "file_uploads";

interface UsageStats {
  metric: UsageMetric;
  current: number;
  limit: number;
  percentage: number;
  remaining: number;
  period: {
    start: Date;
    end: Date;
  };
}

interface UsageSummary {
  workspaceId: string;
  subscriptionId?: string;
  planTier: string;
  stats: UsageStats[];
  alerts: Array<{
    metric: UsageMetric;
    threshold: number;
    message: string;
  }>;
}

export class UsageTrackingService {
  private static instance: UsageTrackingService;
  private trackingQueue: Map<string, any[]> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start background flush process
    this.startBackgroundFlush();
  }

  static getInstance(): UsageTrackingService {
    if (!UsageTrackingService.instance) {
      UsageTrackingService.instance = new UsageTrackingService();
    }
    return UsageTrackingService.instance;
  }

  // ============================================================================
  // REAL-TIME TRACKING
  // ============================================================================

  async track(
    metric: UsageMetric,
    workspaceId: string,
    value: number = 1,
    userId?: string,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      // Get subscription for this workspace
      const subscription = await subscriptionService.getSubscription(workspaceId);
      
      const now = new Date();
      const trackingData: InsertUsageTracking = {
        workspaceId,
        subscriptionId: subscription?.id,
        userId,
        metric,
        value,
        timestamp: now,
        periodStart: subscription?.currentPeriodStart || this.getPeriodStart(now),
        periodEnd: subscription?.currentPeriodEnd || this.getPeriodEnd(now),
        context
      };

      // Add to queue for batch processing
      this.addToQueue(workspaceId, trackingData);

      // Check if immediate alert is needed
      if (subscription) {
        await this.checkImmediateAlert(workspaceId, subscription.id, metric, value);
      }
    } catch (error) {
      console.error(`Failed to track usage metric ${metric}:`, error);
    }
  }

  private addToQueue(workspaceId: string, data: InsertUsageTracking): void {
    if (!this.trackingQueue.has(workspaceId)) {
      this.trackingQueue.set(workspaceId, []);
    }
    this.trackingQueue.get(workspaceId)!.push(data);

    // If queue is getting large, flush immediately
    if (this.trackingQueue.get(workspaceId)!.length >= 100) {
      this.flushWorkspace(workspaceId);
    }
  }

  private async flushWorkspace(workspaceId: string): Promise<void> {
    const items = this.trackingQueue.get(workspaceId);
    if (!items || items.length === 0) return;

    this.trackingQueue.set(workspaceId, []);

    try {
      // Batch insert all tracking data
      await db.insert(usageTracking).values(items);
      
      // Check for usage alerts after flush
      const subscription = await subscriptionService.getSubscription(workspaceId);
      if (subscription) {
        const metrics = [...new Set(items.map(item => item.metric))];
        for (const metric of metrics) {
          await subscriptionService.checkUsageAlerts(workspaceId, subscription.id, metric as UsageMetric);
        }
      }
    } catch (error) {
      console.error(`Failed to flush usage tracking for workspace ${workspaceId}:`, error);
      // Put items back in queue to retry
      if (!this.trackingQueue.has(workspaceId)) {
        this.trackingQueue.set(workspaceId, []);
      }
      this.trackingQueue.get(workspaceId)!.unshift(...items);
    }
  }

  private startBackgroundFlush(): void {
    // Flush all queues every 30 seconds
    this.flushInterval = setInterval(async () => {
      const workspaceIds = Array.from(this.trackingQueue.keys());
      for (const workspaceId of workspaceIds) {
        await this.flushWorkspace(workspaceId);
      }
    }, 30000);
  }

  stopBackgroundFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  // ============================================================================
  // USAGE STATISTICS
  // ============================================================================

  async getUsageStats(workspaceId: string): Promise<UsageSummary> {
    const subscription = await subscriptionService.getSubscription(workspaceId);
    
    if (!subscription) {
      return {
        workspaceId,
        planTier: "free",
        stats: [],
        alerts: []
      };
    }

    const plan = await subscriptionService.getPlanById(subscription.planId);
    if (!plan) {
      throw new Error("Invalid subscription plan");
    }

    const limits = (plan.limits || {}) as Record<string, number>;
    const stats: UsageStats[] = [];

    // Get usage for each metric in current period
    const metrics: UsageMetric[] = ["messages", "storage", "api_calls", "active_users", "integrations", "file_uploads"];
    
    for (const metric of metrics) {
      const limit = limits[metric] || -1;
      if (limit === 0) continue; // Skip metrics not available in this plan

      const current = await this.getCurrentPeriodUsage(
        workspaceId, 
        metric,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd
      );

      const percentage = limit === -1 ? 0 : (current / limit) * 100;
      const remaining = limit === -1 ? Infinity : Math.max(0, limit - current);

      stats.push({
        metric,
        current,
        limit,
        percentage,
        remaining,
        period: {
          start: subscription.currentPeriodStart,
          end: subscription.currentPeriodEnd
        }
      });
    }

    // Get active alerts
    const alerts = await this.getActiveAlerts(workspaceId, subscription.id);

    return {
      workspaceId,
      subscriptionId: subscription.id,
      planTier: plan.tier,
      stats,
      alerts: alerts.map(alert => ({
        metric: alert.metric as UsageMetric,
        threshold: alert.threshold,
        message: `You've used ${alert.threshold}% of your ${alert.metric} limit`
      }))
    };
  }

  async getCurrentPeriodUsage(
    workspaceId: string,
    metric: UsageMetric,
    periodStart: Date,
    periodEnd: Date
  ): Promise<number> {
    const result = await db
      .select({
        total: sql<number>`COALESCE(SUM(${usageTracking.value}), 0)`
      })
      .from(usageTracking)
      .where(and(
        eq(usageTracking.workspaceId, workspaceId),
        eq(usageTracking.metric, metric),
        gte(usageTracking.timestamp, periodStart),
        lte(usageTracking.timestamp, periodEnd)
      ));

    return result[0]?.total || 0;
  }

  async getHistoricalUsage(
    workspaceId: string,
    metric: UsageMetric,
    days: number = 30
  ): Promise<Array<{ date: Date; value: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const usage = await db
      .select({
        date: sql<Date>`DATE(${usageTracking.timestamp})`,
        value: sql<number>`SUM(${usageTracking.value})`
      })
      .from(usageTracking)
      .where(and(
        eq(usageTracking.workspaceId, workspaceId),
        eq(usageTracking.metric, metric),
        gte(usageTracking.timestamp, startDate)
      ))
      .groupBy(sql`DATE(${usageTracking.timestamp})`)
      .orderBy(sql`DATE(${usageTracking.timestamp})`);

    return usage;
  }

  // ============================================================================
  // ALERTS
  // ============================================================================

  async getActiveAlerts(workspaceId: string, subscriptionId?: string) {
    const conditions = [
      eq(usageAlerts.workspaceId, workspaceId),
      eq(usageAlerts.acknowledged, false)
    ];

    if (subscriptionId) {
      conditions.push(eq(usageAlerts.subscriptionId, subscriptionId));
    }

    return await db
      .select()
      .from(usageAlerts)
      .where(and(...conditions))
      .orderBy(desc(usageAlerts.alertedAt));
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    await db
      .update(usageAlerts)
      .set({
        acknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date()
      })
      .where(eq(usageAlerts.id, alertId));
  }

  private async checkImmediateAlert(
    workspaceId: string,
    subscriptionId: string,
    metric: UsageMetric,
    newValue: number
  ): Promise<void> {
    // Only check for 100% threshold immediately
    const subscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1)
      .then(rows => rows[0]);

    if (!subscription) return;

    const plan = await subscriptionService.getPlanById(subscription.planId);
    if (!plan || !plan.limits) return;

    const limits = plan.limits as Record<string, number>;
    const limit = limits[metric];
    if (!limit || limit === -1) return;

    const currentUsage = await this.getCurrentPeriodUsage(
      workspaceId,
      metric,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd
    );

    if (currentUsage >= limit) {
      // Check if we already have a 100% alert
      const existingAlert = await db
        .select()
        .from(usageAlerts)
        .where(and(
          eq(usageAlerts.workspaceId, workspaceId),
          eq(usageAlerts.metric, metric),
          eq(usageAlerts.threshold, 100),
          gte(usageAlerts.alertedAt, subscription.currentPeriodStart)
        ))
        .limit(1)
        .then(rows => rows[0]);

      if (!existingAlert) {
        await db.insert(usageAlerts).values({
          workspaceId,
          subscriptionId,
          metric,
          threshold: 100,
          currentUsage,
          limit,
          notificationChannels: ["in-app", "email"],
          notificationSent: true
        });

        // Emit event for real-time notification
        console.log(`⚠️ USAGE LIMIT REACHED: ${workspaceId} has reached 100% of ${metric} limit`);
      }
    }
  }

  // ============================================================================
  // USAGE REPORTS
  // ============================================================================

  async generateUsageReport(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    period: { start: Date; end: Date };
    metrics: Record<UsageMetric, {
      total: number;
      daily: Array<{ date: Date; value: number }>;
      peak: { date: Date; value: number };
    }>;
    cost: number;
  }> {
    const metrics: UsageMetric[] = ["messages", "storage", "api_calls", "active_users", "integrations", "file_uploads"];
    const report: Record<string, any> = {};

    for (const metric of metrics) {
      const daily = await db
        .select({
          date: sql<Date>`DATE(${usageTracking.timestamp})`,
          value: sql<number>`SUM(${usageTracking.value})`
        })
        .from(usageTracking)
        .where(and(
          eq(usageTracking.workspaceId, workspaceId),
          eq(usageTracking.metric, metric),
          gte(usageTracking.timestamp, startDate),
          lte(usageTracking.timestamp, endDate)
        ))
        .groupBy(sql`DATE(${usageTracking.timestamp})`)
        .orderBy(sql`DATE(${usageTracking.timestamp})`);

      const total = daily.reduce((sum, day) => sum + day.value, 0);
      const peak = daily.reduce((max, day) => 
        day.value > max.value ? day : max, 
        { date: startDate, value: 0 }
      );

      report[metric] = {
        total,
        daily,
        peak
      };
    }

    // Calculate estimated cost based on usage
    const subscription = await subscriptionService.getSubscription(workspaceId);
    const cost = subscription ? await this.calculateUsageCost(workspaceId, subscription.id, startDate, endDate) : 0;

    return {
      period: { start: startDate, end: endDate },
      metrics: report as any,
      cost
    };
  }

  private async calculateUsageCost(
    workspaceId: string,
    subscriptionId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    // Get subscription and plan
    const subscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1)
      .then(rows => rows[0]);

    if (!subscription) return 0;

    const plan = await subscriptionService.getPlanById(subscription.planId);
    if (!plan) return 0;

    // Base cost
    let cost = plan.price;

    // Add per-user costs if applicable
    if (plan.pricePerUser && plan.pricePerUser > 0) {
      const activeUsers = await this.getCurrentPeriodUsage(
        workspaceId,
        "active_users",
        startDate,
        endDate
      );
      cost += plan.pricePerUser * activeUsers;
    }

    // Add overage charges if any (enterprise plans might have custom overage rates)
    // This would be configured in the plan metadata

    return cost;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private getPeriodStart(date: Date): Date {
    const start = new Date(date);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private getPeriodEnd(date: Date): Date {
    const end = new Date(date);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
    return end;
  }
}

export const usageTrackingService = UsageTrackingService.getInstance();