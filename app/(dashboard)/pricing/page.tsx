"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Check,
  X,
  Loader2,
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  TrendingUp,
  Globe,
  MessageSquare,
  Lock,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PLANS as STRIPE_PLANS } from "@/lib/stripe";

interface PricingPlan {
  readonly name: "free" | "launch" | "grow" | "scale" | "business";
  readonly displayName: string;
  readonly aiLabel?: string;
  readonly priceMonthly: number;
  readonly priceAnnual: number;
  readonly automations: string;
  readonly aiResponses: string;
  readonly aiOverage: string;
  readonly bots: string;
  readonly supportedChannels: string;
  readonly crmAccess: boolean;
  readonly apiAccess: boolean;
  readonly support: string;
  readonly cta: string;
  readonly highlight: boolean;
  readonly featuredLabel?: string;
}

const PLANS: readonly PricingPlan[] = [
  {
    name: "free",
    displayName: "Free",
    aiLabel: "Basic AI Assist",
    priceMonthly: 0,
    priceAnnual: 0,
    automations: "200",
    aiResponses: "100",
    aiOverage: "Upgrade",
    bots: "1",
    supportedChannels: "Webchat",
    crmAccess: false,
    apiAccess: false,
    support: "Community",
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "launch",
    displayName: "Launch",
    aiLabel: "Basic Lead Flow",
    priceMonthly: 2900,
    priceAnnual: 29000,
    automations: "1,500",
    aiResponses: "1,000",
    aiOverage: "£12 / 1k",
    bots: "2",
    supportedChannels: "Webchat, Facebook or WhatsApp",
    crmAccess: true,
    apiAccess: false,
    support: "Standard Email",
    cta: "Start Free Trial",
    highlight: false,
  },
  {
    name: "grow",
    displayName: "Grow",
    aiLabel: "Smart Automation",
    priceMonthly: 4900,
    priceAnnual: 49000,
    automations: "5,000",
    aiResponses: "3,500",
    aiOverage: "£10 / 1k",
    bots: "5",
    supportedChannels: "Webchat, Facebook + WhatsApp",
    crmAccess: true,
    apiAccess: false,
    support: "Priority Email",
    cta: "Start Free Trial",
    highlight: true,
    featuredLabel: "Most Popular",
  },
  {
    name: "scale",
    displayName: "Scale",
    aiLabel: "AI Co-Pilot",
    priceMonthly: 8900,
    priceAnnual: 89000,
    automations: "10,000",
    aiResponses: "7,500",
    aiOverage: "£8 / 1k",
    bots: "10",
    supportedChannels: "Webchat, Facebook, WhatsApp, Telegram",
    crmAccess: true,
    apiAccess: true,
    support: "Priority Live-Chat",
    cta: "Start Free Trial",
    highlight: false,
    featuredLabel: "Best for Teams",
  },
  {
    name: "business",
    displayName: "Business",
    priceMonthly: 24900,
    priceAnnual: 249000,
    automations: "40,000",
    aiResponses: "25,000",
    aiOverage: "£6 / 1k",
    bots: "25",
    supportedChannels: "All channels + API/Custom Integrations",
    crmAccess: true,
    apiAccess: true,
    support: "Dedicated SLA",
    cta: "Start Free Trial",
    highlight: false,
  },
];

type PlanName = (typeof PLANS)[number]["name"];

function PricingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<(typeof PLANS)[number] | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);

  const triggerAutoCheckout = async (plan: (typeof PLANS)[number], cycle: "monthly" | "annual", promo: string | null) => {
    setLoading(plan.name);
    try {
      const priceId = cycle === "annual"
        ? (STRIPE_PLANS as any)[plan.name].annualPriceId
        : (STRIPE_PLANS as any)[plan.name].monthlyPriceId;

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          planName: plan.name,
          billingCycle: cycle,
          promoCode: promo || (cycle === "annual" ? "FOUNDING50" : undefined),
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to start checkout");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
      setLoading(null);
    }
  };

  useEffect(() => {
    fetch("/api/billing/subscription")
      .then((res) => {
        if (res.status === 401) {
          // Not logged in! If they came with a plan query, redirect them to register.
          const planParam = searchParams.get("plan");
          if (planParam) {
            const promoParam = searchParams.get("promo");
            const cycleParam = searchParams.get("cycle");
            const sourceParam = searchParams.get("source");

            const registerUrl = new URL("/auth/register", window.location.origin);
            registerUrl.searchParams.set("plan", planParam);
            if (promoParam) registerUrl.searchParams.set("promo", promoParam);
            if (cycleParam) registerUrl.searchParams.set("cycle", cycleParam);
            if (sourceParam) registerUrl.searchParams.set("source", sourceParam);
            
            router.push(registerUrl.pathname + registerUrl.search);
            return null;
          }
          setIsAuthenticated(false);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          if (data.error === "Unauthorized") {
            setIsAuthenticated(false);
          } else {
            setCurrentSubscription(data);
            setIsAuthenticated(true);
          }
        }
      })
      .catch((err) => console.error("Failed to fetch subscription:", err));

    const cycle = searchParams.get("cycle");
    if (cycle === "annual") setBillingCycle("annual");

    const promo = searchParams.get("promo");
    if (promo) setPromoCode(promo);

    const planParam = searchParams.get("plan");
    const checkoutParam = searchParams.get("checkout");
    if (planParam) {
      let normalized = planParam.trim().toLowerCase();
      if (normalized === "pro") normalized = "scale";
      if (normalized === "starter") normalized = "launch";

      const matchedPlan = PLANS.find((p) => p.name === normalized);
      if (matchedPlan) {
        setSelectedPlan(matchedPlan);
        if (checkoutParam === "true") {
          triggerAutoCheckout(matchedPlan, cycle === "annual" ? "annual" : "monthly", promo);
        }
      }
    }
  }, [searchParams]);

  const handleSubscribeClick = (planName: string) => {
    const plan = PLANS.find((p) => p.name === planName);
    if (!plan) return;
    if (plan.priceMonthly === 0) {
        router.push("/dashboard");
        return;
    }
    if (!isAuthenticated) {
      const registerUrl = new URL("/auth/register", window.location.origin);
      registerUrl.searchParams.set("plan", plan.name);
      if (promoCode) registerUrl.searchParams.set("promo", promoCode);
      router.push(registerUrl.pathname + registerUrl.search);
      return;
    }
    setSelectedPlan(plan);
  };

  const handleConfirmCheckout = async () => {
    if (!selectedPlan) return;
    setLoading(selectedPlan.name);

    try {
      const priceId = billingCycle === "annual"
        ? (STRIPE_PLANS as any)[selectedPlan.name].annualPriceId
        : (STRIPE_PLANS as any)[selectedPlan.name].monthlyPriceId;

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          planName: selectedPlan.name,
          billingCycle,
          promoCode: promoCode || (billingCycle === "annual" ? "FOUNDING50" : undefined),
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to start checkout");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
      setLoading(null);
    }
  };

  return (
    <div className="container py-12 px-4 max-w-7xl mx-auto">
      <div className="text-center mb-12 space-y-4">
        <Badge variant="outline" className="px-4 py-1 border-primary/20 text-primary font-bold animate-pulse">
          🚀 Founding Offer: 50% OFF Annual Plans with code FOUNDING50
        </Badge>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
          Scale Your Conversations
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Choose the perfect plan for your business. Start with a 14-day free trial on any premium plan.
        </p>

        <div className="flex items-center justify-center gap-4 mt-8">
          <Label htmlFor="billing-toggle" className={`text-sm font-bold ${billingCycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}>
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={billingCycle === "annual"}
            onCheckedChange={(checked) => setBillingCycle(checked ? "annual" : "monthly")}
          />
          <Label htmlFor="billing-toggle" className={`text-sm font-bold flex items-center gap-2 ${billingCycle === 'annual' ? 'text-foreground' : 'text-muted-foreground'}`}>
            Annual
            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 font-bold">
              2 Months Free
            </Badge>
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-20">
        {PLANS.map((plan) => {
          const isCurrent = currentSubscription?.plan?.name === plan.name;
          const price = billingCycle === "annual" ? plan.priceAnnual : plan.priceMonthly;
          const displayPrice = price / 100;
          const effectiveMonthly = billingCycle === "annual" ? Math.floor(displayPrice / 12) : displayPrice;

          return (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-3xl border p-6 transition-all duration-300 hover:shadow-2xl ${
                plan.highlight
                ? "border-primary bg-primary/[0.02] shadow-xl scale-105 z-10"
                : "border-border bg-card hover:border-primary/50"
              }`}
            >
              {plan.featuredLabel && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground font-bold px-4 py-1 shadow-lg">
                    {plan.featuredLabel}
                  </Badge>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold mb-1">{plan.displayName}</h3>
                <p className="text-xs text-muted-foreground font-medium mb-4">{plan.aiLabel}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black">£{billingCycle === "annual" ? effectiveMonthly : displayPrice}</span>
                  <span className="text-muted-foreground text-sm">/mo</span>
                </div>
                {billingCycle === "annual" && price > 0 && (
                  <p className="text-[10px] text-green-600 font-bold mt-1">
                    Billed £{displayPrice} annually (Save £{(plan.priceMonthly * 12 - plan.priceAnnual) / 100})
                  </p>
                )}
              </div>

              <div className="space-y-4 mb-8 flex-1">
                <div className="flex items-center gap-3">
                  <div className={`p-1 rounded-full ${plan.highlight ? 'bg-primary/20' : 'bg-muted'}`}>
                    <Check className={`h-3 w-3 ${plan.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <p className="text-sm font-medium">{plan.aiResponses} AI Responses</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`p-1 rounded-full ${plan.highlight ? 'bg-primary/20' : 'bg-muted'}`}>
                    <Check className={`h-3 w-3 ${plan.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <p className="text-sm font-medium">{plan.automations} Automations</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`p-1 rounded-full ${plan.highlight ? 'bg-primary/20' : 'bg-muted'}`}>
                    <Check className={`h-3 w-3 ${plan.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <p className="text-sm font-medium">{plan.bots} Active {parseInt(plan.bots) === 1 ? 'Bot' : 'Bots'}</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className={`p-1 rounded-full mt-0.5 ${plan.highlight ? 'bg-primary/20' : 'bg-muted'}`}>
                    <Globe className={`h-3 w-3 ${plan.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">
                    <span className="font-bold text-foreground">Channels:</span><br/>
                    {plan.supportedChannels}
                  </p>
                </div>
              </div>

              <Button
                className={`w-full rounded-2xl font-bold py-6 ${
                  plan.highlight
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                  : "variant-outline"
                }`}
                variant={plan.highlight ? "default" : "outline"}
                onClick={() => handleSubscribeClick(plan.name)}
                disabled={loading !== null || isCurrent}
              >
                {loading === plan.name ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isCurrent ? (
                  "Current Plan"
                ) : (
                  plan.cta
                )}
              </Button>
              {price > 0 && !isCurrent && (
                <p className="text-center text-[10px] text-muted-foreground mt-3 font-medium">
                  14-day free trial included
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison Table */}
      <div className="hidden lg:block overflow-hidden rounded-3xl border border-border bg-card shadow-xl mb-20">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="p-6 text-xl font-bold">Features</th>
              {PLANS.map((plan) => (
                <th key={plan.name} className={`p-6 text-center ${plan.highlight ? "bg-primary/5" : ""}`}>
                  <div className="font-bold text-foreground">{plan.displayName}</div>
                  <div className="text-xs text-muted-foreground font-normal">£{billingCycle === 'annual' ? (plan.priceAnnual/1200).toFixed(0) : (plan.priceMonthly/100)}/mo</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <td className="p-6 font-semibold text-foreground">Monthly AI Responses</td>
              {PLANS.map((plan) => (
                <td key={`${plan.name}-ai-responses`} className={`p-6 text-center text-muted-foreground ${plan.highlight ? "bg-primary/5" : ""}`}>
                  {plan.aiResponses}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-6 font-semibold text-foreground">Flow Automations</td>
              {PLANS.map((plan) => (
                <td key={`${plan.name}-automations`} className={`p-6 text-center text-muted-foreground ${plan.highlight ? "bg-primary/5" : ""}`}>
                  {plan.automations}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-6 font-semibold text-foreground">Active Bots</td>
              {PLANS.map((plan) => (
                <td key={`${plan.name}-bots`} className={`p-6 text-center text-muted-foreground ${plan.highlight ? "bg-primary/5" : ""}`}>
                  {plan.bots}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-6 font-semibold text-foreground">CRM & Lead Insights</td>
              {PLANS.map((plan) => (
                <td key={`${plan.name}-crm`} className={`p-6 text-center ${plan.highlight ? "bg-primary/5" : ""}`}>
                  {plan.crmAccess ? <Check className="mx-auto h-5 w-5 text-green-500" /> : <X className="mx-auto h-5 w-5 text-muted-foreground opacity-30" />}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-6 font-semibold text-foreground">API Access</td>
              {PLANS.map((plan) => (
                <td key={`${plan.name}-api`} className={`p-6 text-center ${plan.highlight ? "bg-primary/5" : ""}`}>
                  {plan.apiAccess ? <Check className="mx-auto h-5 w-5 text-green-500" /> : <X className="mx-auto h-5 w-5 text-muted-foreground opacity-30" />}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-6 font-semibold text-foreground">Support Level</td>
              {PLANS.map((plan) => (
                <td key={`${plan.name}-support`} className={`p-6 text-center text-xs text-muted-foreground ${plan.highlight ? "bg-primary/5" : ""}`}>
                  {plan.support}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={!!selectedPlan} onOpenChange={(open) => !open && setSelectedPlan(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Plan Summary
            </DialogTitle>
            <DialogDescription>
              Review your selection before starting your 14-day free trial.
            </DialogDescription>
          </DialogHeader>
          {selectedPlan && (
            <div className="space-y-6 py-4">
              <div className="bg-muted/50 rounded-2xl p-6 border border-border/50">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-muted-foreground">Selected Plan</span>
                  <Badge variant="outline" className="font-bold border-primary/20 text-primary">{selectedPlan.displayName}</Badge>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-muted-foreground">Billing Cycle</span>
                  <Badge variant="secondary" className="capitalize">{billingCycle}</Badge>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-muted-foreground">Free Trial</span>
                  <span className="font-semibold text-green-600">14 Days</span>
                </div>
                {billingCycle === "annual" && (
                   <div className="flex justify-between items-center mb-4">
                    <span className="text-sm text-muted-foreground">Offer Applied</span>
                    <span className="font-bold text-primary">50% OFF (FOUNDING50)</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-4 border-t border-border">
                  <span className="text-sm font-semibold">Total to pay today</span>
                  <span className="text-lg font-bold text-foreground">£0.00</span>
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground text-right">
                  Then £{billingCycle === 'annual' ? (selectedPlan.priceAnnual/200).toFixed(2) : (selectedPlan.priceMonthly/100).toFixed(2)} / {billingCycle === 'annual' ? 'year' : 'month'} after trial
                  {billingCycle === 'annual' && " (incl. 50% discount)"}
                </div>
              </div>

              <div className="space-y-3 px-1 text-sm">
                <div className="flex gap-3">
                  <div className="mt-1 bg-green-100 rounded-full p-0.5"><Check className="h-3 w-3 text-green-600" /></div>
                  <p>You won&apos;t be charged until your trial ends.</p>
                </div>
                <div className="flex gap-3">
                  <div className="mt-1 bg-green-100 rounded-full p-0.5"><Check className="h-3 w-3 text-green-600" /></div>
                  <p>Full access to all {selectedPlan.displayName} features immediately.</p>
                </div>
                <div className="flex gap-3">
                  <div className="mt-1 bg-green-100 rounded-full p-0.5"><Check className="h-3 w-3 text-green-600" /></div>
                  <p>Cancel anytime before trial ends to avoid charges.</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleConfirmCheckout} className="w-full py-6 rounded-2xl font-bold shadow-xl shadow-primary/20 gap-2">
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse font-medium">Loading premium plans...</p>
        </div>
      }
    >
      <PricingContent />
    </Suspense>
  );
}
