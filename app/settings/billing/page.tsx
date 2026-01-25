"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function BillingSettingsPage() {
    const [loading, setLoading] = useState(false);
    const [subscription, setSubscription] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        // Fetch subscription status
        // We don't have a dedicated API for this yet, let's assume we can fetch user or use text for now
        // Ideally we fetch from /api/billing/subscription or similar
        // For MVP, if we don't have the endpoint, we just show the Manage button which handles the "No subscription" case via Portal API error or creating one
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

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Subscription & Billing</h3>
                <p className="text-sm text-muted-foreground">
                    Manage your subscription plan and payment methods.
                </p>
            </div>
            <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="font-medium">Current Plan</div>
                        <div className="text-sm text-muted-foreground">
                            {/* Placeholder for real status */}
                            Manage your subscription details securely on Stripe.
                        </div>
                    </div>
                    <Button onClick={handleManageSubscription} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Manage Subscription
                    </Button>
                </div>
            </div>
        </div>
    );
}
