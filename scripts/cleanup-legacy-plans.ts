import "dotenv/config";
import { prisma } from "../lib/prisma";

const LEGACY: Record<string, string> = {
  starter: "launch",
  pro: "scale",
};

async function cleanup() {
  console.log("Cleaning up legacy plans...");

  for (const [legacyName, canonicalName] of Object.entries(LEGACY)) {
    const legacy = await prisma.plan.findUnique({ where: { name: legacyName } });
    if (!legacy) {
      console.log(`  ${legacyName}: not found, skipping`);
      continue;
    }

    const canonical = await prisma.plan.findUnique({ where: { name: canonicalName } });
    if (!canonical) {
      console.error(`  ${legacyName}: canonical plan "${canonicalName}" not found — aborting`);
      process.exit(1);
    }

    const affected = await prisma.subscription.count({ where: { planId: legacy.id } });
    if (affected > 0) {
      console.log(`  ${legacyName}: migrating ${affected} subscription(s) → ${canonicalName}`);
      await prisma.subscription.updateMany({
        where: { planId: legacy.id },
        data: { planId: canonical.id },
      });
    }

    await prisma.plan.delete({ where: { name: legacyName } });
    console.log(`  ${legacyName}: deleted`);
  }

  console.log("Done.");
}

cleanup()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
