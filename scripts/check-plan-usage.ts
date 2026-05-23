import { prisma } from "../lib/prisma";

async function check() {
  const subscriptions = await prisma.subscription.findMany({
    include: { plan: true }
  });

  const usage: Record<string, number> = {};
  subscriptions.forEach(s => {
    const name = s.plan.name;
    usage[name] = (usage[name] || 0) + 1;
  });

  console.log("Plan Usage Count:");
  console.log(usage);
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
