
import { prisma } from "../lib/prisma";

async function migrate() {
  console.log("🚀 Starting financial data migration (Float -> Int / Cents)...");

  await prisma.$transaction(async (tx) => {
    // 1. Migrate Plans
    const plans = await tx.plan.findMany();
    console.log(`Found ${plans.length} plans to migrate.`);

    for (const plan of plans) {
      // If the price is small (e.g. 29, 89, 249) and not already in cents (e.g. 2900)
      // This is a heuristic, but safe for this specific SaaS
      if (plan.price > 0 && plan.price < 1000) {
        const newPrice = Math.round(plan.price * 100);
        await tx.plan.update({
          where: { id: plan.id },
          data: { price: newPrice },
        });
        console.log(`  Updated plan ${plan.name}: ${plan.price} -> ${newPrice}`);
      } else {
         console.log(`  Skipping plan ${plan.name} (price: ${plan.price})`);
      }
    }

    // 2. Migrate Revenue
    const revenueRecords = await tx.revenue.findMany();
    console.log(`Found ${revenueRecords.length} revenue records to migrate.`);

    for (const record of revenueRecords) {
      if (record.amount > 0 && record.amount < 1000) {
        const newAmount = Math.round(record.amount * 100);
        await tx.revenue.update({
          where: { id: record.id },
          data: { amount: newAmount },
        });
        console.log(`  Updated revenue record ${record.stripeInvoiceId}: ${record.amount} -> ${newAmount}`);
      } else {
        console.log(`  Skipping revenue record ${record.stripeInvoiceId} (amount: ${record.amount})`);
      }
    }
  });

  console.log("✅ Migration complete.");
}

migrate()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
