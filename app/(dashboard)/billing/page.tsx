"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";

interface Subscription {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: string;
  trialDaysRemaining: number;
  plan: {
    id: string;
    name: string;
    displayName: string;
    price: number;
    currency: string;
  };
}

const BillingPage = () => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await fetch("/api/billing/subscription");
      if (!response.ok) {
        throw new Error("Failed to fetch subscription");
      }
      const data = await response.json();
      setSubscription(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to create portal session");
      }
      const data = await response.json();
      window.location.href = data.url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to open billing portal"
      );
    }
  };

  const handleUpgrade = () => {
    router.push("/pricing");
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(price);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "trialing":
        return "secondary";
      case "canceled":
        return "destructive";
      case "past_due":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto">
          <Skeleton className="h-8 w-48 mb-6" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <Button onClick={fetchSubscription}>Try Again</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-600 mb-4">No subscription found</p>
                <Button onClick={fetchSubscription}>Refresh</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isFreePlan = subscription.plan.name === "free";
  const isTrialing = subscription.status === "trialing";

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Billing</h1>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">
                  {subscription.plan.displayName}
                </CardTitle>
                <CardDescription>
                  {formatPrice(
                    subscription.plan.price,
                    subscription.plan.currency
                  )}{" "}
                  per month
                </CardDescription>
              </div>
              <Badge variant={getStatusBadgeVariant(subscription.status)}>
                {subscription.status}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {isTrialing && subscription.trialDaysRemaining > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800">
                  <strong>{subscription.trialDaysRemaining} days left</strong>{" "}
                  in your free trial
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-600">Current Period</p>
                <p>
                  {new Date(
                    subscription.currentPeriodStart
                  ).toLocaleDateString()}{" "}
                  -{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-600">Status</p>
                <p className="capitalize">{subscription.status}</p>
                {subscription.cancelAtPeriodEnd && (
                  <p className="text-red-600 text-xs">Cancels at period end</p>
                )}
              </div>
            </div>

            <div className="pt-4">
              {isFreePlan ? (
                <Button onClick={handleUpgrade} className="w-full">
                  Upgrade Plan
                </Button>
              ) : (
                <Button
                  onClick={handleManageSubscription}
                  variant="outline"
                  className="w-full"
                >
                  Manage Subscription
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BillingPage;
