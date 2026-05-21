import { prisma } from "../lib/prisma";

async function main() {
  const tenantId = "cmox3h0uw000013nwaubo2wm8";
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      channels: {
        include: {
          bot: true
        }
      },
      webChatSites: true,
    },
  });

  if (!tenant) {
    console.log("Tenant not found");
    return;
  }

  console.log(`Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`Channels Count: ${tenant.channels.length}`);
  tenant.channels.forEach((c) => {
    console.log(`Channel ID: ${c.id}`);
    console.log(`  Type: ${c.type}`);
    console.log(`  Name: ${c.name}`);
    console.log(`  AccessToken: ${c.accessToken ? 'Present (non-null)' : 'null'}`);
    console.log(`  PageId: ${c.pageId}`);
    console.log(`  ChannelId: ${c.channelId}`);
    console.log(`  Enabled: ${c.enabled}`);
    console.log(`  IsActive: ${c.isActive}`);
    console.log(`  BotId: ${c.botId}`);
    console.log(`  Bot Name: ${c.bot?.name}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
