"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Zap, Clock, ShieldCheck, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PlanInfo {
  name: string;
  displayName?: string | null;
  price?: number | null;
  currency?: string | null;
}

interface Subscription {
  plan: PlanInfo;
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
        if (res.ok) {
          const data = await res.json();
          setSubscription(data.subscription);
        }
      } catch (error) {
        console.error("Failed to fetch subscription:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  if (loading) {
    return (
      <div className="border rounded-2xl p-6 bg-card animate-pulse space-y-3">
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="h-8 w-32 bg-muted rounded" />
        <div className="h-10 w-full bg-muted rounded" />
      </div>
    );
  }

  if (!subscription) return null;

  const isTrial = subscription.status === "trialing";
  const planLabel = subscription.plan?.displayName || "Free";
  const daysRemaining = subscription.trialDaysRemaining;

  return (
    <div className="border rounded-2xl p-6 bg-card shadow-sm hover:shadow-md transition-shadow ring-1 ring-border/5">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Plan</p>
          <h3 className="text-2xl font-black flex items-center gap-2">
            {planLabel}
            {isTrial && (
              <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">Trial</Badge>
            )}
          </h3>
        </div>
        <div className={`p-2 rounded-xl ${isTrial ? "bg-amber-100" : "bg-primary/10"}`}>
          {isTrial ? <Clock className="h-5 w-5 text-amber-600" /> : <ShieldCheck className="h-5 w-5 text-primary" />}
        </div>
      </div>

      <div className="space-y-4">
        {isTrial ? (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-muted-foreground">Trial Period</span>
              <span className="text-amber-600">{daysRemaining} days left</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 transition-all duration-1000" 
                style={{ width: `${(daysRemaining / 14) * 100}%` }}
              />
            </div>
            <Link href="/pricing" className="block pt-2">
              <Button className="w-full h-9 text-xs font-bold gap-2 shadow-lg shadow-primary/10">
                Upgrade Now
                <Zap className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{subscription.status === "active" ? "Subscription active" : subscription.status}</span>
            </div>
            <Link href="/settings?tab=billing" className="block">
              <Button variant="outline" className="w-full h-9 text-xs font-bold gap-2 group">
                Manage Billing
                <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
