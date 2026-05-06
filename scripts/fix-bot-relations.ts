import { prisma } from "../lib/prisma";

async function main() {
  console.log("Starting data fix for bot relations...");

  const tenants = await prisma.tenant.findMany({
    include: {
      bots: true,
      facebookPages: {
        where: {
          botId: null,
        },
      },
    },
  });

  console.log(`Found ${tenants.length} tenants.`);

  for (const tenant of tenants) {
    let targetBotId: string;

    if (tenant.bots.length === 0) {
      console.log(`Tenant ${tenant.id} has no bots. Creating a Default Bot...`);
      const newBot = await prisma.bot.create({
        data: {
          name: "Default Bot",
          tenantId: tenant.id,
        },
      });
      targetBotId = newBot.id;
    } else {
      targetBotId = tenant.bots[0].id;
    }

    if (tenant.facebookPages.length > 0) {
      console.log(`Linking ${tenant.facebookPages.length} FacebookPages to bot ${targetBotId} for tenant ${tenant.id}`);
      await prisma.facebookPage.updateMany({
        where: {
          tenantId: tenant.id,
          botId: null,
        },
        data: {
          botId: targetBotId,
        },
      });
    }
  }

  // Final check for any orphaned records (though schema should mostly prevent this for others)
  const orphanedPages = await prisma.facebookPage.count({
    where: { botId: null },
  });

  if (orphanedPages > 0) {
    console.error(`CRITICAL: ${orphanedPages} FacebookPages still have no botId!`);
  } else {
    console.log("Success: All FacebookPages now have a botId.");
  }

  console.log("Data fix complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
