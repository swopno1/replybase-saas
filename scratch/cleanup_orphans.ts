import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("Searching for orphan tenants (tenants with no users)...");

  const orphanTenants = await prisma.tenant.findMany({
    where: {
      users: {
        none: {}
      }
    },
    include: {
      _count: {
        select: {
          users: true,
          bots: true,
          contacts: true,
          flows: true,
        }
      }
    }
  });

  console.log(`Found ${orphanTenants.length} orphan tenants.`);

  if (orphanTenants.length === 0) {
    console.log("No orphan tenants to clean up.");
    return;
  }

  for (const tenant of orphanTenants) {
    console.log(`\n----------------------------------------`);
    console.log(`Orphan Tenant: ${tenant.name} (ID: ${tenant.id})`);
    console.log(`Created At: ${tenant.createdAt}`);
    console.log(`Stats - Users: ${tenant._count.users}, Bots: ${tenant._count.bots}, Contacts: ${tenant._count.contacts}, Flows: ${tenant._count.flows}`);

    console.log(`Deleting tenant and associated data...`);
    
    // We run the deletion in a transaction for safety
    await prisma.$transaction(async (tx) => {
      // 1. Nullify optional references in models referencing tenant
      await tx.newsletterSubscriber.updateMany({
        where: { tenantId: tenant.id },
        data: { tenantId: null }
      });

      await tx.dataDeletionRequest.updateMany({
        where: { tenantId: tenant.id },
        data: { tenantId: null }
      });

      // 2. Delete dependent records sequentially to satisfy FK constraints
      await tx.crmMessage.deleteMany({
        where: { conversation: { contact: { tenantId: tenant.id } } },
      });
      await tx.internalNote.deleteMany({
        where: { conversation: { contact: { tenantId: tenant.id } } },
      });
      await tx.crmConversation.deleteMany({
        where: { contact: { tenantId: tenant.id } },
      });

      await tx.contactIdentity.deleteMany({
        where: { contact: { tenantId: tenant.id } },
      });

      await tx.lead.deleteMany({ where: { tenantId: tenant.id } });

      await tx.channel.deleteMany({
        where: { bot: { tenantId: tenant.id } },
      });
      await tx.webChatSite.deleteMany({ where: { tenantId: tenant.id } });
      await tx.executionLog.deleteMany({
        where: { bot: { tenantId: tenant.id } },
      });
      await tx.facebookPage.deleteMany({ where: { tenantId: tenant.id } });

      await tx.flow.deleteMany({ where: { tenantId: tenant.id } });
      await tx.contact.deleteMany({ where: { tenantId: tenant.id } });
      await tx.usageLog.deleteMany({ where: { tenantId: tenant.id } });
      await tx.bot.deleteMany({ where: { tenantId: tenant.id } });
      await tx.adminActivity.deleteMany({ where: { tenantId: tenant.id } });

      await tx.onboardingSession.deleteMany({
        where: { tenantId: tenant.id },
      });
      await tx.onboardingMetrics.deleteMany({
        where: { tenantId: tenant.id },
      });

      // 3. Delete the tenant itself
      await tx.tenant.delete({
        where: { id: tenant.id }
      });
    }, {
      maxWait: 15000,
      timeout: 30000
    });

    console.log(`Successfully deleted tenant ${tenant.id}`);
  }

  console.log("\nCleanup finished successfully!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
