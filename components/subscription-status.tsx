"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TrialBadge } from "./trial-badge";
import Link from "next/link";

interface PlanInfo {
  name: string;
  displayName?: string | null;
  price?: number | null;
  currency?: string | null;
}

interface Subscription {
  plan: PlanInfo | string;
  status: string;
  trialEndsAt: string | null;
  trialDaysRemaining: number;
}

export function SubscriptionStatus() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const res = await fetch("/api/billing/subscription");
        const data = await res.json();
        setSubscription(data);
      } catch (error) {
        console.error("Failed to fetch subscription:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  if (loading) return <div>Loading subscription...</div>;
  if (!subscription) return null;

  const planObj =
    typeof subscription.plan === "string" ? null : subscription.plan;
  const planName =
    planObj?.name ??
    (typeof subscription.plan === "string" ? subscription.plan : "Free");
  const planLabel = planObj?.displayName ?? planName ?? "Free";
  const planCurrency = (planObj?.currency ?? "GBP").toUpperCase();
  const planPrice = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: planCurrency,
  }).format(planObj?.price ?? 0);
  const isTrialUser = planName === "trial";
  const daysRemaining = subscription.trialDaysRemaining;

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Current Plan</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 capitalize">
              {isTrialUser ? "14-Day Free Trial" : planLabel}
            </p>
            {isTrialUser && (
              <TrialBadge trialEndsAt={subscription.trialEndsAt} />
            )}
          </div>
          {isTrialUser && daysRemaining <= 3 && (
            <Link href="/pricing">
              <Button>Upgrade Now</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="text-lg font-semibold">{planLabel}</div>
      <div className="text-sm text-muted-foreground">{planPrice}</div>

      {!isTrialUser && (
        <div>
          <p className="text-sm text-gray-600 mb-2">
            Status:{" "}
            <span className="capitalize font-medium">
              {subscription.status}
            </span>
          </p>
          <Link href="/billing">
            <Button variant="outline">Manage Subscription</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
