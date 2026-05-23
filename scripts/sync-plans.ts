// import "dotenv/config";
import { prisma } from "../lib/prisma";
import { PLAN_CONFIGS } from "../lib/plans";

async function sync() {
  console.log("Starting Plan Synchronization...");

  for (const [name, config] of Object.entries(PLAN_CONFIGS)) {
    console.log(`Syncing plan: ${name}...`);
    
    await prisma.plan.upsert({
      where: { name },
      update: {
        displayName: config.displayName,
        price: config.price / 100,
        dailyMessageLimit: config.dailyMessageLimit,
        monthlyMessageLimit: config.monthlyMessageLimit,
        flowExecutionCap: config.flowExecutionCap,
        maxBots: config.maxBots,
        maxChannelsPerBot: config.maxChannelsPerBot,
        maxConversations: config.maxConversations,
      },
      create: {
        name: config.name,
        displayName: config.displayName,
        price: config.price / 100,
        dailyMessageLimit: config.dailyMessageLimit,
        monthlyMessageLimit: config.monthlyMessageLimit,
        flowExecutionCap: config.flowExecutionCap,
        maxBots: config.maxBots,
        maxChannelsPerBot: config.maxChannelsPerBot,
        maxConversations: config.maxConversations,
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
