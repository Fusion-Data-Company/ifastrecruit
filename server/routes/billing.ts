import { Router } from "express";
import { z } from "zod";
import { subscriptionService } from "../services/subscription.service";
import { usageTrackingService } from "../services/usage-tracking.service";
import Stripe from "stripe";
import { isAuthenticated } from "../replitAuth";

const router = Router();

// Initialize Stripe (will be null if not configured)
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-11-20.acacia" })
  : null;

// Validation schemas
const subscribeSchema = z.object({
  planId: z.string(),
  paymentMethodId: z.string().optional()
});

const upgradeSchema = z.object({
  newPlanId: z.string()
});

const paymentMethodSchema = z.object({
  stripePaymentMethodId: z.string().optional(),
  type: z.enum(["card", "ach", "invoice", "wire_transfer", "paypal"]),
  isDefault: z.boolean().optional(),
  last4: z.string().length(4).optional(),
  brand: z.string().optional(),
  expiryMonth: z.number().min(1).max(12).optional(),
  expiryYear: z.number().optional(),
  bankName: z.string().optional(),
  accountLast4: z.string().length(4).optional(),
  billingAddress: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string()
  }).optional()
});

const trackUsageSchema = z.object({
  metric: z.enum(["messages", "storage", "api_calls", "active_users", "integrations", "file_uploads"]),
  value: z.number().positive(),
  context: z.record(z.any()).optional()
});

// ============================================================================
// PLANS ENDPOINTS
// ============================================================================

// Get all available subscription plans
router.get("/plans", async (req, res) => {
  try {
    const plans = await subscriptionService.getPlans();
    res.json(plans);
  } catch (error: any) {
    console.error("Error fetching plans:", error);
    res.status(500).json({ message: "Failed to fetch subscription plans" });
  }
});

// Get current subscription for authenticated user's workspace
router.get("/subscription", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    // For this example, we'll use userId as workspaceId
    // In production, you'd get the actual workspace ID from the user's context
    const workspaceId = userId;
    
    const subscription = await subscriptionService.getSubscription(workspaceId);
    
    if (!subscription) {
      return res.json({ 
        subscription: null,
        message: "No active subscription" 
      });
    }

    // Get plan details
    const plan = await subscriptionService.getPlanById(subscription.planId);
    
    res.json({
      subscription,
      plan
    });
  } catch (error: any) {
    console.error("Error fetching subscription:", error);
    res.status(500).json({ message: "Failed to fetch subscription" });
  }
});

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

// Subscribe to a plan
router.post("/subscribe", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const workspaceId = userId; // Using userId as workspaceId for simplicity
    
    const { planId, paymentMethodId } = subscribeSchema.parse(req.body);
    
    // Check if already subscribed
    const existingSubscription = await subscriptionService.getSubscription(workspaceId);
    if (existingSubscription) {
      return res.status(400).json({ 
        message: "Already have an active subscription. Use upgrade endpoint instead." 
      });
    }

    // Create subscription with Stripe if configured
    if (stripe) {
      const result = await subscriptionService.createStripeSubscription(
        workspaceId,
        userId,
        planId,
        paymentMethodId
      );

      res.json({
        subscription: result.subscription,
        clientSecret: result.clientSecret,
        message: "Subscription created successfully"
      });
    } else {
      // Create subscription without Stripe (for development)
      const subscription = await subscriptionService.createSubscription({
        workspaceId,
        userId,
        planId,
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });

      res.json({
        subscription,
        message: "Subscription created (Stripe not configured)"
      });
    }
  } catch (error: any) {
    console.error("Error creating subscription:", error);
    res.status(500).json({ message: error.message || "Failed to create subscription" });
  }
});

// Upgrade or downgrade subscription
router.put("/upgrade", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const workspaceId = userId;
    
    const { newPlanId } = upgradeSchema.parse(req.body);
    
    // Get current subscription
    const subscription = await subscriptionService.getSubscription(workspaceId);
    if (!subscription) {
      return res.status(400).json({ message: "No active subscription to upgrade" });
    }

    // Perform upgrade/downgrade
    const updatedSubscription = await subscriptionService.upgradeDowngradePlan(
      subscription.id,
      newPlanId
    );

    res.json({
      subscription: updatedSubscription,
      message: "Subscription updated successfully"
    });
  } catch (error: any) {
    console.error("Error upgrading subscription:", error);
    res.status(500).json({ message: error.message || "Failed to upgrade subscription" });
  }
});

// Cancel subscription
router.post("/cancel", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const workspaceId = userId;
    const { reason } = req.body;
    
    const subscription = await subscriptionService.getSubscription(workspaceId);
    if (!subscription) {
      return res.status(400).json({ message: "No active subscription to cancel" });
    }

    const canceledSubscription = await subscriptionService.cancelSubscription(
      subscription.id,
      reason
    );

    res.json({
      subscription: canceledSubscription,
      message: "Subscription canceled successfully"
    });
  } catch (error: any) {
    console.error("Error canceling subscription:", error);
    res.status(500).json({ message: "Failed to cancel subscription" });
  }
});

// ============================================================================
// PAYMENT METHODS
// ============================================================================

// Add payment method
router.post("/payment-method", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const workspaceId = userId;
    
    const paymentMethodData = paymentMethodSchema.parse(req.body);
    
    // Get subscription
    const subscription = await subscriptionService.getSubscription(workspaceId);
    if (!subscription) {
      return res.status(400).json({ message: "No active subscription" });
    }

    const paymentMethod = await subscriptionService.addPaymentMethod(
      subscription.id,
      paymentMethodData
    );

    res.json({
      paymentMethod,
      message: "Payment method added successfully"
    });
  } catch (error: any) {
    console.error("Error adding payment method:", error);
    res.status(500).json({ message: "Failed to add payment method" });
  }
});

// Get payment methods
router.get("/payment-methods", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const workspaceId = userId;
    
    const subscription = await subscriptionService.getSubscription(workspaceId);
    if (!subscription) {
      return res.json({ paymentMethods: [] });
    }

    const paymentMethods = await subscriptionService.getPaymentMethods(subscription.id);
    res.json({ paymentMethods });
  } catch (error: any) {
    console.error("Error fetching payment methods:", error);
    res.status(500).json({ message: "Failed to fetch payment methods" });
  }
});

// ============================================================================
// BILLING HISTORY
// ============================================================================

// Get billing history/invoices
router.get("/invoices", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const workspaceId = userId;
    
    const subscription = await subscriptionService.getSubscription(workspaceId);
    if (!subscription) {
      return res.json({ invoices: [] });
    }

    const invoices = await subscriptionService.getInvoices(subscription.id);
    res.json({ invoices });
  } catch (error: any) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ message: "Failed to fetch invoices" });
  }
});

// ============================================================================
// USAGE TRACKING
// ============================================================================

// Get current usage statistics
router.get("/usage", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const workspaceId = userId;
    
    const usageStats = await usageTrackingService.getUsageStats(workspaceId);
    res.json(usageStats);
  } catch (error: any) {
    console.error("Error fetching usage stats:", error);
    res.status(500).json({ message: "Failed to fetch usage statistics" });
  }
});

// Track usage (internal endpoint, usually called by other services)
router.post("/usage/track", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const workspaceId = userId;
    
    const { metric, value, context } = trackUsageSchema.parse(req.body);
    
    await usageTrackingService.track(
      metric,
      workspaceId,
      value,
      userId,
      context
    );

    res.json({ message: "Usage tracked successfully" });
  } catch (error: any) {
    console.error("Error tracking usage:", error);
    res.status(500).json({ message: "Failed to track usage" });
  }
});

// Get historical usage
router.get("/usage/history", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const workspaceId = userId;
    
    const { metric, days = "30" } = req.query;
    
    if (!metric || typeof metric !== "string") {
      return res.status(400).json({ message: "Metric parameter is required" });
    }

    const history = await usageTrackingService.getHistoricalUsage(
      workspaceId,
      metric as any,
      parseInt(days as string)
    );

    res.json({ history });
  } catch (error: any) {
    console.error("Error fetching usage history:", error);
    res.status(500).json({ message: "Failed to fetch usage history" });
  }
});

// Get usage alerts
router.get("/usage/alerts", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const workspaceId = userId;
    
    const alerts = await usageTrackingService.getActiveAlerts(workspaceId);
    res.json({ alerts });
  } catch (error: any) {
    console.error("Error fetching usage alerts:", error);
    res.status(500).json({ message: "Failed to fetch usage alerts" });
  }
});

// Acknowledge usage alert
router.post("/usage/alerts/:alertId/acknowledge", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { alertId } = req.params;
    
    await usageTrackingService.acknowledgeAlert(alertId, userId);
    res.json({ message: "Alert acknowledged" });
  } catch (error: any) {
    console.error("Error acknowledging alert:", error);
    res.status(500).json({ message: "Failed to acknowledge alert" });
  }
});

// Generate usage report
router.get("/usage/report", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const workspaceId = userId;
    
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start date and end date are required" });
    }

    const report = await usageTrackingService.generateUsageReport(
      workspaceId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json(report);
  } catch (error: any) {
    console.error("Error generating usage report:", error);
    res.status(500).json({ message: "Failed to generate usage report" });
  }
});

// ============================================================================
// FEATURE FLAGS
// ============================================================================

// Check feature access
router.get("/features/:featureName", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const workspaceId = userId;
    const { featureName } = req.params;
    
    const access = await subscriptionService.checkFeatureAccess(workspaceId, featureName);
    res.json(access);
  } catch (error: any) {
    console.error("Error checking feature access:", error);
    res.status(500).json({ message: "Failed to check feature access" });
  }
});

// Get all available features for current plan
router.get("/features", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const workspaceId = userId;
    
    const subscription = await subscriptionService.getSubscription(workspaceId);
    if (!subscription) {
      return res.json({ 
        features: [],
        planTier: "free" 
      });
    }

    const plan = await subscriptionService.getPlanById(subscription.planId);
    const allFeatures = await subscriptionService.getFeatureFlags();
    
    const availableFeatures = allFeatures.filter(f => 
      f.availableInPlans.includes(plan?.tier || "free")
    );

    res.json({
      features: availableFeatures,
      planTier: plan?.tier || "free",
      planFeatures: plan?.features || {}
    });
  } catch (error: any) {
    console.error("Error fetching features:", error);
    res.status(500).json({ message: "Failed to fetch features" });
  }
});

// ============================================================================
// STRIPE WEBHOOKS
// ============================================================================

// Stripe webhook endpoint for handling subscription events
router.post("/webhook/stripe", async (req, res) => {
  if (!stripe) {
    return res.status(501).json({ message: "Stripe not configured" });
  }

  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Stripe webhook secret not configured");
    return res.status(501).json({ message: "Webhook secret not configured" });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ message: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("Payment succeeded:", paymentIntent.id);
        // Update subscription status, create invoice, etc.
        break;

      case "payment_intent.payment_failed":
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        console.log("Payment failed:", failedPayment.id);
        // Handle failed payment
        break;

      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`Subscription ${event.type}:`, subscription.id);
        // Update subscription in database
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ message: "Webhook processing failed" });
  }
});

// Initialize default plans on server start
router.post("/initialize-plans", async (req, res) => {
  try {
    await subscriptionService.initializeDefaultPlans();
    res.json({ message: "Default plans initialized successfully" });
  } catch (error: any) {
    console.error("Error initializing plans:", error);
    res.status(500).json({ message: "Failed to initialize plans" });
  }
});

export default router;