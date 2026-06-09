import Stripe from "stripe";
import { env } from "./env";

export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-05-27.dahlia" as Stripe.LatestApiVersion,
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

// Warn at module load time in production if any price ID is missing.
// A missing ID means that plan's checkout button will silently fail.
if (typeof window === "undefined" && process.env.NODE_ENV === "production") {
  const missing: string[] = [];
  for (const [key, plan] of Object.entries(PLANS)) {
    if (!plan.monthlyPriceId) missing.push(`NEXT_PUBLIC_STRIPE_${key.toUpperCase()}_PRICE_ID`);
    if (!plan.annualPriceId) missing.push(`NEXT_PUBLIC_STRIPE_${key.toUpperCase()}_ANNUAL_PRICE_ID`);
  }
  if (missing.length > 0) {
    console.warn(
      `[Stripe] Missing price ID env vars — checkout will fail for these plans:\n  ${missing.join("\n  ")}`,
    );
  }
}
