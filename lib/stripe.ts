import Stripe from "stripe";

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-01-28.clover",
    })
  : null;

export const PLANS = {
  starter: {
    name: "Starter",
    price: 2900, // in cents
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || "",
  },
  pro: {
    name: "Pro",
    price: 8900,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "",
  },
  business: {
    name: "Business",
    price: 24900,
    priceId: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID || "",
  },
};

export const TRIAL_DAYS = 14;
