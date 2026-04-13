"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";
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
  }, []);

  const handleSubscribe = async (planName: string) => {
    trackEvent("get_started_click", {
      properties: {
        plan: planName,
        source: "pricing_table",
        origin: "app",
      },
    });

    if (planName === "free") {
      router.push("/");
      return;
    }

    setLoading(planName);

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
        window.location.href = data.url;
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
        <Badge variant="secondary" className="mb-4">
          14-Day Free Trial
        </Badge>
        <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
        <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
          Start free, upgrade as you grow. Paid plans unlock Telegram and
          WhatsApp alongside Webchat, Facebook, and website lead capture with
          flow-first runtime and optional AI fallback.
        </p>
        <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border bg-muted/50 px-5 py-3 text-sm">
          <span className="font-semibold">14 days free on paid plans</span>
          <span className="text-muted-foreground">
            No card charged until trial ends • Cancel anytime
          </span>
        </div>
        {source ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Recommended based on your onboarding path.
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card p-2 shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-4 w-1/5">Feature</th>
              {PLANS.map((plan) =>
                (() => {
                  const isRecommended = plan.name === preferredPlan;
                  return (
                    <th
                      key={plan.name}
                      className={`p-4 text-center ${plan.highlight || isRecommended ? "text-primary" : ""}`}
                    >
                      <div className="font-semibold text-foreground text-sm">
                        {plan.displayName}
                      </div>
                      {plan.highlight && (
                        <div className="mt-1 text-[11px] font-medium text-primary">
                          Most Popular
                        </div>
                      )}
                      {!plan.highlight && isRecommended && (
                        <div className="mt-1 text-[11px] font-medium text-primary">
                          Recommended for you
                        </div>
                      )}
                    </th>
                  );
                })(),
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr>
              <td className="p-4 font-semibold text-foreground">
                Monthly Price
              </td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-price`}
                  className={`p-4 text-center ${plan.highlight ? "font-bold text-primary" : "text-foreground"}`}
                >
                  £{plan.price}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-semibold text-foreground">AI Role</td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-ai-role`}
                  className="p-4 text-center text-muted-foreground"
                >
                  {plan.aiLabel}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-semibold text-foreground">
                Automations / Month
              </td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-automations`}
                  className="p-4 text-center text-muted-foreground"
                >
                  {plan.automations}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-semibold text-foreground">
                AI Responses / Month
              </td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-ai-responses`}
                  className="p-4 text-center text-muted-foreground"
                >
                  {plan.aiResponses}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-semibold text-foreground">AI Overage</td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-ai-overage`}
                  className="p-4 text-center text-muted-foreground"
                >
                  {plan.aiOverage}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-semibold text-foreground">Bots</td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-bots`}
                  className="p-4 text-center text-muted-foreground"
                >
                  {plan.bots}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-semibold text-foreground">
                Supported Channels
              </td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-channels`}
                  className="p-4 text-center text-muted-foreground"
                >
                  {plan.supportedChannels}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-semibold text-foreground">CRM Access</td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-crm-access`}
                  className={
                    "p-4 text-center " +
                    (plan.crmAccess ? "text-green-600" : "text-red-500")
                  }
                >
                  {plan.crmAccess ? (
                    <Check className="mx-auto h-4 w-4" />
                  ) : (
                    <X className="mx-auto h-4 w-4" />
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-semibold text-foreground">API Access</td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-api-access`}
                  className={
                    "p-4 text-center " +
                    (plan.apiAccess ? "text-green-600" : "text-red-500")
                  }
                >
                  {plan.apiAccess ? (
                    <Check className="mx-auto h-4 w-4" />
                  ) : (
                    <X className="mx-auto h-4 w-4" />
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-semibold text-foreground">Support</td>
              {PLANS.map((plan) => (
                <td
                  key={`${plan.name}-support`}
                  className="p-4 text-center text-muted-foreground"
                >
                  {plan.support}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-semibold text-foreground">Get Started</td>
              {PLANS.map((plan) =>
                (() => {
                  const isRecommended = plan.name === preferredPlan;
                  return (
                    <td
                      key={`${plan.name}-cta`}
                      className="p-4 text-center align-top"
                    >
                      <Button
                        className="w-full"
                        variant={
                          plan.highlight || isRecommended
                            ? "default"
                            : "outline"
                        }
                        onClick={() => handleSubscribe(plan.name)}
                        disabled={loading !== null}
                      >
                        {loading === plan.name
                          ? "Processing..."
                          : isRecommended
                            ? `${plan.cta} (Recommended)`
                            : plan.cta}
                      </Button>
                      {plan.price > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          14 days free
                        </p>
                      )}
                    </td>
                  );
                })(),
              )}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-8 max-w-4xl mx-auto rounded-xl border border-primary/20 bg-primary/5 p-4 text-center text-sm text-muted-foreground">
        <strong className="text-foreground">Transparent billing:</strong> all
        paid plans include a 14-day free trial, then continue at Starter £29,
        Pro £89, and Business £249.
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-20 text-center">Loading pricing...</div>
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
