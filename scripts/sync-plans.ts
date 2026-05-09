import { PrismaClient } from "@prisma/client";
import { PLAN_CONFIGS } from "../lib/plans";
import * as dotenv from "dotenv";

dotenv.config();

console.log("DATABASE_URL present:", !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
  console.log("DATABASE_URL starts with:", process.env.DATABASE_URL.substring(0, 10));
}

const prisma = new PrismaClient();

async function sync() {
  console.log("Starting Plan Synchronization...");

  for (const [name, config] of Object.entries(PLAN_CONFIGS)) {
    console.log(`Syncing plan: ${name}...`);
    
    await prisma.plan.upsert({
      where: { name },
      update: {
        displayName: config.displayName,
        price: config.price,
        dailyMessageLimit: config.dailyMessageLimit,
        monthlyMessageLimit: config.monthlyMessageLimit,
        flowExecutionCap: config.flowExecutionCap,
        maxBots: config.maxBots,
        maxChannelsPerBot: config.maxChannelsPerBot,
      },
      create: {
        name: config.name,
        displayName: config.displayName,
        price: config.price,
        dailyMessageLimit: config.dailyMessageLimit,
        monthlyMessageLimit: config.monthlyMessageLimit,
        flowExecutionCap: config.flowExecutionCap,
        maxBots: config.maxBots,
        maxChannelsPerBot: config.maxChannelsPerBot,
        currency: "GBP",
      },
    });
  }

  console.log("Plan Synchronization Complete!");
}

sync()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
