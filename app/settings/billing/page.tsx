"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

interface Subscription {
  status: string;
  plan: {
    name: string;
  };
  currentPeriodEnd: string;
  stripeId: string;
}

export default function BillingSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await fetch("/api/billing/subscription");
        if (response.ok) {
          const data = await response.json();
          setSubscription(data.subscription);
        }
      } catch (error) {
        console.error("Failed to fetch subscription:", error);
      } finally {
        setFetching(false);
      }
    };

    fetchSubscription();
  }, []);

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to open billing portal");
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast.error("Could not open billing portal");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    router.push("/pricing");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-50 border-green-200";
      case "trialing":
        return "bg-blue-50 border-blue-200";
      case "canceled":
        return "bg-red-50 border-red-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "active" || status === "trialing") {
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    }
    return <AlertCircle className="h-5 w-5 text-red-600" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Subscription & Billing</h3>
        <p className="text-sm text-muted-foreground">
          Manage your subscription plan and payment methods.
        </p>
      </div>

      {/* Current Subscription Card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            Your subscription details and billing information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetching ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading subscription...
            </div>
          ) : subscription ? (
            <div
              className={`p-4 border rounded-lg ${getStatusColor(subscription.status)}`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(subscription.status)}
                    <div>
                      <div className="font-semibold capitalize">
                        {subscription.plan?.name || "Free"} Plan
                      </div>
                      <div className="text-sm text-muted-foreground capitalize">
                        Status: {subscription.status}
                      </div>
                    </div>
                  </div>

                  {subscription.currentPeriodEnd && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">
                        Renewal Date:{" "}
                      </span>
                      <span className="font-medium">
                        {formatDate(subscription.currentPeriodEnd)}
                      </span>
                    </div>
                  )}

                  {subscription.stripeId && (
                    <div className="text-xs text-muted-foreground">
                      Stripe ID: {subscription.stripeId}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleManageSubscription}
                    disabled={loading}
                    variant="outline"
                  >
                    {loading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Manage in Stripe
                  </Button>

                  {subscription.plan?.name !== "business" && (
                    <Button onClick={handleUpgrade}>Upgrade Plan</Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
              <div className="space-y-3">
                <div>
                  <div className="font-medium">No Active Subscription</div>
                  <p className="text-sm text-muted-foreground">
                    You're currently on the Free plan. Upgrade to get more
                    features and higher limits.
                  </p>
                </div>
                <Link href="/pricing">
                  <Button>View Plans & Upgrade</Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing Portal Card */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods & Invoices</CardTitle>
          <CardDescription>
            Manage your payment methods and view billing history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Access your Stripe billing portal to update payment methods, view
            invoices, and manage your subscription.
          </p>
          <Button
            onClick={handleManageSubscription}
            disabled={loading}
            variant="outline"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Open Billing Portal
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
