const { PrismaClient } = require("@prisma/client");
const dotenv = require("dotenv");

dotenv.config();

const PLAN_CONFIGS = {
  free: {
    name: "free",
    displayName: "Free",
    price: 0,
    dailyMessageLimit: 100,
    monthlyMessageLimit: 100,
    flowExecutionCap: 200,
    maxBots: 1,
    maxChannelsPerBot: 1,
  },
  starter: {
    name: "starter",
    displayName: "Starter",
    price: 2900,
    dailyMessageLimit: 500,
    monthlyMessageLimit: 1000,
    flowExecutionCap: 1500,
    maxBots: 3,
    maxChannelsPerBot: 5,
  },
  pro: {
    name: "pro",
    displayName: "Pro",
    price: 8900,
    dailyMessageLimit: 2000,
    monthlyMessageLimit: 7500,
    flowExecutionCap: 10000,
    maxBots: 10,
    maxChannelsPerBot: 5,
  },
  business: {
    name: "business",
    displayName: "Business",
    price: 24900,
    dailyMessageLimit: 5000,
    monthlyMessageLimit: 25000,
    flowExecutionCap: 40000,
    maxBots: 25,
    maxChannelsPerBot: 5,
  },
};

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
    console.error("SYNC ERROR:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
