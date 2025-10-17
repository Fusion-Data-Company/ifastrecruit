import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CreditCard,
  Download,
  FileText,
  AlertCircle,
  Plus,
  Trash2,
  Check,
  X,
  Building,
  Shield
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate: string | null;
  paidAt: string | null;
  pdfUrl: string | null;
  paymentStatus: string;
  createdAt: string;
}

interface PaymentMethod {
  id: string;
  type: string;
  last4: string | null;
  brand: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  bankName: string | null;
  accountLast4: string | null;
  isDefault: boolean;
  createdAt: string;
}

interface Subscription {
  id: string;
  planId: string;
  status: string;
  startDate: string;
  endDate: string | null;
  trialEndDate: string | null;
  canceledAt: string | null;
  cancelationReason: string | null;
  quantity: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

interface Plan {
  id: string;
  name: string;
  tier: string;
  price: number;
  pricePerUser: number | null;
  billingCycle: string;
  description: string;
}

export function BillingManagement() {
  const { toast } = useToast();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false);

  // Fetch current subscription
  const { data: subscriptionData } = useQuery({
    queryKey: ["/api/billing/subscription"]
  });

  const subscription = subscriptionData?.subscription as Subscription | null;
  const plan = subscriptionData?.plan as Plan | null;

  // Fetch invoices
  const { data: invoicesData } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ["/api/billing/invoices"],
    enabled: !!subscription
  });

  // Fetch payment methods
  const { data: paymentMethodsData, isLoading: paymentMethodsLoading } = useQuery<{ paymentMethods: PaymentMethod[] }>({
    queryKey: ["/api/billing/payment-methods"],
    enabled: !!subscription
  });

  // Cancel subscription mutation
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/billing/cancel", { reason: cancelReason });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Subscription Canceled",
        description: "Your subscription has been canceled and will end at the current period.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      setShowCancelDialog(false);
      setCancelReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive"
      });
    }
  });

  // Add payment method mutation
  const addPaymentMethodMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/billing/payment-method", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Payment Method Added",
        description: "Your payment method has been added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/payment-methods"] });
      setShowAddPaymentDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add Payment Method",
        description: error.message || "Could not add payment method",
        variant: "destructive"
      });
    }
  });

  // Download invoice
  const downloadInvoice = (invoice: Invoice) => {
    if (invoice.pdfUrl) {
      window.open(invoice.pdfUrl, "_blank");
    } else {
      toast({
        title: "Invoice Not Available",
        description: "The invoice PDF is not available yet.",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      trialing: "secondary",
      canceled: "destructive",
      past_due: "destructive",
      expired: "outline"
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      succeeded: "default",
      pending: "secondary",
      failed: "destructive",
      refunded: "outline"
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="invoices">Invoices</TabsTrigger>
        <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-4">
        {subscription && plan ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Current Subscription</CardTitle>
                  <CardDescription>
                    Manage your subscription plan and billing details
                  </CardDescription>
                </div>
                {getStatusBadge(subscription.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Plan</p>
                  <p className="text-2xl font-bold">{plan.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Price</p>
                  <p className="text-2xl font-bold">
                    ${plan.price}
                    {plan.pricePerUser && `/user`}
                    {plan.billingCycle === "monthly" ? "/mo" : plan.billingCycle === "yearly" ? "/yr" : ""}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Billing Period</p>
                  <p className="text-sm">
                    {format(new Date(subscription.currentPeriodStart), "MMM d, yyyy")} - {format(new Date(subscription.currentPeriodEnd), "MMM d, yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Seats</p>
                  <p className="text-sm">{subscription.quantity} active users</p>
                </div>
              </div>

              {subscription.trialEndDate && new Date(subscription.trialEndDate) > new Date() && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Trial Period</AlertTitle>
                  <AlertDescription>
                    Your trial ends on {format(new Date(subscription.trialEndDate), "MMM d, yyyy")}
                  </AlertDescription>
                </Alert>
              )}

              {subscription.canceledAt && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Subscription Canceled</AlertTitle>
                  <AlertDescription>
                    Your subscription will end on {format(new Date(subscription.currentPeriodEnd), "MMM d, yyyy")}
                    {subscription.cancelationReason && (
                      <p className="mt-2 text-sm">Reason: {subscription.cancelationReason}</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" data-testid="button-change-plan">
                Change Plan
              </Button>
              {!subscription.canceledAt && (
                <Button 
                  variant="destructive" 
                  onClick={() => setShowCancelDialog(true)}
                  data-testid="button-cancel-subscription"
                >
                  Cancel Subscription
                </Button>
              )}
            </CardFooter>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No Active Subscription</CardTitle>
              <CardDescription>
                Choose a plan to get started with premium features
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button data-testid="button-view-plans">View Plans</Button>
            </CardFooter>
          </Card>
        )}
      </TabsContent>

      {/* Invoices Tab */}
      <TabsContent value="invoices" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Invoice History</CardTitle>
            <CardDescription>
              Download your past invoices and payment receipts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invoicesData?.invoices && invoicesData.invoices.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesData.invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        ${invoice.total.toFixed(2)} {invoice.currency}
                      </TableCell>
                      <TableCell>
                        {getPaymentStatusBadge(invoice.paymentStatus)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadInvoice(invoice)}
                          data-testid={`button-download-${invoice.id}`}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No invoices available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Payment Methods Tab */}
      <TabsContent value="payment-methods" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>
                  Manage your payment methods and billing information
                </CardDescription>
              </div>
              <Button 
                onClick={() => setShowAddPaymentDialog(true)}
                data-testid="button-add-payment"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Payment Method
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {paymentMethodsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : paymentMethodsData?.paymentMethods && paymentMethodsData.paymentMethods.length > 0 ? (
              <div className="space-y-2">
                {paymentMethodsData.paymentMethods.map((method) => (
                  <div 
                    key={method.id} 
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <CreditCard className="w-8 h-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {method.type === "card" && method.brand ? (
                            <>
                              {method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} •••• {method.last4}
                            </>
                          ) : method.type === "ach" ? (
                            <>
                              {method.bankName} •••• {method.accountLast4}
                            </>
                          ) : (
                            method.type.charAt(0).toUpperCase() + method.type.slice(1)
                          )}
                        </p>
                        {method.expiryMonth && method.expiryYear && (
                          <p className="text-sm text-muted-foreground">
                            Expires {method.expiryMonth}/{method.expiryYear}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {method.isDefault && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        data-testid={`button-remove-${method.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No payment methods added</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setShowAddPaymentDialog(true)}
                >
                  Add Your First Payment Method
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Settings Tab */}
      <TabsContent value="settings" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Billing Settings</CardTitle>
            <CardDescription>
              Configure your billing preferences and notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Billing Email</Label>
              <Input 
                type="email" 
                placeholder="billing@company.com" 
                data-testid="input-billing-email"
              />
              <p className="text-sm text-muted-foreground">
                All billing-related emails will be sent to this address
              </p>
            </div>

            <div className="space-y-2">
              <Label>Invoice Recipients</Label>
              <Textarea 
                placeholder="finance@company.com, accounting@company.com"
                data-testid="textarea-invoice-recipients"
              />
              <p className="text-sm text-muted-foreground">
                Additional email addresses to receive invoice copies (comma-separated)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Company Information</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Company Name" data-testid="input-company-name" />
                <Input placeholder="Tax ID" data-testid="input-tax-id" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Billing Address</Label>
              <div className="space-y-2">
                <Input placeholder="Address Line 1" data-testid="input-address-1" />
                <Input placeholder="Address Line 2" data-testid="input-address-2" />
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="City" data-testid="input-city" />
                  <Input placeholder="State/Province" data-testid="input-state" />
                  <Input placeholder="ZIP/Postal Code" data-testid="input-zip" />
                </div>
                <Input placeholder="Country" data-testid="input-country" />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button data-testid="button-save-settings">Save Settings</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>
              Choose when to receive billing notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" defaultChecked />
                <span>Payment receipt emails</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" defaultChecked />
                <span>Invoice ready notifications</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" defaultChecked />
                <span>Usage limit alerts (80% and 100%)</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span>Weekly usage reports</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" defaultChecked />
                <span>Payment failure notifications</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" defaultChecked />
                <span>Subscription renewal reminders</span>
              </label>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Cancel Subscription Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your subscription? You'll lose access to premium features at the end of your current billing period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cancellation Reason (Optional)</Label>
              <Textarea
                placeholder="Please let us know why you're canceling..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                data-testid="textarea-cancel-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCancelDialog(false)}
            >
              Keep Subscription
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => cancelSubscriptionMutation.mutate()}
              disabled={cancelSubscriptionMutation.isPending}
              data-testid="button-confirm-cancel"
            >
              {cancelSubscriptionMutation.isPending ? "Canceling..." : "Cancel Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Payment Method Dialog */}
      <Dialog open={showAddPaymentDialog} onOpenChange={setShowAddPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>
              Add a new payment method for your subscription billing
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Payment method setup would be handled through Stripe's secure payment form.
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowAddPaymentDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                // In production, this would integrate with Stripe Elements
                toast({
                  title: "Stripe Integration Required",
                  description: "Payment method setup requires Stripe API keys to be configured",
                  variant: "destructive"
                });
              }}
              data-testid="button-add-payment-confirm"
            >
              Add Payment Method
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}