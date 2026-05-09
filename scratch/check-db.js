const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const totalTenants = await prisma.tenant.count();
  const totalSubscriptions = await prisma.subscription.count();
  const tenantsWithoutSubscriptions = await prisma.tenant.findMany({
    where: {
      subscriptions: {
        none: {}
      }
    },
    include: {
      _count: {
        select: { users: true }
      }
    }
  });

  console.log('Total Tenants:', totalTenants);
  console.log('Total Subscriptions:', totalSubscriptions);
  console.log('Tenants without Subscriptions:', tenantsWithoutSubscriptions.length);
  
  if (tenantsWithoutSubscriptions.length > 0) {
    console.log('Example Tenant without Sub:', JSON.stringify(tenantsWithoutSubscriptions[0], null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
