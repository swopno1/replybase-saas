import { prisma } from "../lib/prisma";

async function cleanup() {
  console.log("Cleaning up legacy plans...");

  const legacyNames = ["starter", "pro"];

  for (const name of legacyNames) {
    const plan = await prisma.plan.findUnique({
      where: { name }
    });

    if (plan) {
      // Check if any subscriptions are using it
      const count = await prisma.subscription.count({
        where: { planId: plan.id }
      });

      if (count === 0) {
        console.log(`Deleting unused legacy plan: ${name}`);
        await prisma.plan.delete({ where: { name } });
      } else {
        console.log(`Legacy plan ${name} is still in use by ${count} subscriptions. Skipping deletion.`);
      }
    }
  }
}

cleanup()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
