import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15'
});

export const PLANS = {
  starter: {
    name: 'Starter',
    price: 1900, // in cents
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || ''
  },
  pro: {
    name: 'Pro',
    price: 2900,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || ''
  },
  business: {
    name: 'Business',
    price: 4900,
    priceId: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID || ''
  }
};

export const TRIAL_DAYS = 14;