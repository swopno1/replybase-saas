import "dotenv/config";
import { prisma } from "../lib/prisma";

const TARGET_EMAILS = [
  "mirzasawrav2ff@gmail.com",
  "test@gsvdvd.com",
  "xokowet698@preparmy.com",
  "mirzasawrav2@gmail.co",
  "test@tese.com",
  "test@testr.com",
  "test@hjvf.com",
  "test@mail.com",
  "test@hlo.com",
  "masrifasultana98@gmail.com",
  "testamir@test.com",
  "waviv55408@brixozu.com",
  "kakomi8347@doreact.com",
  "test@gmail.com",
];

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(DRY_RUN ? "[DRY RUN] " : "", "Finding target accounts...");

  const users = await prisma.user.findMany({
    where: { email: { in: TARGET_EMAILS } },
    select: { id: true, email: true, tenantId: true, tenant: { select: { name: true } } },
  });

  if (users.length === 0) {
    console.log("No matching accounts found. Nothing to do.");
    return;
  }

  const tenantIds = [...new Set(users.map((u) => u.tenantId))];
  const userIds = users.map((u) => u.id);

  console.log(`\nFound ${users.length} users across ${tenantIds.length} tenants:`);
  users.forEach((u) => console.log(`  ${u.email} → ${u.tenant?.name} (${u.tenantId})`));

  if (DRY_RUN) {
    console.log("\n[DRY RUN] No changes made. Remove --dry-run to execute.");
    return;
  }

  console.log("\nStarting deletion (transactional)...");

  const contactIds = (
    await prisma.contact.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { id: true },
    })
  ).map((c) => c.id);

  await prisma.$transaction(
    async (tx) => {
      // 1. ActivityLog refs User (optional, no cascade) → delete before User
      const r1 = await tx.activityLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
      console.log(`  [1] activity_logs:          ${r1.count}`);

      // 2. ChurnFeedback refs User (optional, no cascade) → delete before User
      const r2 = await tx.churnFeedback.deleteMany({ where: { tenantId: { in: tenantIds } } });
      console.log(`  [2] churn_feedback:         ${r2.count}`);

      // 3. AdminActivity refs User (optional, no cascade) + Tenant (no cascade)
      const r3a = await tx.adminActivity.deleteMany({ where: { tenantId: { in: tenantIds } } });
      const r3b = await tx.adminActivity.deleteMany({ where: { adminId: { in: userIds } } });
      console.log(`  [3] admin_activities:       ${r3a.count + r3b.count}`);

      // 4. NewsletterSubscriber refs User (optional, no cascade)
      const r4 = await tx.newsletterSubscriber.deleteMany({ where: { userId: { in: userIds } } });
      console.log(`  [4] newsletter_subscribers: ${r4.count}`);

      // 5. DataDeletionRequest refs User (optional, no cascade)
      const r5 = await tx.dataDeletionRequest.deleteMany({ where: { userId: { in: userIds } } });
      console.log(`  [5] data_deletion_requests: ${r5.count}`);

      // 6. ExecutionLog refs Bot + User (no cascade) → delete before Bot and User
      const r6 = await tx.executionLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
      console.log(`  [6] execution_logs:         ${r6.count}`);

      // 7. UsageLog refs Tenant + User (no cascade) → delete before User and Tenant
      const r7 = await tx.usageLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
      console.log(`  [7] usage_logs:             ${r7.count}`);

      // 8. CrmConversation refs Bot + Contact (no cascade); cascades CrmMessage, InternalNote, WebChatSession→WebChatEvent
      const r8 = await tx.crmConversation.deleteMany({ where: { tenantId: { in: tenantIds } } });
      console.log(`  [8] crm_conversations:      ${r8.count} (+ cascaded messages/sessions)`);

      // 9. Lead refs Contact + Flow + FacebookPage (optional, no cascade)
      const r9 = await tx.lead.deleteMany({ where: { tenantId: { in: tenantIds } } });
      console.log(`  [9] leads:                  ${r9.count}`);

      // 10. ContactIdentity refs Contact (no cascade)
      const r10 =
        contactIds.length > 0
          ? await tx.contactIdentity.deleteMany({ where: { contactId: { in: contactIds } } })
          : { count: 0 };
      console.log(`  [10] contact_identities:    ${r10.count}`);

      // 11. Contact refs Tenant (no cascade); cascades OnboardingSession
      const r11 = await tx.contact.deleteMany({ where: { tenantId: { in: tenantIds } } });
      console.log(`  [11] contacts:              ${r11.count} (+ cascaded onboarding_sessions)`);

      // 12. Flow refs User.ownerId (optional, no cascade); cascades FlowNode, FlowSession, FlowAssignment, FlowChannelAssignment
      const r12 = await tx.flow.deleteMany({ where: { tenantId: { in: tenantIds } } });
      console.log(`  [12] flows:                 ${r12.count} (+ cascaded nodes/sessions)`);

      // 13. FacebookPage refs Bot (no cascade); cascades remaining OnboardingSession
      const r13 = await tx.facebookPage.deleteMany({ where: { tenantId: { in: tenantIds } } });
      console.log(`  [13] facebook_pages:        ${r13.count}`);

      // 14. WebChatSite refs Bot (no cascade); cascades WebChatSession, WebChatEvent
      const r14 = await tx.webChatSite.deleteMany({ where: { tenantId: { in: tenantIds } } });
      console.log(`  [14] webchat_sites:         ${r14.count}`);

      // 15. Bot refs Tenant (no cascade); cascades Channel→FlowChannelAssignment
      const r15 = await tx.bot.deleteMany({ where: { tenantId: { in: tenantIds } } });
      console.log(`  [15] bots:                  ${r15.count} (+ cascaded channels)`);

      // 16. User refs Tenant (no cascade); cascades Account, Session, UserToken, PasswordResetToken
      const r16 = await tx.user.deleteMany({ where: { tenantId: { in: tenantIds } } });
      console.log(`  [16] users:                 ${r16.count} (+ cascaded sessions/tokens)`);

      // 17. Tenant — cascades everything remaining (Subscription, TenantLeadNotificationSettings,
      //     TenantChannelStatus, OnboardingMilestoneEvent, WebhookSubscription→WebhookDeliveryLog,
      //     Revenue, TenantBranding, ApiKey, WebhookLog sets null)
      const r17 = await tx.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      console.log(`  [17] tenants:               ${r17.count} (+ cascaded subscriptions/settings)`);
    },
    { timeout: 60000 }
  );

  console.log("\nCleanup complete.");
}

main()
  .catch((e) => {
    console.error("Cleanup failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
