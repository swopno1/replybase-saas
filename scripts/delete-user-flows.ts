/**
 * Delete all flows for a specific user's tenant.
 *
 * Usage:
 *   pnpm tsx scripts/delete-user-flows.ts --email=user@example.com
 *   pnpm tsx scripts/delete-user-flows.ts --id=USER_ID
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import minimist from "minimist";

async function main() {
  const args = minimist(process.argv.slice(2));
  const email = args.email;
  const id = args.id;

  if (!email && !id) {
    console.error("Usage: pnpm tsx scripts/delete-user-flows.ts --email=user@example.com OR --id=USER_ID");
    process.exit(1);
  }

  try {
    const user = await prisma.user.findFirst({
      where: email ? { email } : { id },
      select: { id: true, tenantId: true, email: true },
    });

    if (!user) {
      console.error(`❌ User not found with ${email ? "email: " + email : "id: " + id}`);
      process.exit(1);
    }

    if (!user.tenantId) {
      console.error(`❌ User ${user.email || user.id} has no tenant.`);
      process.exit(1);
    }

    const flows = await prisma.flow.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, name: true },
    });

    if (flows.length === 0) {
      console.log(`ℹ️ No flows found for tenant ${user.tenantId} (User: ${user.email || user.id}).`);
      return;
    }

    console.log(`🗑️  Found ${flows.length} flow(s) for tenant ${user.tenantId}. Deleting...`);

    for (const flow of flows) {
      await prisma.flow.delete({ where: { id: flow.id } });
      console.log(`   ✅ Deleted flow: ${flow.name} (${flow.id})`);
    }

    console.log("\n✨ All tenant flows have been removed.");
  } catch (error) {
    console.error("❌ Error deleting flows:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
