import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PricingPlans } from "@/components/billing/PricingPlans";
import { UsageDashboard } from "@/components/billing/UsageDashboard";
import { BillingManagement } from "@/components/billing/BillingManagement";
import { 
  CreditCard, 
  BarChart3, 
  Package,
  Settings
} from "lucide-react";

export default function BillingPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription plan, usage, and billing details
        </p>
      </div>

      <Tabs defaultValue="plans" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="plans" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Plans</span>
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Usage</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Billing</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Choose Your Plan</h2>
            <p className="text-muted-foreground mb-6">
              Select the perfect plan for your team's needs. All plans include core features with different limits and capabilities.
            </p>
            <PricingPlans />
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Usage Overview</h2>
            <p className="text-muted-foreground mb-6">
              Monitor your resource usage and stay within your plan limits
            </p>
            <UsageDashboard />
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Billing Management</h2>
            <p className="text-muted-foreground mb-6">
              View invoices, manage payment methods, and update billing information
            </p>
            <BillingManagement />
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Billing Settings</h2>
            <p className="text-muted-foreground mb-6">
              Configure billing preferences and notification settings
            </p>
            {/* Settings content is already included in BillingManagement component */}
            <BillingManagement />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}