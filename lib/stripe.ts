import Stripe from "stripe";
import { env } from "./env";

export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-01-28.clover" as Stripe.LatestApiVersion,
    })
  : null;

export const PLANS = {
  launch: {
    name: "Launch",
    monthlyPrice: 2900,
    annualPrice: 29000,
    monthlyPriceId: env.NEXT_PUBLIC_STRIPE_LAUNCH_PRICE_ID || "",
    annualPriceId: env.NEXT_PUBLIC_STRIPE_LAUNCH_ANNUAL_PRICE_ID || "",
  },
  grow: {
    name: "Grow",
    monthlyPrice: 4900,
    annualPrice: 49000,
    monthlyPriceId: env.NEXT_PUBLIC_STRIPE_GROW_PRICE_ID || "",
    annualPriceId: env.NEXT_PUBLIC_STRIPE_GROW_ANNUAL_PRICE_ID || "",
  },
  scale: {
    name: "Scale",
    monthlyPrice: 8900,
    annualPrice: 89000,
    monthlyPriceId: env.NEXT_PUBLIC_STRIPE_SCALE_PRICE_ID || "",
    annualPriceId: env.NEXT_PUBLIC_STRIPE_SCALE_ANNUAL_PRICE_ID || "",
  },
  business: {
    name: "Business",
    monthlyPrice: 24900,
    annualPrice: 249000,
    monthlyPriceId: env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID || "",
    annualPriceId: env.NEXT_PUBLIC_STRIPE_BUSINESS_ANNUAL_PRICE_ID || "",
  },
};

export const TRIAL_DAYS = 14;
