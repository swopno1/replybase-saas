'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TrialBadge } from './trial-badge';
import Link from 'next/link';

interface Subscription {
  plan: string;
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
        const res = await fetch('/api/billing/subscription');
        const data = await res.json();
        setSubscription(data);
      } catch (error) {
        console.error('Failed to fetch subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  if (loading) return <div>Loading subscription...</div>;
  if (!subscription) return null;

  const isTrialUser = subscription.plan === 'trial';
  const daysRemaining = subscription.trialDaysRemaining;

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Current Plan</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 capitalize">
              {isTrialUser ? '14-Day Free Trial' : subscription.plan}
            </p>
            {isTrialUser && <TrialBadge trialEndsAt={subscription.trialEndsAt} />}
          </div>
          {isTrialUser && daysRemaining <= 3 && (
            <Link href="/pricing">
              <Button>Upgrade Now</Button>
            </Link>
          )}
        </div>
      </div>

      {!isTrialUser && (
        <div>
          <p className="text-sm text-gray-600 mb-2">Status: <span className="capitalize font-medium">{subscription.status}</span></p>
          <Link href="/billing-portal">
            <Button variant="outline">Manage Subscription</Button>
          </Link>
        </div>
      )}
    </div>
  );
}