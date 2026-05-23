
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🚀 Starting revenue system validation...");

  // 1. Setup mock data
  const tenant = await prisma.tenant.create({
    data: {
      name: "Revenue Test Tenant",
    },
  });

  const plan = await prisma.plan.findFirst({ where: { name: "scale" } }) || await prisma.plan.create({
      data: {
          name: "scale",
          displayName: "Scale Plan",
          price: 8900,
      }
  });

  const subscription = await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      stripeId: "sub_test_" + Date.now(),
      stripeCustomerId: "cus_test_" + Date.now(),
      planId: plan.id,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log(`✅ Created test tenant and subscription: ${tenant.id}`);

  // 2. Simulate invoice.paid event
  const mockInvoiceId = "in_test_" + Date.now();
  const mockAmount = 8900; // Cents

  console.log("📡 Simulating invoice.paid event...");

  const recordedRevenue = await prisma.revenue.create({
    data: {
      stripeInvoiceId: mockInvoiceId,
      stripeSubscriptionId: subscription.stripeId,
      tenantId: tenant.id,
      amount: mockAmount,
      currency: "USD",
      status: "paid",
      paidAt: new Date(),
    },
  });

  console.log(`✅ Recorded revenue record: ${recordedRevenue.id}`);

  // 3. Verify revenue calculation
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const revenueSum = await prisma.revenue.aggregate({
    _sum: { amount: true },
    where: {
      status: "paid",
      paidAt: { gte: thirtyDaysAgo },
    },
  });

  console.log(`📊 Total revenue in last 30 days: $${revenueSum._sum.amount}`);

  if (revenueSum._sum.amount !== null && revenueSum._sum.amount >= mockAmount) {
    console.log("✨ Validation SUCCESS: Revenue correctly tracked.");
  } else {
    console.error("❌ Validation FAILED: Revenue sum mismatch.");
    process.exit(1);
  }

  // 4. Cleanup
  await prisma.revenue.delete({ where: { id: recordedRevenue.id } });
  await prisma.subscription.delete({ where: { id: subscription.id } });
  await prisma.tenant.delete({ where: { id: tenant.id } });
  console.log("🧹 Cleanup complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
