import { db } from "../db";
import {
  subscriptionPlans,
  subscriptions,
  paymentMethods,
  billingHistory,
  usageTracking,
  featureFlags,
  usageAlerts,
  SubscriptionPlan,
  Subscription,
  PaymentMethod,
  BillingHistory,
  UsageTracking,
  FeatureFlag,
  UsageAlert,
  InsertSubscription,
  InsertPaymentMethod,
  InsertBillingHistory,
  InsertUsageTracking,
  InsertUsageAlert
} from "@shared/schema";
import { eq, and, gte, lte, sql, desc, asc } from "drizzle-orm";
import Stripe from "stripe";

// Initialize Stripe client (will use env variable when available)
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-11-20.acacia" })
  : null;

export class SubscriptionService {
  private static instance: SubscriptionService;

  private constructor() {}

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  // ============================================================================
  // SUBSCRIPTION PLANS
  // ============================================================================

  async getPlans(): Promise<SubscriptionPlan[]> {
    return await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(asc(subscriptionPlans.price));
  }

  async getPlanById(planId: string): Promise<SubscriptionPlan | null> {
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);
    return plans[0] || null;
  }

  async getPlanByTier(tier: "free" | "pro" | "business" | "enterprise"): Promise<SubscriptionPlan | null> {
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(and(
        eq(subscriptionPlans.tier, tier),
        eq(subscriptionPlans.isActive, true)
      ))
      .limit(1);
    return plans[0] || null;
  }

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================

  async getSubscription(workspaceId: string): Promise<Subscription | null> {
    const subs = await db
      .select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.workspaceId, workspaceId),
        eq(subscriptions.status, "active")
      ))
      .limit(1);
    return subs[0] || null;
  }

  async createSubscription(data: InsertSubscription): Promise<Subscription> {
    const [subscription] = await db
      .insert(subscriptions)
      .values({
        ...data,
        currentPeriodStart: data.currentPeriodStart || new Date(),
        currentPeriodEnd: data.currentPeriodEnd || this.calculatePeriodEnd(data.startDate || new Date(), "monthly")
      })
      .returning();
    return subscription;
  }

  async updateSubscription(
    subscriptionId: string, 
    updates: Partial<InsertSubscription>
  ): Promise<Subscription> {
    const [updated] = await db
      .update(subscriptions)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(subscriptions.id, subscriptionId))
      .returning();
    return updated;
  }

  async cancelSubscription(
    subscriptionId: string, 
    reason?: string
  ): Promise<Subscription> {
    return await this.updateSubscription(subscriptionId, {
      status: "canceled",
      canceledAt: new Date(),
      cancelationReason: reason
    });
  }

  // ============================================================================
  // STRIPE INTEGRATION
  // ============================================================================

  async createStripeSubscription(
    workspaceId: string,
    userId: string,
    planId: string,
    paymentMethodId?: string
  ): Promise<{ subscription: Subscription; clientSecret?: string }> {
    if (!stripe) {
      throw new Error("Stripe is not configured");
    }

    const plan = await this.getPlanById(planId);
    if (!plan) {
      throw new Error("Invalid plan ID");
    }

    // Check if workspace already has subscription
    const existingSub = await this.getSubscription(workspaceId);
    if (existingSub) {
      throw new Error("Workspace already has an active subscription");
    }

    // Create or retrieve Stripe customer
    let stripeCustomerId: string;
    const customer = await stripe.customers.create({
      metadata: {
        workspaceId,
        userId
      }
    });
    stripeCustomerId = customer.id;

    // Create Stripe subscription
    const stripeSubscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: plan.name,
            metadata: {
              tier: plan.tier
            }
          },
          unit_amount: Math.round(plan.price * 100), // Convert to cents
          recurring: {
            interval: plan.billingCycle === "yearly" ? "year" : "month"
          }
        }
      }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription"
      },
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        workspaceId,
        planId,
        userId
      }
    });

    // Create subscription in our database
    const subscription = await this.createSubscription({
      workspaceId,
      userId,
      planId,
      stripeCustomerId,
      stripeSubscriptionId: stripeSubscription.id,
      status: "trialing",
      trialEndDate: plan.trialDays ? new Date(Date.now() + plan.trialDays * 24 * 60 * 60 * 1000) : undefined,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000)
    });

    const latestInvoice = stripeSubscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent;

    return {
      subscription,
      clientSecret: paymentIntent?.client_secret
    };
  }

  async upgradeDowngradePlan(
    subscriptionId: string,
    newPlanId: string
  ): Promise<Subscription> {
    const subscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1)
      .then(rows => rows[0]);

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    const newPlan = await this.getPlanById(newPlanId);
    if (!newPlan) {
      throw new Error("Invalid plan ID");
    }

    // Update Stripe subscription if configured
    if (stripe && subscription.stripeSubscriptionId) {
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
      
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        items: [{
          id: stripeSubscription.items.data[0].id,
          price_data: {
            currency: "usd",
            product_data: {
              name: newPlan.name,
              metadata: {
                tier: newPlan.tier
              }
            },
            unit_amount: Math.round(newPlan.price * 100),
            recurring: {
              interval: newPlan.billingCycle === "yearly" ? "year" : "month"
            }
          }
        }],
        proration_behavior: "create_prorations"
      });
    }

    // Update subscription in database
    return await this.updateSubscription(subscriptionId, {
      planId: newPlanId
    });
  }

  // ============================================================================
  // PAYMENT METHODS
  // ============================================================================

  async addPaymentMethod(
    subscriptionId: string,
    paymentMethodData: InsertPaymentMethod
  ): Promise<PaymentMethod> {
    // If this is the default payment method, unset others
    if (paymentMethodData.isDefault) {
      await db
        .update(paymentMethods)
        .set({ isDefault: false })
        .where(eq(paymentMethods.subscriptionId, subscriptionId));
    }

    const [paymentMethod] = await db
      .insert(paymentMethods)
      .values(paymentMethodData)
      .returning();
    
    return paymentMethod;
  }

  async getPaymentMethods(subscriptionId: string): Promise<PaymentMethod[]> {
    return await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.subscriptionId, subscriptionId))
      .orderBy(desc(paymentMethods.isDefault));
  }

  // ============================================================================
  // BILLING HISTORY
  // ============================================================================

  async createInvoice(invoiceData: InsertBillingHistory): Promise<BillingHistory> {
    const invoiceNumber = await this.generateInvoiceNumber();
    
    const [invoice] = await db
      .insert(billingHistory)
      .values({
        ...invoiceData,
        invoiceNumber
      })
      .returning();
    
    return invoice;
  }

  async getInvoices(subscriptionId: string): Promise<BillingHistory[]> {
    return await db
      .select()
      .from(billingHistory)
      .where(eq(billingHistory.subscriptionId, subscriptionId))
      .orderBy(desc(billingHistory.createdAt));
  }

  async generateInvoiceNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Get count of invoices this month
    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(billingHistory)
      .where(
        and(
          gte(billingHistory.createdAt, new Date(year, date.getMonth(), 1)),
          lte(billingHistory.createdAt, new Date(year, date.getMonth() + 1, 0))
        )
      )
      .then(rows => rows[0]?.count || 0);
    
    return `INV-${year}${month}-${String(count + 1).padStart(4, '0')}`;
  }

  // ============================================================================
  // FEATURE FLAGS & GATING
  // ============================================================================

  async getFeatureFlags(): Promise<FeatureFlag[]> {
    return await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.isEnabled, true));
  }

  async checkFeatureAccess(
    workspaceId: string,
    featureName: string
  ): Promise<{ hasAccess: boolean; requiresUpgrade: boolean; message?: string }> {
    // Get workspace subscription
    const subscription = await this.getSubscription(workspaceId);
    if (!subscription) {
      return {
        hasAccess: false,
        requiresUpgrade: true,
        message: "No active subscription found"
      };
    }

    // Get plan details
    const plan = await this.getPlanById(subscription.planId);
    if (!plan) {
      return {
        hasAccess: false,
        requiresUpgrade: false,
        message: "Invalid subscription plan"
      };
    }

    // Get feature flag
    const [feature] = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.name, featureName))
      .limit(1);
    
    if (!feature || !feature.isEnabled) {
      return {
        hasAccess: false,
        requiresUpgrade: false,
        message: "Feature not available"
      };
    }

    // Check if plan has access to feature
    const hasAccess = feature.availableInPlans.includes(plan.tier);
    
    return {
      hasAccess,
      requiresUpgrade: !hasAccess && feature.requiresUpgrade,
      message: hasAccess ? undefined : feature.upgradeMessage || `Upgrade to access ${feature.displayName}`
    };
  }

  // ============================================================================
  // USAGE TRACKING
  // ============================================================================

  async trackUsage(data: InsertUsageTracking): Promise<void> {
    // Insert usage record
    await db.insert(usageTracking).values(data);

    // Check if we need to create alerts
    if (data.subscriptionId) {
      await this.checkUsageAlerts(data.workspaceId, data.subscriptionId, data.metric);
    }
  }

  async getUsageMetrics(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Record<string, any>> {
    const conditions = [eq(usageTracking.workspaceId, workspaceId)];
    
    if (startDate) {
      conditions.push(gte(usageTracking.timestamp, startDate));
    }
    if (endDate) {
      conditions.push(lte(usageTracking.timestamp, endDate));
    }

    const usage = await db
      .select({
        metric: usageTracking.metric,
        total: sql<number>`sum(${usageTracking.value})`,
        count: sql<number>`count(*)`,
        lastUpdated: sql<Date>`max(${usageTracking.timestamp})`
      })
      .from(usageTracking)
      .where(and(...conditions))
      .groupBy(usageTracking.metric);

    const metrics: Record<string, any> = {};
    for (const row of usage) {
      metrics[row.metric] = {
        total: row.total,
        count: row.count,
        lastUpdated: row.lastUpdated
      };
    }

    return metrics;
  }

  async checkUsageAlerts(
    workspaceId: string,
    subscriptionId: string,
    metric: "messages" | "storage" | "api_calls" | "active_users" | "integrations" | "file_uploads"
  ): Promise<void> {
    // Get subscription and plan
    const subscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1)
      .then(rows => rows[0]);
    
    if (!subscription) return;

    const plan = await this.getPlanById(subscription.planId);
    if (!plan || !plan.limits) return;

    const limits = plan.limits as Record<string, number>;
    const limit = limits[metric];
    if (!limit || limit === -1) return; // No limit or unlimited

    // Get current usage for this period
    const currentPeriodUsage = await db
      .select({
        total: sql<number>`sum(${usageTracking.value})`
      })
      .from(usageTracking)
      .where(and(
        eq(usageTracking.workspaceId, workspaceId),
        eq(usageTracking.metric, metric),
        gte(usageTracking.timestamp, subscription.currentPeriodStart),
        lte(usageTracking.timestamp, subscription.currentPeriodEnd)
      ))
      .then(rows => rows[0]?.total || 0);

    const usagePercentage = (currentPeriodUsage / limit) * 100;

    // Check thresholds (80%, 90%, 100%)
    const thresholds = [80, 90, 100];
    for (const threshold of thresholds) {
      if (usagePercentage >= threshold) {
        // Check if we already sent an alert for this threshold
        const existingAlert = await db
          .select()
          .from(usageAlerts)
          .where(and(
            eq(usageAlerts.workspaceId, workspaceId),
            eq(usageAlerts.metric, metric),
            eq(usageAlerts.threshold, threshold),
            gte(usageAlerts.alertedAt, subscription.currentPeriodStart)
          ))
          .limit(1)
          .then(rows => rows[0]);

        if (!existingAlert) {
          // Create new alert
          await db.insert(usageAlerts).values({
            workspaceId,
            subscriptionId,
            metric,
            threshold,
            currentUsage: currentPeriodUsage,
            limit,
            notificationChannels: ["in-app", "email"]
          });

          // TODO: Send notification via email/in-app
          console.log(`Usage alert: ${workspaceId} has used ${usagePercentage.toFixed(1)}% of ${metric} limit`);
        }
      }
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private calculatePeriodEnd(startDate: Date, billingCycle: string): Date {
    const endDate = new Date(startDate);
    
    switch (billingCycle) {
      case "monthly":
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case "yearly":
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      case "quarterly":
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      default:
        endDate.setMonth(endDate.getMonth() + 1);
    }
    
    return endDate;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initializeDefaultPlans(): Promise<void> {
    // Check if plans already exist
    const existingPlans = await this.getPlans();
    if (existingPlans.length > 0) {
      return;
    }

    // Create default plans
    const defaultPlans = [
      {
        name: "Free",
        tier: "free" as const,
        price: 0,
        pricePerUser: 0,
        billingCycle: "monthly" as const,
        description: "Perfect for trying out our platform",
        trialDays: 0,
        features: {
          basic_messaging: true,
          file_sharing: true,
          basic_search: true,
          mobile_app: true,
          integrations: false,
          advanced_search: false,
          analytics: false,
          sso: false,
          compliance_exports: false,
          priority_support: false
        },
        limits: {
          messages: 10000,
          storage_gb: 5,
          api_calls: 1000,
          active_users: 10,
          integrations: 0,
          file_uploads: 100
        }
      },
      {
        name: "Pro",
        tier: "pro" as const,
        price: 8,
        pricePerUser: 8,
        billingCycle: "monthly" as const,
        description: "For growing teams that need more power",
        trialDays: 14,
        features: {
          basic_messaging: true,
          file_sharing: true,
          basic_search: true,
          mobile_app: true,
          integrations: true,
          advanced_search: true,
          analytics: true,
          sso: false,
          compliance_exports: false,
          priority_support: false
        },
        limits: {
          messages: 100000,
          storage_gb: 20,
          api_calls: 10000,
          active_users: 100,
          integrations: 10,
          file_uploads: 1000
        }
      },
      {
        name: "Business",
        tier: "business" as const,
        price: 15,
        pricePerUser: 15,
        billingCycle: "monthly" as const,
        description: "Advanced features for larger organizations",
        trialDays: 14,
        features: {
          basic_messaging: true,
          file_sharing: true,
          basic_search: true,
          mobile_app: true,
          integrations: true,
          advanced_search: true,
          analytics: true,
          sso: true,
          compliance_exports: true,
          priority_support: true
        },
        limits: {
          messages: -1, // Unlimited
          storage_gb: 100,
          api_calls: 50000,
          active_users: 500,
          integrations: 50,
          file_uploads: 10000
        }
      },
      {
        name: "Enterprise Grid",
        tier: "enterprise" as const,
        price: 0, // Custom pricing
        pricePerUser: 0,
        billingCycle: "custom" as const,
        description: "Unlimited scale and customization",
        trialDays: 30,
        isCustom: true,
        features: {
          basic_messaging: true,
          file_sharing: true,
          basic_search: true,
          mobile_app: true,
          integrations: true,
          advanced_search: true,
          analytics: true,
          sso: true,
          compliance_exports: true,
          priority_support: true,
          custom_integrations: true,
          dedicated_support: true,
          sla: true,
          custom_retention: true
        },
        limits: {
          messages: -1, // Unlimited
          storage_gb: -1, // Unlimited
          api_calls: -1, // Unlimited
          active_users: -1, // Unlimited
          integrations: -1, // Unlimited
          file_uploads: -1 // Unlimited
        }
      }
    ];

    for (const plan of defaultPlans) {
      await db.insert(subscriptionPlans).values(plan);
    }

    // Create default feature flags
    const defaultFeatures = [
      {
        name: "advanced_search",
        displayName: "Advanced Search",
        description: "Search across all messages, files, and channels with filters",
        availableInPlans: ["pro", "business", "enterprise"] as any,
        requiresUpgrade: true,
        upgradeMessage: "Upgrade to Pro or higher to unlock advanced search capabilities"
      },
      {
        name: "unlimited_integrations",
        displayName: "Unlimited Integrations",
        description: "Connect unlimited third-party services",
        availableInPlans: ["business", "enterprise"] as any,
        requiresUpgrade: true,
        upgradeMessage: "Upgrade to Business or higher for unlimited integrations"
      },
      {
        name: "analytics_dashboard",
        displayName: "Analytics Dashboard",
        description: "Detailed insights and usage analytics",
        availableInPlans: ["pro", "business", "enterprise"] as any,
        requiresUpgrade: true,
        upgradeMessage: "Upgrade to Pro or higher to access analytics"
      },
      {
        name: "sso",
        displayName: "Single Sign-On (SSO)",
        description: "Enterprise authentication with SAML/OAuth",
        availableInPlans: ["business", "enterprise"] as any,
        requiresUpgrade: true,
        upgradeMessage: "Upgrade to Business or higher for SSO support"
      },
      {
        name: "compliance_exports",
        displayName: "Compliance Exports",
        description: "Export data for compliance and auditing",
        availableInPlans: ["business", "enterprise"] as any,
        requiresUpgrade: true,
        upgradeMessage: "Upgrade to Business or higher for compliance features"
      },
      {
        name: "priority_support",
        displayName: "Priority Support",
        description: "24/7 priority customer support",
        availableInPlans: ["business", "enterprise"] as any,
        requiresUpgrade: true,
        upgradeMessage: "Upgrade to Business or higher for priority support"
      }
    ];

    for (const feature of defaultFeatures) {
      await db.insert(featureFlags).values(feature);
    }

    console.log("✅ Default subscription plans and features initialized");
  }
}

export const subscriptionService = SubscriptionService.getInstance();