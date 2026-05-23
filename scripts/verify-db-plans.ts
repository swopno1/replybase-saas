import { prisma } from "../lib/prisma";

async function verify() {
  const plans = await prisma.plan.findMany({
    orderBy: { price: 'asc' }
  });
  console.log("Current Plans in DB:");
  plans.forEach(p => {
    console.log(`- ${p.name} (${p.displayName}): £${p.price}, MaxBots: ${p.maxBots}, MonthlyLimit: ${p.monthlyMessageLimit}`);
  });
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
