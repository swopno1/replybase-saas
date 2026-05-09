import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    include: {
      subscriptions: true,
      users: true,
    }
  });

  console.log(`Total Tenants: ${tenants.length}`);
  tenants.forEach(t => {
    console.log(`Tenant: ${t.name} (ID: ${t.id})`);
    console.log(`  Subscription: ${t.subscriptions ? 'Yes' : 'No'}`);
    console.log(`  Users: ${t.users?.length || 0}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
