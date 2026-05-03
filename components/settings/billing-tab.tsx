"use client";

import { useState, useEffect, useCallback } from "react";
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
  Zap,
  Shield,
  MessageSquare,
  HelpCircle,
  Info,
  ChevronRight,
  Loader2,
  X,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Subscription {
  id: string;
  stripeId: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  trialDaysRemaining?: number;
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

interface UsageData {
  monthlyMessages: number;
  monthlyMessageLimit: number;
  dailyFlowExecutions: number;
  flowExecutionCap: number;
  usage: {
    bots: number;
    messages: number;
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

interface PaymentMethod {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export default function BillingTabContent() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCanceling, setIsCanceling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState("");
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  const fetchBillingData = useCallback(async () => {
    try {
      const response = await fetch("/api/billing");
      if (!response.ok) throw new Error("Failed to fetch billing data");
      const data = await response.json();
      setSubscription(data.subscription);
      setUsage(data.usage);
      setInvoices(data.invoices || []);
      setPaymentMethod(data.paymentMethod);
    } catch (error) {
      console.error("Error fetching billing data:", error);
      toast.error("Failed to load billing information");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchBillingData();
    };
    init();
  }, [fetchBillingData]);

  const handleUpgrade = () => {
    router.push("/pricing");
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;
    setIsCanceling(true);
    try {
      const response = await fetch("/api/billing/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: cancelFeedback })
      });
      if (!response.ok) throw new Error("Failed to cancel subscription");
      toast.success("Subscription set to cancel at period end");
      setShowCancelDialog(false);
      fetchBillingData();
    } catch (error) {
      console.error("Error canceling subscription:", error);
      toast.error("Failed to cancel subscription");
    } finally {
      setIsCanceling(false);
    }
  };

  const handleUpdatePaymentMethod = async () => {
    setIsPortalLoading(true);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      if (!response.ok) throw new Error("Failed to open billing portal");
      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      console.error("Portal error:", error);
      toast.error("Failed to open billing portal");
    } finally {
      setIsPortalLoading(false);
    }
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    if (invoice.downloadUrl) {
      window.open(invoice.downloadUrl, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-64 bg-muted/50 rounded-2xl animate-pulse" />
        <div className="h-48 bg-muted/50 rounded-2xl animate-pulse" />
        <div className="h-64 bg-muted/50 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const isTrial = subscription?.status === "TRIALING";
  const isCanceled = subscription?.cancelAtPeriodEnd;
  const isPastDue = subscription?.status === "PAST_DUE";
  const trialDays = subscription?.trialDaysRemaining ?? 0;

  const getUsageColor = (current: number, limit: number) => {
    if (limit === 0) return "bg-red-500";
    const ratio = current / limit;
    if (ratio >= 1.0) return "bg-red-500";
    if (ratio >= 0.9) return "bg-yellow-500";
    return "bg-primary";
  };

  return (
    <div className="max-w-5xl space-y-8 pb-12">
      {/* Trial Banner */}
      {isTrial && !isCanceled && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-primary/20 p-3 rounded-xl">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg">You&apos;re currently on a 14-day free trial</h3>
              <p className="text-muted-foreground text-sm">
                You have <span className="font-bold text-primary">{trialDays} days</span> left in your trial. 
                Upgrade now to ensure uninterrupted service.
              </p>
            </div>
          </div>
          <Button onClick={handleUpgrade} className="shadow-lg shadow-primary/20 whitespace-nowrap">
            Choose Paid Plan
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Past Due Banner */}
      {isPastDue && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-red-500/20 p-3 rounded-xl">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-red-900">Payment Required</h3>
              <p className="text-red-800 text-sm">
                Your last payment failed. Please update your payment method to avoid service interruption.
              </p>
            </div>
          </div>
          <Button onClick={handleUpdatePaymentMethod} variant="destructive" disabled={isPortalLoading}>
            Update Card
            <CreditCard className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Usage Warning Banner */}
      {usage && 
       !(usage.monthlyMessages / (usage.monthlyMessageLimit || 1) >= 1.1 || usage.dailyFlowExecutions / (usage.flowExecutionCap || 1) >= 1.1) &&
       (usage.monthlyMessages / (usage.monthlyMessageLimit || 1) >= 0.9 || usage.dailyFlowExecutions / (usage.flowExecutionCap || 1) >= 0.9) && (
        <div className="bg-orange-500 text-white rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg ring-4 ring-orange-500/10">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Approaching Limits</h3>
              <p className="text-orange-50 text-sm">
                You&apos;ve used over 90% of your plan&apos;s resources. Upgrade now to ensure your bots keep responding.
              </p>
            </div>
          </div>
          <Button onClick={handleUpgrade} variant="secondary" className="font-bold h-11">
            Upgrade Now
          </Button>
        </div>
      )}

      {/* Limit Reached Banner */}
      {usage && (usage.monthlyMessages / (usage.monthlyMessageLimit || 1) >= 1.1 || usage.dailyFlowExecutions / (usage.flowExecutionCap || 1) >= 1.1) && (
        <div className="bg-red-600 text-white rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl ring-4 ring-red-600/20 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Usage Limit Exceeded</h3>
              <p className="text-red-50 text-sm">
                Your service is currently restricted due to excessive usage. 
                Upgrade your plan now to restore full functionality instantly.
              </p>
            </div>
          </div>
          <Button onClick={handleUpgrade} variant="secondary" className="font-black px-8 h-12 shadow-lg">
            Restore Service
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Canceled Banner */}
      {isCanceled && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6 flex items-center gap-4 shadow-sm">
          <div className="bg-yellow-500/20 p-3 rounded-xl">
            <AlertCircle className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-yellow-900">Subscription Canceled</h3>
            <p className="text-yellow-800 text-sm">
              Your access will continue until <span className="font-bold">{new Date(subscription?.currentPeriodEnd || "").toLocaleDateString()}</span>.
              After this date, you will be moved to the Free plan.
            </p>
          </div>
        </div>
      )}

      {/* Current Plan Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 shadow-sm border-border/50 rounded-2xl overflow-hidden ring-1 ring-border/5">
          <CardHeader className="bg-muted/30 pb-8">
            <div className="flex items-center justify-between mb-4">
              <Badge variant="outline" className="font-bold border-primary/20 text-primary bg-primary/5 uppercase tracking-wider text-[10px]">Current Plan</Badge>
              {subscription && (
                <Badge 
                  className={subscription.status === "ACTIVE" || subscription.status === "TRIALING" ? "bg-green-500/10 text-green-600 border-green-200" : "bg-muted text-muted-foreground"}
                >
                  {subscription.status.toLowerCase()}
                </Badge>
              )}
            </div>
            <CardTitle className="text-3xl font-black">{subscription?.plan.displayName || "Free"}</CardTitle>
            <CardDescription className="text-base font-medium">
              {subscription?.plan.price === 0 ? "Forever free" : `£${subscription?.plan.price}/month`}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>{subscription?.plan.maxBots} Active Bots</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Priority Support</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Unlimited Lead Capture</span>
              </div>
            </div>
            
            <Separator className="bg-border/50" />
            
            <div className="space-y-4">
              <Button onClick={handleUpgrade} className="w-full bg-foreground text-background hover:bg-foreground/90 font-bold h-11 rounded-xl shadow-md">
                {subscription?.plan.name === "business" || subscription?.plan.name === "pro" ? "Manage Plan" : "Upgrade Plan"}
              </Button>

              {subscription && subscription.plan.name !== "free" && subscription.plan.name !== "starter" && !isCanceled && (
                 <Button
                   variant="outline"
                   onClick={() => setShowDowngradeDialog(true)}
                   className="w-full border-border hover:bg-muted transition-colors h-11 rounded-xl"
                 >
                   Downgrade Plan
                 </Button>
              )}

              {subscription?.status !== "FREE" && !isCanceled && (
                <Button 
                  variant="ghost" 
                  onClick={() => setShowCancelDialog(true)}
                  className="w-full text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors h-11 rounded-xl"
                >
                  Cancel Subscription
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage Stats */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm border-border/50 rounded-2xl ring-1 ring-border/5">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Plan Usage</CardTitle>
                  <CardDescription>Usage for the current billing cycle</CardDescription>
                </div>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {new Date(subscription?.currentPeriodStart || "").toLocaleDateString()} — {new Date(subscription?.currentPeriodEnd || "").toLocaleDateString()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Messages Usage */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span className="font-bold text-sm">Monthly AI Responses</span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    <span className="text-foreground font-bold">{usage?.monthlyMessages.toLocaleString()}</span> / {usage?.monthlyMessageLimit === 999999999 ? "∞" : usage?.monthlyMessageLimit.toLocaleString()}
                  </span>
                </div>
                <Progress 
                  value={usage ? (usage.monthlyMessages / (usage.monthlyMessageLimit || 1)) * 100 : 0} 
                  className="h-2.5 bg-muted/50"
                  indicatorClassName={getUsageColor(usage?.monthlyMessages || 0, usage?.monthlyMessageLimit || 1)}
                />
                <p className="text-[11px] text-muted-foreground">Reset on {new Date(subscription?.currentPeriodEnd || "").toLocaleDateString()}</p>
              </div>

              {/* Automation Usage */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <div className="flex items-center gap-2">
                    <RotateCw className="h-4 w-4 text-primary" />
                    <span className="font-bold text-sm">Flow Executions (Daily)</span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    <span className="text-foreground font-bold">{usage?.dailyFlowExecutions.toLocaleString()}</span> / {usage?.flowExecutionCap === 999999999 ? "∞" : usage?.flowExecutionCap.toLocaleString()}
                  </span>
                </div>
                <Progress 
                  value={usage ? (usage.dailyFlowExecutions / (usage.flowExecutionCap || 1)) * 100 : 0} 
                  className="h-2.5 bg-muted/50"
                  indicatorClassName={getUsageColor(usage?.dailyFlowExecutions || 0, usage?.flowExecutionCap || 1)}
                />
                <p className="text-[11px] text-muted-foreground">Resets at midnight UTC</p>
              </div>

              <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 flex items-start gap-3">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Usage resets at the beginning of each billing cycle. If you reach your limit, your bots will continue to work but AI responses may be paused until the next cycle or an upgrade.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Billing Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="shadow-sm border-border/50 rounded-2xl p-5 ring-1 ring-border/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-muted p-2 rounded-lg">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </div>
                <h4 className="font-bold text-sm">Payment Method</h4>
              </div>
              {paymentMethod ? (
                  <div className="mb-4">
                      <div className="flex items-center gap-2">
                          <p className="text-sm font-bold capitalize">{paymentMethod.brand} •••• {paymentMethod.last4}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Expires {paymentMethod.expMonth}/{paymentMethod.expYear}</p>
                  </div>
              ) : (
                <p className="text-xs text-muted-foreground mb-4">No payment method on file.</p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs font-bold rounded-lg h-9"
                onClick={handleUpdatePaymentMethod}
                disabled={isPortalLoading}
              >
                  {isPortalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Method"}
              </Button>
            </Card>
            <Card className="shadow-sm border-border/50 rounded-2xl p-5 ring-1 ring-border/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-muted p-2 rounded-lg">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <h4 className="font-bold text-sm">Billing Cycle</h4>
              </div>
              <div className="mb-4">
                <p className="text-xs text-muted-foreground">
                    Next charge: <span className="font-bold text-foreground">{new Date(subscription?.currentPeriodEnd || "").toLocaleDateString()}</span>
                </p>
                <p className="text-[10px] text-muted-foreground">Currently on a monthly billing cycle.</p>
              </div>
              <Button variant="outline" size="sm" className="w-full text-xs font-bold rounded-lg h-9">Switch to Annual (-20%)</Button>
            </Card>
          </div>
        </div>
      </div>

      {/* Invoice History */}
      <Card className="shadow-sm border-border/50 rounded-2xl ring-1 ring-border/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Invoice History</CardTitle>
              <CardDescription>Download and manage your past invoices</CardDescription>
            </div>
            <Download className="h-5 w-5 text-muted-foreground/30" />
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <div className="divide-y border rounded-xl overflow-hidden">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-bold text-sm">
                      Invoice {invoice.invoiceNumber}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-black text-sm">
                        £{(invoice.amount / 100).toFixed(2)}
                      </p>
                      <div className="flex items-center justify-end gap-1.5 mt-1">
                        {invoice.status === "paid" ? (
                          <span className="text-[10px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-200">Paid</span>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">{invoice.status}</Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDownloadInvoice(invoice)}
                      disabled={!invoice.downloadUrl}
                      className="h-9 w-9 rounded-full"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed">
              <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-20" />
              <p className="text-muted-foreground text-sm font-medium">No billing history found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing FAQ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <h4 className="font-bold flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            Common Questions
          </h4>
          <div className="space-y-4 pt-2">
            <div className="group">
              <p className="text-sm font-bold group-hover:text-primary transition-colors">How do I change my billing cycle?</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                You can switch between monthly and annual billing in the Billing Cycle card above. 
                Annual plans come with a 20% discount.
              </p>
            </div>
            <div className="group">
              <p className="text-sm font-bold group-hover:text-primary transition-colors">What happens if I cancel?</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Your plan features will remain active until the end of your current period. 
                After that, you&apos;ll be moved to the Free tier and some features may be disabled.
              </p>
            </div>
          </div>
        </div>
        <div className="bg-muted/30 rounded-2xl p-6 border border-border/50 flex flex-col justify-center">
          <h4 className="font-bold text-base mb-2">Need a custom enterprise plan?</h4>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
            If your business requires higher limits, custom integrations, or dedicated support, 
            our enterprise team is here to help.
          </p>
          <Button variant="link" className="p-0 h-auto text-primary font-bold text-sm w-fit group">
            Talk to an expert
            <ChevronRight className="ml-1 h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      </div>

      {/* Downgrade Dialog */}
      <Dialog open={showDowngradeDialog} onOpenChange={setShowDowngradeDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-yellow-500" />
              Downgrade Plan?
            </DialogTitle>
            <DialogDescription className="text-base">
              You are about to downgrade your plan. Some features will be restricted at the end of your current billing cycle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
              <h5 className="font-bold text-yellow-900 text-sm mb-2">What will change:</h5>
              <ul className="space-y-2">
                <li className="text-xs text-yellow-800 flex items-center gap-2">
                  <AlertCircle className="h-3 w-3" />
                  Lower message & flow execution limits
                </li>
                <li className="text-xs text-yellow-800 flex items-center gap-2">
                  <AlertCircle className="h-3 w-3" />
                  Reduced number of active bots
                </li>
                <li className="text-xs text-yellow-800 flex items-center gap-2">
                  <AlertCircle className="h-3 w-3" />
                  Standard support instead of Priority
                </li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold">Why are you downgrading? (Optional)</label>
              <Textarea 
                placeholder="Tell us more so we can improve..."
                value={cancelFeedback}
                onChange={(e) => setCancelFeedback(e.target.value)}
                className="min-h-[80px] rounded-xl resize-none"
              />
            </div>

            <p className="text-xs text-muted-foreground">
                To complete your downgrade, please select a new plan on the pricing page. The changes will take effect at the start of your next billing period.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setShowDowngradeDialog(false)} className="flex-1 rounded-xl">
              Back
            </Button>
            <Button
              onClick={async () => {
                  if (cancelFeedback) {
                    await fetch("/api/billing/cancel", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ feedback: cancelFeedback, type: "DOWNGRADE" })
                    });
                  }
                  setShowDowngradeDialog(false);
                  router.push("/pricing");
              }}
              className="flex-1 rounded-xl font-bold"
            >
              Choose New Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancellation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Cancel Subscription?
            </DialogTitle>
            <DialogDescription className="text-base">
              {isTrial
                ? "Your trial will remain active until the end of the 14-day period. You will not be charged."
                : "We're sorry to see you go. Your subscription will remain active until the end of this billing cycle."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <h5 className="font-bold text-red-900 text-sm mb-2">What you&apos;ll lose:</h5>
              <ul className="space-y-2">
                <li className="text-xs text-red-800 flex items-center gap-2">
                  <X className="h-3 w-3" />
                  Telegram & WhatsApp channel access
                </li>
                <li className="text-xs text-red-800 flex items-center gap-2">
                  <X className="h-3 w-3" />
                  Advanced AI Co-pilot features
                </li>
                <li className="text-xs text-red-800 flex items-center gap-2">
                  <X className="h-3 w-3" />
                  Extended automation limits
                </li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold">How can we improve? (Optional)</label>
              <Textarea 
                placeholder="Tell us why you're canceling..."
                value={cancelFeedback}
                onChange={(e) => setCancelFeedback(e.target.value)}
                className="min-h-[100px] rounded-xl resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setShowCancelDialog(false)} className="flex-1 rounded-xl">
              Keep my plan
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancelSubscription} 
              disabled={isCanceling}
              className="flex-1 rounded-xl font-bold"
            >
              {isCanceling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
