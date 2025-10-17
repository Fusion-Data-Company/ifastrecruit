import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Zap, Shield, Building2, Sparkles } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

// Initialize Stripe
const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

interface Plan {
  id: string;
  name: string;
  tier: "free" | "pro" | "business" | "enterprise";
  price: number;
  pricePerUser: number | null;
  billingCycle: string;
  description: string;
  features: Record<string, boolean>;
  limits: Record<string, number>;
  isActive: boolean;
  isCustom: boolean;
  trialDays: number;
}

interface Subscription {
  id: string;
  planId: string;
  status: string;
  startDate: string;
  endDate: string | null;
  trialEndDate: string | null;
}

const planIcons = {
  free: <Zap className="w-6 h-6 text-gray-500" />,
  pro: <Sparkles className="w-6 h-6 text-blue-500" />,
  business: <Shield className="w-6 h-6 text-purple-500" />,
  enterprise: <Building2 className="w-6 h-6 text-amber-500" />
};

const planColors = {
  free: "border-gray-200",
  pro: "border-blue-500",
  business: "border-purple-500", 
  enterprise: "border-amber-500"
};

const featureDisplayNames: Record<string, string> = {
  basic_messaging: "Basic Messaging",
  file_sharing: "File Sharing",
  basic_search: "Basic Search",
  mobile_app: "Mobile App",
  integrations: "Third-party Integrations",
  advanced_search: "Advanced Search & Filters",
  analytics: "Analytics Dashboard",
  sso: "Single Sign-On (SSO)",
  compliance_exports: "Compliance Exports",
  priority_support: "Priority Support",
  custom_integrations: "Custom Integrations",
  dedicated_support: "Dedicated Support",
  sla: "Service Level Agreement",
  custom_retention: "Custom Data Retention"
};

const limitDisplayNames: Record<string, { name: string; unit: string }> = {
  messages: { name: "Messages", unit: "/month" },
  storage_gb: { name: "Storage", unit: "GB" },
  api_calls: { name: "API Calls", unit: "/month" },
  active_users: { name: "Active Users", unit: "" },
  integrations: { name: "Integrations", unit: "" },
  file_uploads: { name: "File Uploads", unit: "/month" }
};

// Payment form component
function CheckoutForm({ planId, onSuccess }: { planId: string; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/billing/success`,
      },
      redirect: "if_required"
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Subscription Successful",
        description: "Your subscription has been activated!",
      });
      onSuccess();
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button 
        type="submit" 
        disabled={!stripe || isProcessing} 
        className="w-full"
        data-testid="button-confirm-payment"
      >
        {isProcessing ? "Processing..." : "Confirm Payment"}
      </Button>
    </form>
  );
}

export function PricingPlans() {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Fetch plans
  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["/api/billing/plans"]
  });

  // Fetch current subscription
  const { data: subscriptionData } = useQuery({
    queryKey: ["/api/billing/subscription"]
  });

  const currentSubscription = subscriptionData?.subscription as Subscription | null;
  const currentPlan = subscriptionData?.plan as Plan | null;

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await apiRequest("POST", "/api/billing/subscribe", { planId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.clientSecret && stripePromise) {
        setClientSecret(data.clientSecret);
        setShowPaymentDialog(true);
      } else {
        toast({
          title: "Subscription Created",
          description: data.message || "Your subscription has been activated!",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Subscription Failed",
        description: error.message || "Failed to create subscription",
        variant: "destructive"
      });
    }
  });

  // Upgrade mutation
  const upgradeMutation = useMutation({
    mutationFn: async (newPlanId: string) => {
      const response = await apiRequest("PUT", "/api/billing/upgrade", { newPlanId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Plan Updated",
        description: "Your subscription has been updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      setShowPaymentDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Upgrade Failed",
        description: error.message || "Failed to update subscription",
        variant: "destructive"
      });
    }
  });

  const handleSelectPlan = (plan: Plan) => {
    if (plan.tier === "enterprise") {
      // Contact sales for enterprise
      window.location.href = "mailto:sales@example.com?subject=Enterprise Plan Inquiry";
      return;
    }

    setSelectedPlan(plan);
    
    if (currentSubscription) {
      upgradeMutation.mutate(plan.id);
    } else {
      subscribeMutation.mutate(plan.id);
    }
  };

  const formatLimit = (value: number, unit: string) => {
    if (value === -1) return "Unlimited";
    if (value === 0) return "Not available";
    return `${value.toLocaleString()}${unit}`;
  };

  const formatPrice = (price: number, pricePerUser: number | null, billingCycle: string) => {
    if (price === 0 && !pricePerUser) return "Free";
    if (price === 0 && pricePerUser === 0) return "Custom pricing";
    
    const perUserText = pricePerUser ? `/user` : "";
    const cycleText = billingCycle === "monthly" ? "/month" : billingCycle === "yearly" ? "/year" : "";
    
    return `$${price}${perUserText}${cycleText}`;
  };

  if (plansLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan?.id === plan.id;
          const isDowngrade = currentPlan && 
            ["free", "pro", "business", "enterprise"].indexOf(plan.tier) < 
            ["free", "pro", "business", "enterprise"].indexOf(currentPlan.tier);

          return (
            <Card 
              key={plan.id} 
              className={`relative ${planColors[plan.tier]} ${isCurrentPlan ? 'ring-2 ring-offset-2' : ''}`}
              data-testid={`card-plan-${plan.tier}`}
            >
              {isCurrentPlan && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  Current Plan
                </Badge>
              )}
              
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  {planIcons[plan.tier]}
                  {plan.tier === "pro" && (
                    <Badge variant="secondary">Most Popular</Badge>
                  )}
                </div>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <div className="text-3xl font-bold">
                    {formatPrice(plan.price, plan.pricePerUser, plan.billingCycle)}
                  </div>
                  {plan.trialDays > 0 && !currentSubscription && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {plan.trialDays}-day free trial
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Features */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">Features</p>
                  <ul className="space-y-1">
                    {Object.entries(featureDisplayNames).map(([key, displayName]) => {
                      const hasFeature = plan.features[key];
                      if (!hasFeature && !["free", "pro"].includes(plan.tier)) return null;
                      
                      return (
                        <li key={key} className="flex items-center gap-2 text-sm">
                          {hasFeature ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <X className="w-4 h-4 text-gray-300" />
                          )}
                          <span className={hasFeature ? "" : "text-gray-400"}>
                            {displayName}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Limits */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">Limits</p>
                  <ul className="space-y-1">
                    {Object.entries(limitDisplayNames).map(([key, { name, unit }]) => {
                      const limit = plan.limits[key];
                      if (limit === 0) return null;
                      
                      return (
                        <li key={key} className="flex items-center justify-between text-sm">
                          <span>{name}</span>
                          <span className="font-medium">
                            {formatLimit(limit, unit)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </CardContent>

              <CardFooter>
                <Button 
                  className="w-full"
                  variant={isCurrentPlan ? "secondary" : isDowngrade ? "outline" : "default"}
                  disabled={isCurrentPlan || subscribeMutation.isPending || upgradeMutation.isPending}
                  onClick={() => handleSelectPlan(plan)}
                  data-testid={`button-select-${plan.tier}`}
                >
                  {isCurrentPlan 
                    ? "Current Plan" 
                    : isDowngrade 
                    ? "Downgrade" 
                    : currentSubscription 
                    ? "Upgrade" 
                    : plan.tier === "enterprise"
                    ? "Contact Sales"
                    : "Get Started"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Payment Dialog */}
      {showPaymentDialog && clientSecret && stripePromise && (
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Complete Your Subscription</DialogTitle>
              <DialogDescription>
                Enter your payment details to activate your {selectedPlan?.name} plan.
              </DialogDescription>
            </DialogHeader>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm 
                planId={selectedPlan?.id || ""} 
                onSuccess={() => {
                  setShowPaymentDialog(false);
                  queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
                }}
              />
            </Elements>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}