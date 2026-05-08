const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const plans = await prisma.plan.findMany({
    select: {
      name: true,
      monthlyMessageLimit: true,
      flowExecutionCap: true,
      maxBots: true
    }
  });
  console.log('--- Current Plan Limits in DB ---');
  console.table(plans);
  
  const subs = await prisma.subscription.findMany({
    include: { plan: { select: { name: true } } },
    take: 5
  });
  console.log('\n--- Recent Subscriptions ---');
  console.log(subs.map(s => ({ tenant: s.tenantId, plan: s.plan?.name, status: s.status })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
