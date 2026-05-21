import "dotenv/config";
import { prisma } from "../lib/prisma";

const EMAILS_TO_DELETE = [
  "coupon3@test.com",
  "cupon2@test.com",
  "coupon@test.com",
  "test@aaa.com"
];

async function main() {
  console.log(`Searching for test users: ${EMAILS_TO_DELETE.join(", ")}...`);

  for (const email of EMAILS_TO_DELETE) {
    console.log(`\n----------------------------------------`);
    console.log(`Processing deletion for user email: ${email}`);

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        tenantId: true,
      },
    });

    if (!user) {
      console.log(`User with email ${email} not found. Skipping.`);
      continue;
    }

    console.log(`Found User ID: ${user.id}, Tenant ID: ${user.tenantId}`);

    try {
      await prisma.$transaction(async (tx) => {
        const usersInTenant = await tx.user.count({
          where: { tenantId: user.tenantId },
        });

        console.log(`Number of users in tenant ${user.tenantId}: ${usersInTenant}`);

        // Remove user-bound records with restrictive FKs before deleting the user.
        await tx.executionLog.deleteMany({ where: { userId: user.id } });
        await tx.internalNote.deleteMany({ where: { authorId: user.id } });
        
        // Clean up relations that prevent user deletion
        await tx.adminActivity.updateMany({ where: { adminId: user.id }, data: { adminId: null } });
        await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
        
        // Nullify optional references so logs/conversations remain but user is gone
        await tx.activityLog.updateMany({ where: { userId: user.id }, data: { userId: null } });
        await tx.usageLog.updateMany({ where: { userId: user.id }, data: { userId: null } });
        await tx.churnFeedback.updateMany({ where: { userId: user.id }, data: { userId: null } });
        await tx.crmConversation.updateMany({ where: { assigneeId: user.id }, data: { assigneeId: null } });
        await tx.newsletterSubscriber.updateMany({ where: { userId: user.id }, data: { userId: null } });
        await tx.dataDeletionRequest.updateMany({ where: { userId: user.id }, data: { userId: null } });

        // Delete the user accounts and sessions
        await tx.account.deleteMany({ where: { userId: user.id } });
        await tx.session.deleteMany({ where: { userId: user.id } });

        // Delete the user itself
        await tx.user.delete({ where: { id: user.id } });

        if (usersInTenant > 1) {
          console.log(`Tenant has other users. Not deleting tenant ${user.tenantId}.`);
          return;
        }

        console.log(`Last user in tenant. Purging all tenant-bound data...`);

        // Last user in tenant: remove remaining tenant-bound data that uses RESTRICT.
        await tx.crmMessage.deleteMany({
          where: { conversation: { contact: { tenantId: user.tenantId } } },
        });
        await tx.internalNote.deleteMany({
          where: { conversation: { contact: { tenantId: user.tenantId } } },
        });
        await tx.crmConversation.deleteMany({
          where: { contact: { tenantId: user.tenantId } },
        });

        await tx.contactIdentity.deleteMany({
          where: { contact: { tenantId: user.tenantId } },
        });

        await tx.lead.deleteMany({ where: { tenantId: user.tenantId } });

        await tx.channel.deleteMany({
          where: { bot: { tenantId: user.tenantId } },
        });
        await tx.webChatSite.deleteMany({ where: { tenantId: user.tenantId } });
        await tx.executionLog.deleteMany({
          where: { bot: { tenantId: user.tenantId } },
        });
        await tx.facebookPage.deleteMany({ where: { tenantId: user.tenantId } });

        await tx.flow.deleteMany({ where: { tenantId: user.tenantId } });
        await tx.contact.deleteMany({ where: { tenantId: user.tenantId } });
        await tx.usageLog.deleteMany({ where: { tenantId: user.tenantId } });
        await tx.bot.deleteMany({ where: { tenantId: user.tenantId } });
        await tx.adminActivity.deleteMany({ where: { tenantId: user.tenantId } });

        // These models are tenant-keyed but not FK-linked to tenants.
        await tx.onboardingSession.deleteMany({
          where: { tenantId: user.tenantId },
        });
        await tx.onboardingMetrics.deleteMany({
          where: { tenantId: user.tenantId },
        });

        // Nullify tenantId in newsletters & data deletion requests to avoid FK issues
        await tx.newsletterSubscriber.updateMany({
          where: { tenantId: user.tenantId },
          data: { tenantId: null }
        });
        await tx.dataDeletionRequest.updateMany({
          where: { tenantId: user.tenantId },
          data: { tenantId: null }
        });

        // Delete the tenant itself
        await tx.tenant.delete({ where: { id: user.tenantId } });
        console.log(`Tenant ${user.tenantId} deleted successfully.`);
      }, {
        maxWait: 15000,
        timeout: 30000,
      });

      console.log(`Successfully completed deletion sequence for ${email}`);
    } catch (err) {
      console.error(`Failed to delete user ${email}:`, err);
    }
  }

  console.log("\nCleanup script finished!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
