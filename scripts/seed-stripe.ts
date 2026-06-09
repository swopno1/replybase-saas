import "dotenv/config"; // Enforce load before any other imports
import { prisma } from "../lib/prisma"; // Use the shared instance with adapter
import { PLAN_CONFIGS } from "../lib/plans";
import Stripe from "stripe";

const stripeSecret = process.env.STRIPE_SECRET_KEY;

async function seed() {
  if (!stripeSecret) {
    console.warn(
      "⚠️ STRIPE_SECRET_KEY is missing. Skipping Stripe product seeding, only updating DB plans.",
    );
  }

  const stripe = stripeSecret
    ? new Stripe(stripeSecret, {
        apiVersion: "2026-05-27.dahlia" as Stripe.LatestApiVersion,
      })
    : null;

  console.log("🌱 Seeding products and plans...");

  for (const plan of Object.values(PLAN_CONFIGS)) {
    let priceId = "";

    if (stripe && plan.price > 0) {
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

      const pricesList = await stripe.prices.list({
        product: product.id,
        active: true,
        limit: 10,
      });

      // Find monthly price
      let monthlyPrice = pricesList.data.find(
        (p) =>
          p.recurring?.interval === "month" && p.unit_amount === plan.price,
      );

      if (!monthlyPrice) {
        console.log(
          `   Creating monthly price for ${plan.displayName}: £${plan.price / 100}`,
        );
        monthlyPrice = await stripe.prices.create({
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
        console.log(`   Monthly price existing: ${monthlyPrice.id}`);
      }

      // Find annual price (10 months rate)
      const annualAmount = plan.price * 10;
      let annualPrice = pricesList.data.find(
        (p) =>
          p.recurring?.interval === "year" && p.unit_amount === annualAmount,
      );

      if (!annualPrice) {
        console.log(
          `   Creating annual price for ${plan.displayName}: £${annualAmount / 100}`,
        );
        annualPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: annualAmount,
          currency: "gbp",
          recurring: {
            interval: "year",
          },
          metadata: {
            app_plan_id: plan.name,
          },
        });
      } else {
        console.log(`   Annual price existing: ${annualPrice.id}`);
      }

      priceId = monthlyPrice.id;
      console.log(
        `   --> Stripe Annual Price ID for ${plan.name}: ${annualPrice.id}`,
      );
    }

    console.log(`   Upserting DB Plan: ${plan.name}`);
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: {
        displayName: plan.displayName,
        price: plan.price / 100,
        currency: "GBP",
        dailyMessageLimit: plan.dailyMessageLimit,
        monthlyMessageLimit: plan.monthlyMessageLimit,
        flowExecutionCap: plan.flowExecutionCap,
        maxBots: plan.maxBots,
        maxChannelsPerBot: plan.maxChannelsPerBot,
        maxConversations: plan.maxConversations,
      },
      create: {
        name: plan.name,
        displayName: plan.displayName,
        price: plan.price / 100,
        currency: "GBP",
        dailyMessageLimit: plan.dailyMessageLimit,
        monthlyMessageLimit: plan.monthlyMessageLimit,
        flowExecutionCap: plan.flowExecutionCap,
        maxBots: plan.maxBots,
        maxChannelsPerBot: plan.maxChannelsPerBot,
        maxConversations: plan.maxConversations,
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
    await prisma.$disconnect();
  });
