import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        tenantId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const deletionResult = await prisma.$transaction(
      async (tx) => {
        const usersInTenant = await tx.user.count({
          where: { tenantId: user.tenantId },
        });

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

        await tx.user.delete({ where: { id: user.id } });

        if (usersInTenant > 1) {
          return { deletedScope: "user" as const };
        }

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

        await tx.tenant.delete({ where: { id: user.tenantId } });

        return { deletedScope: "tenant" as const };
      },
      {
        maxWait: 15000,
        timeout: 30000,
      }
    );

    return NextResponse.json({
      success: true,
      deletedScope: deletionResult.deletedScope,
      redirectTo: "/auth/login?accountDeleted=1",
    });
  } catch (error: unknown) {
    console.error("[Account Deletion] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
