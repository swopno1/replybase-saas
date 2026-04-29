"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, X, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { setClarityTags, trackEvent } from "@/lib/client-analytics";

export const dynamic = "force-dynamic";

const PLANS = [
  {
    name: "free",
    displayName: "Free",
    aiLabel: "Basic AI Assist",
    price: 0,
    automations: "200",
    aiResponses: "100",
    aiOverage: "Upgrade",
    bots: "1",
    supportedChannels: "Webchat, Facebook, Website Forms",
    crmAccess: false,
    apiAccess: false,
    support: "Community",
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "starter",
    displayName: "Starter",
    aiLabel: "Smart Automation",
    price: 29,
    automations: "1,500",
    aiResponses: "1,000",
    aiOverage: "£12 / 1k",
    bots: "3",
    supportedChannels: "Telegram, Webchat, Facebook, WhatsApp, Website Forms",
    crmAccess: true,
    apiAccess: false,
    support: "Email",
    cta: "Start Free Trial",
    highlight: false,
  },
  {
    name: "pro",
    displayName: "Pro",
    aiLabel: "AI Co-Pilot",
    price: 89,
    automations: "10,000",
    aiResponses: "7,500",
    aiOverage: "£10 / 1k",
    bots: "10",
    supportedChannels: "Telegram, Webchat, Facebook, WhatsApp, Website Forms",
    crmAccess: true,
    apiAccess: true,
    support: "Priority",
    cta: "Start Free Trial",
    highlight: true,
  },
  {
    name: "business",
    displayName: "Business",
    aiLabel: "AI Agent",
    price: 249,
    automations: "40,000",
    aiResponses: "25,000",
    aiOverage: "£8 / 1k",
    bots: "25",
    supportedChannels: "Telegram, Webchat, Facebook, WhatsApp, Website Forms",
    crmAccess: true,
    apiAccess: true,
    support: "Priority +",
    cta: "Start Free Trial",
    highlight: false,
  },
] as const;

type PlanName = (typeof PLANS)[number]["name"];

function parsePlanName(value: string | null): PlanName | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "free" ||
    normalized === "starter" ||
    normalized === "pro" ||
    normalized === "business"
  ) {
    return normalized;
  }

  return null;
}

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<(typeof PLANS)[number] | null>(null);
  const preferredPlan = parsePlanName(searchParams.get("plan")) || "pro";
  const source = searchParams.get("source");

  useEffect(() => {
    setClarityTags({
      page_type: "pricing",
      funnel_step: "landing",
    });

    trackEvent("pricing_viewed", {
      onceKey: "pricing_viewed",
      onceScope: "session",
      properties: { origin: "app" },
    });

    const fetchCurrentSub = async () => {
      try {
        const res = await fetch("/api/billing/subscription");
        if (res.ok) {
          const data = await res.json();
          setCurrentSubscription(data.subscription);
        }
      } catch (err) {
        console.error("Failed to fetch subscription", err);
      }
    };
    fetchCurrentSub();
  }, []);

  const handleSubscribeClick = (planName: string) => {
    const plan = PLANS.find((p) => p.name === planName);
    if (!plan) return;

    if (planName === "free") {
      if (currentSubscription?.plan?.name === "free") {
        toast.info("You are already on the Free plan");
        router.push("/");
      } else {
        router.push("/");
      }
      return;
    }

    setSelectedPlan(plan);
  };

  const handleConfirmCheckout = async () => {
    if (!selectedPlan) return;
    const planName = selectedPlan.name;

    trackEvent("get_started_click", {
      properties: {
        plan: planName,
        source: "pricing_table",
        origin: "app",
      },
    });

    trackEvent("subscription_started", {
      properties: {
        plan: planName,
      },
    });

    setLoading(planName);
    setSelectedPlan(null);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planName,
          priceId: getPriceId(planName),
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Please login to subscribe");
          router.push("/auth/login?callbackUrl=/pricing");
          return;
        }
        throw new Error("Failed to start checkout");
      }

      const data = await response.json();
      if (data.url) {
        const isSafe =
          data.url.startsWith("/") ||
          data.url.startsWith("https://checkout.stripe.com/") ||
          data.url.startsWith("https://billing.stripe.com/");

        if (isSafe) {
          window.location.href = data.url;
        } else {
          console.error("Blocked insecure redirect attempt to:", data.url);
          toast.error("Insecure redirect blocked.");
        }
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="py-20 px-4 max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <Badge variant="outline" className="mb-4 px-4 py-1 text-primary border-primary/20 bg-primary/5">
          <Sparkles className="mr-2 h-3.5 w-3.5" />
          14-Day Free Trial on all paid plans
        </Badge>
        <h1 className="text-4xl font-bold mb-4 tracking-tight sm:text-5xl">Simple, Transparent Pricing</h1>
        <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
          Start free, upgrade as you grow. Paid plans unlock Telegram and
          WhatsApp alongside Webchat, Facebook, and website lead capture.
        </p>
        <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border bg-muted/50 px-5 py-2.5 text-sm">
          <span className="font-semibold text-foreground">Zero risk:</span>
          <span className="text-muted-foreground">
            No charges during trial • Cancel anytime • 24/7 Support
          </span>
        </div>
        {source ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Recommended based on your onboarding path.
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-3xl border bg-card p-2 shadow-xl ring-1 ring-border/50">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-6 w-1/5">Feature</th>
              {PLANS.map((plan) => {
                const isRecommended = plan.name === preferredPlan;
                const isCurrent = currentSubscription?.plan?.name === plan.name;
                return (
                  <th
                    key={plan.name}
                    className={`p-6 text-center rounded-t-2xl ${plan.highlight || isRecommended ? "bg-primary/5" : ""}`}
                  >
                    <div className="font-bold text-foreground text-base">
                      {plan.displayName}
                    </div>
                    {plan.highlight && (
                      <Badge className="mt-2" variant="default">
                        Most Popular
                      </Badge>
                    )}
                    {!plan.highlight && isRecommended && (
                      <Badge className="mt-2" variant="secondary">
                        Recommended
                      </Badge>
                    )}
                    {isCurrent && (
                      <Badge className="mt-2 bg-green-500/10 text-green-600 border-green-200" variant="outline">
                        Current Plan
                      </Badge>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y border-t">
            <tr>
              <td className="p-6 font-semibold text-foreground">
                Monthly Price
              </td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-price`}
                  className={`p-6 text-center ${plan.highlight ? "font-bold text-primary bg-primary/5" : "text-foreground"}`}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-bold">£{plan.price}</span>
                    <span className="text-xs text-muted-foreground font-normal">per month</span>
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-6 font-semibold text-foreground">AI Role</td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-ai-role`}
                  className={`p-6 text-center text-muted-foreground ${plan.highlight ? "bg-primary/5" : ""}`}
                >
                  {plan.aiLabel}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-6 font-semibold text-foreground">
                Automations / Month
              </td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-automations`}
                  className={`p-6 text-center text-muted-foreground ${plan.highlight ? "bg-primary/5" : ""}`}
                >
                  {plan.automations}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-6 font-semibold text-foreground">
                AI Responses / Month
              </td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-ai-responses`}
                  className={`p-6 text-center text-muted-foreground ${plan.highlight ? "bg-primary/5" : ""}`}
                >
                  {plan.aiResponses}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-6 font-semibold text-foreground">AI Overage</td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-ai-overage`}
                  className={`p-6 text-center text-muted-foreground ${plan.highlight ? "bg-primary/5" : ""}`}
                >
                  {plan.aiOverage}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-6 font-semibold text-foreground">Bots</td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-bots`}
                  className={`p-6 text-center text-muted-foreground ${plan.highlight ? "bg-primary/5" : ""}`}
                >
                  {plan.bots}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-6 font-semibold text-foreground">
                Supported Channels
              </td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-channels`}
                  className={`p-6 text-center text-muted-foreground ${plan.highlight ? "bg-primary/5" : ""}`}
                >
                  {plan.supportedChannels}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-6 font-semibold text-foreground">CRM Access</td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-crm-access`}
                  className={`p-6 text-center ${plan.highlight ? "bg-primary/5" : ""} ${plan.crmAccess ? "text-green-600" : "text-muted-foreground"}`}
                >
                  {plan.crmAccess ? (
                    <Check className="mx-auto h-5 w-5" />
                  ) : (
                    <X className="mx-auto h-5 w-5 opacity-30" />
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-6 font-semibold text-foreground">API Access</td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-api-access`}
                  className={`p-6 text-center ${plan.highlight ? "bg-primary/5" : ""} ${plan.apiAccess ? "text-green-600" : "text-muted-foreground"}`}
                >
                  {plan.apiAccess ? (
                    <Check className="mx-auto h-5 w-5" />
                  ) : (
                    <X className="mx-auto h-5 w-5 opacity-30" />
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-6 font-semibold text-foreground text-center rounded-b-2xl">
                Action
              </td>
              {PLANS.map((plan) => {
                const isRecommended = plan.name === preferredPlan;
                const isCurrent = currentSubscription?.plan?.name === plan.name;
                return (
                  <td
                    key={`${plan.name}-cta`}
                    className={`p-6 text-center align-top rounded-b-2xl ${plan.highlight || isRecommended ? "bg-primary/5" : ""}`}
                  >
                    <Button
                      className="w-full shadow-lg"
                      variant={isCurrent ? "outline" : (plan.highlight || isRecommended ? "default" : "outline")}
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
                    {plan.price > 0 && !isCurrent && (
                      <p className="mt-3 text-xs font-medium text-primary">
                        14 days free trial
                      </p>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pricing Summary Modal */}
      <Dialog open={!!selectedPlan} onOpenChange={(open) => !open && setSelectedPlan(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Trial Summary
            </DialogTitle>
            <DialogDescription>
              Review your trial details before proceeding.
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
                  <span className="text-sm text-muted-foreground">Free Trial</span>
                  <span className="font-semibold text-green-600">14 Days</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-border">
                  <span className="text-sm font-semibold">Price after trial</span>
                  <span className="text-lg font-bold text-foreground">£{selectedPlan.price}/mo</span>
                </div>
              </div>

              <div className="space-y-3 px-1">
                <div className="flex gap-3 text-sm">
                  <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <p>You won&apos;t be charged until your trial ends.</p>
                </div>
                <div className="flex gap-3 text-sm">
                  <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <p>Full access to all {selectedPlan.displayName} features.</p>
                </div>
                <div className="flex gap-3 text-sm">
                  <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <p>Cancel anytime before the trial ends.</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setSelectedPlan(null)} className="flex-1">
              Go Back
            </Button>
            <Button onClick={handleConfirmCheckout} className="flex-1 shadow-lg shadow-primary/20 gap-2">
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-12 max-w-4xl mx-auto rounded-2xl border border-primary/10 bg-primary/5 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Secure Billing:</strong> We use Stripe for all payments. 
          Your information is 100% secure and encrypted. Need a custom plan? 
          <Button variant="link" className="px-1 text-primary font-bold">Contact Sales</Button>
        </p>
      </div>
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

function getPriceId(planName: string) {
  if (planName === "starter") {
    return process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID;
  }
  if (planName === "pro") {
    return process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID;
  }
  if (planName === "business") {
    return process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID;
  }
  return "";
}
