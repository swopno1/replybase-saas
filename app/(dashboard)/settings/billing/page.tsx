"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Download,
  RotateCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface Subscription {
  id: string;
  stripeId: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  plan: {
    id: string;
    name: string;
    displayName: string;
    price: number;
    currency: string;
    dailyMessageLimit: number;
    monthlyMessageLimit: number;
    maxBots: number;
    features: Record<string, unknown>;
  };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  paidAt: string | null;
  dueDate: string;
  downloadUrl?: string;
}

export default function BillingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCanceling, setIsCanceling] = useState(false);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/billing/subscription");
      if (!response.ok) throw new Error("Failed to fetch billing data");
      const data = await response.json();
      setSubscription(data.subscription);
      setInvoices(data.invoices || []);
    } catch (error) {
      console.error("Error fetching billing data:", error);
      toast.error("Failed to load billing information");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = () => {
    router.push("/pricing");
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    setIsCanceling(true);
    try {
      const response = await fetch(
        `/api/billing/subscription/${subscription.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) throw new Error("Failed to cancel subscription");
      toast.success("Subscription canceled successfully");
      fetchBillingData();
    } catch (error) {
      console.error("Error canceling subscription:", error);
      toast.error("Failed to cancel subscription");
    } finally {
      setIsCanceling(false);
    }
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    if (invoice.downloadUrl) {
      window.open(invoice.downloadUrl, "_blank");
    }
  };

  if (!session?.user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Not authenticated</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-40 bg-muted rounded-lg animate-pulse" />
        <div className="h-60 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Billing & Subscription
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription, invoices, and payment methods
        </p>
      </div>

      {/* Current Subscription Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>
                Your active subscription details
              </CardDescription>
            </div>
            {subscription && (
              <Badge
                variant={
                  subscription.status === "active" ? "default" : "secondary"
                }
              >
                {subscription.status.charAt(0).toUpperCase() +
                  subscription.status.slice(1)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {subscription ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Plan Details */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {subscription.plan.displayName}
                    </h3>
                    <p className="text-2xl font-bold mt-2">
                      ${subscription.plan.price}
                      <span className="text-sm font-normal text-muted-foreground">
                        /month
                      </span>
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">
                        Daily Messages:
                      </span>
                      <span className="float-right font-medium">
                        {subscription.plan.dailyMessageLimit === 999999999
                          ? "Unlimited"
                          : subscription.plan.dailyMessageLimit.toLocaleString()}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        Monthly Messages:
                      </span>
                      <span className="float-right font-medium">
                        {subscription.plan.monthlyMessageLimit === 999999999
                          ? "Unlimited"
                          : subscription.plan.monthlyMessageLimit.toLocaleString()}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Bots:</span>
                      <span className="float-right font-medium">
                        {subscription.plan.maxBots === 999999999
                          ? "Unlimited"
                          : subscription.plan.maxBots}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Billing Period */}
                <div className="space-y-4 bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold">Billing Period</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Period Start</p>
                      <p className="font-medium">
                        {new Date(
                          subscription.currentPeriodStart,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Period End</p>
                      <p className="font-medium">
                        {new Date(
                          subscription.currentPeriodEnd,
                        ).toLocaleDateString()}
                      </p>
                    </div>

                    {subscription.trialEndsAt && (
                      <div className="pt-3 border-t">
                        <p className="text-muted-foreground">Trial Ends</p>
                        <p className="font-medium">
                          {new Date(
                            subscription.trialEndsAt,
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={handleUpgrade}
                  className="gap-2"
                >
                  <RotateCw className="h-4 w-4" />
                  Change Plan
                </Button>

                {subscription.status === "active" && (
                  <Button
                    variant="outline"
                    onClick={handleCancelSubscription}
                    disabled={isCanceling}
                    className="gap-2 text-red-600 hover:text-red-700"
                  >
                    Cancel Subscription
                  </Button>
                )}
              </div>

              {subscription.cancelAtPeriodEnd && (
                <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm text-yellow-900">
                      Subscription canceled
                    </p>
                    <p className="text-xs text-yellow-800 mt-1">
                      Your subscription will end on{" "}
                      {new Date(
                        subscription.currentPeriodEnd,
                      ).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 space-y-4">
              <p className="text-muted-foreground">No active subscription</p>
              <Button onClick={handleUpgrade}>Choose a Plan</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice History Card */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>
            Download your invoices and payment history
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      Invoice {invoice.invoiceNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-medium">
                        ${(invoice.amount / 100).toFixed(2)}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        {invoice.status === "paid" ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            <span className="text-xs text-green-600">Paid</span>
                          </>
                        ) : (
                          <Badge variant="outline">{invoice.status}</Badge>
                        )}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownloadInvoice(invoice)}
                      disabled={!invoice.downloadUrl}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">No invoices yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Method Card */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
          <CardDescription>Update your payment information</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Payment method management is coming soon. Your payments are securely
            processed through Stripe.
          </p>
          <Button disabled>Update Payment Method</Button>
        </CardContent>
      </Card>

      {/* Billing FAQ Card */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="font-medium text-sm">How do I upgrade my plan?</p>
            <p className="text-xs text-muted-foreground mt-1">
              Go to the pricing page to upgrade to a higher tier. Changes take
              effect immediately.
            </p>
          </div>
          <Separator />
          <div>
            <p className="font-medium text-sm">
              How do I cancel my subscription?
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click &quot;Cancel Subscription&quot; on this page. Your access
              continues until the end of your billing period.
            </p>
          </div>
          <Separator />
          <div>
            <p className="font-medium text-sm">
              Can I change my plan mid-month?
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Yes! Upgrade anytime and we&apos;ll prorate your charges.
              Downgrade requests are processed at the end of your billing
              period.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
