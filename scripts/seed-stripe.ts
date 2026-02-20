import "dotenv/config"; // Enforce load before any other imports
import { prisma } from "../lib/prisma"; // Use the shared instance with adapter
import Stripe from "stripe";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  console.error("❌ STRIPE_SECRET_KEY is missing.");
  process.exit(1);
}

const stripe = new Stripe(stripeSecret, {
  apiVersion: "2026-01-28.clover",
});

const PLANS = [
  {
    name: "free",
    displayName: "Free",
    price: 0,
    limits: {
      dailyMessageLimit: 100,
      monthlyMessageLimit: 3000,
      flowExecutionCap: 100,
      maxBots: 1,
      maxChannelsPerBot: 1,
      maxConversations: 100,
    },
  },
  {
    name: "starter",
    displayName: "Starter",
    price: 1900, // £19.00
    limits: {
      dailyMessageLimit: 1000,
      monthlyMessageLimit: 30000,
      flowExecutionCap: 1000,
      maxBots: 3,
      maxChannelsPerBot: 3,
      maxConversations: 1000,
    },
  },
  {
    name: "pro",
    displayName: "Pro",
    price: 4900, // £49.00
    limits: {
      dailyMessageLimit: 5000,
      monthlyMessageLimit: 150000,
      flowExecutionCap: 5000,
      maxBots: 10,
      maxChannelsPerBot: 5,
      maxConversations: 5000,
    },
  },
  {
    name: "business",
    displayName: "Business",
    price: 9900, // £99.00
    limits: {
      dailyMessageLimit: 20000,
      monthlyMessageLimit: 600000,
      flowExecutionCap: 20000,
      maxBots: 50,
      maxChannelsPerBot: 10,
      maxConversations: 20000,
    },
  },
];

async function seed() {
  console.log("🌱 Seeding Stripe products and plans...");
  // Note: prisma instance is already connected or will connect on first query

  for (const plan of PLANS) {
    let priceId = "";

    if (plan.price > 0) {
      console.log(`\nProcessing Stripe product for ${plan.displayName}...`);

      const products = await stripe.products.search({
        query: `name:'ReplyBase ${plan.displayName}'`,
      });

      let product = products.data[0];

      if (!product) {
        console.log(`   Creating product: ReplyBase ${plan.displayName}`);
        product = await stripe.products.create({
          name: `ReplyBase ${plan.displayName}`,
          metadata: {
            app_plan_id: plan.name,
          },
        });
      } else {
        console.log(`   Product existing: ${product.id}`);
      }

      const prices = await stripe.prices.list({
        product: product.id,
        limit: 1,
        active: true,
      });

      let price = prices.data[0];

      if (!price || price.unit_amount !== plan.price) {
        console.log(
          `   Creating price for ${plan.displayName}: £${plan.price / 100}`,
        );
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.price,
          currency: "gbp",
          recurring: {
            interval: "month",
          },
          metadata: {
            app_plan_id: plan.name,
          },
        });
      } else {
        console.log(`   Price existing: ${price.id}`);
      }

      priceId = price.id;
    }

    console.log(`   Upserting DB Plan: ${plan.name}`);
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: {
        displayName: plan.displayName,
        price: plan.price / 100,
        currency: "GBP",
        ...plan.limits,
      },
      create: {
        name: plan.name,
        displayName: plan.displayName,
        price: plan.price / 100,
        currency: "GBP",
        ...plan.limits,
      },
    });

    if (priceId) {
      console.log(`   --> Stripe Price ID for ${plan.name}: ${priceId}`);
    }
  }

  console.log("\n✅ Seeding complete.");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // No explicit disconnect needed for singleton usually, but good practice
    // await prisma.$disconnect();
  });
