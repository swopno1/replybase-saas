'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: 19,
    description: 'Perfect for getting started',
    features: [
      '1 project',
      '5 bots',
      'Webhook integration',
      'Email support'
    ]
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 29,
    description: 'For growing teams',
    features: [
      'Unlimited projects',
      'Unlimited bots',
      'All channels',
      'Priority support',
      'Analytics dashboard'
    ],
    popular: true
  },
  {
    key: 'business',
    name: 'Business',
    price: 49,
    description: 'Enterprise-grade features',
    features: [
      'Everything in Pro',
      'Advanced analytics',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee'
    ]
  }
];

export default function PricingPage() {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async (planKey: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey })
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout failed:', error);
      alert('Checkout failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
        <p className="text-xl text-gray-600">Start free for 14 days. No credit card required.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className={`border rounded-lg p-8 space-y-6 ${
              plan.popular ? 'ring-2 ring-blue-500 relative' : ''
            }`}
          >
            {plan.popular && (
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              </div>
            )}

            <div>
              <h3 className="text-2xl font-bold">{plan.name}</h3>
              <p className="text-gray-600 text-sm mt-1">{plan.description}</p>
            </div>

            <div>
              <span className="text-4xl font-bold">${plan.price}</span>
              <span className="text-gray-600">/month</span>
            </div>

            <Button
              onClick={() => handleCheckout(plan.key)}
              disabled={loading}
              className="w-full"
              variant={plan.popular ? 'default' : 'outline'}
            >
              {loading ? 'Processing...' : 'Choose Plan'}
            </Button>

            <div className="space-y-3">
              {plan.features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}