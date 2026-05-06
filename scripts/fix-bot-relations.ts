import { prisma } from "../lib/prisma";

async function main() {
  console.log("Starting data fix for bot relations...");

  // 1. Fetch all tenants with their bots and integrations
  const tenants = await prisma.tenant.findMany({
    include: {
      bots: true,
      facebookPages: true,
      webChatSites: true,
      channels: true,
    },
  });

  console.log(`Found ${tenants.length} tenants.`);

  for (const tenant of tenants) {
    let targetBotId: string;

    // 2. Ensure every tenant has at least one bot
    if (tenant.bots.length === 0) {
      console.log(`Tenant ${tenant.id} (${tenant.name}) has no bots. Creating a Default Bot...`);
      const newBot = await prisma.bot.create({
        data: {
          name: "Default Bot",
          tenantId: tenant.id,
        },
      });
      targetBotId = newBot.id;
    } else {
      // Use the first existing bot as the default for orphaned integrations
      targetBotId = tenant.bots[0].id;
    }

    // 3. Link orphaned FacebookPages
    const orphanedPages = tenant.facebookPages.filter(p => !p.botId);
    if (orphanedPages.length > 0) {
      console.log(`Linking ${orphanedPages.length} FacebookPages to bot ${targetBotId} for tenant ${tenant.id}`);
      for (const page of orphanedPages) {
        await prisma.facebookPage.update({
          where: { id: page.id },
          data: { botId: targetBotId }
        });
      }
    }

    // 4. Link orphaned WebChatSites
    const orphanedWebChat = tenant.webChatSites.filter(s => !s.botId);
    if (orphanedWebChat.length > 0) {
      console.log(`Linking ${orphanedWebChat.length} WebChatSites to bot ${targetBotId} for tenant ${tenant.id}`);
      for (const site of orphanedWebChat) {
        await prisma.webChatSite.update({
          where: { id: site.id },
          data: { botId: targetBotId }
        });
      }
    }

    // 5. Ensure all channels have tenantId and botId
    for (const channel of tenant.channels) {
      if (!channel.tenantId || !channel.botId) {
        console.log(`Updating channel ${channel.id} for tenant ${tenant.id}`);
        await prisma.channel.update({
          where: { id: channel.id },
          data: {
            tenantId: tenant.id,
            botId: channel.botId || targetBotId
          },
        });
      }
    }
  }

  console.log("Success: All integrations processed.");
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
