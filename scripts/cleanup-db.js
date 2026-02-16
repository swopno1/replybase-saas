#!/usr/bin/env node

/**
 * Database Cleanup Script
 * Removes orphaned data and ensures referential integrity
 * Run with: npm run db:cleanup
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function cleanupOrphanedData() {
  console.log("🧹 Starting database cleanup...\n");

  try {
    // 1. Delete conversations with non-existent pages
    console.log("Checking for orphaned conversations...");
    const orphanedConversations = await prisma.crmConversation.findMany({
      where: {
        page: null,
      },
    });
    if (orphanedConversations.length > 0) {
      await prisma.crmConversation.deleteMany({
        where: {
          page: null,
        },
      });
      console.log(
        `✓ Deleted ${orphanedConversations.length} orphaned conversations\n`,
      );
    } else {
      console.log("✓ No orphaned conversations found\n");
    }

    // 2. Delete flow assignments with non-existent pages
    console.log("Checking for orphaned flow assignments...");
    const orphanedAssignments = await prisma.flowAssignment.findMany({
      where: {
        page: null,
      },
    });
    if (orphanedAssignments.length > 0) {
      await prisma.flowAssignment.deleteMany({
        where: {
          page: null,
        },
      });
      console.log(
        `✓ Deleted ${orphanedAssignments.length} orphaned flow assignments\n`,
      );
    } else {
      console.log("✓ No orphaned flow assignments found\n");
    }

    // 3. Delete leads with non-existent pages
    console.log("Checking for orphaned leads...");
    const orphanedLeads = await prisma.lead.findMany({
      where: {
        page: null,
      },
    });
    if (orphanedLeads.length > 0) {
      await prisma.lead.deleteMany({
        where: {
          page: null,
        },
      });
      console.log(`✓ Deleted ${orphanedLeads.length} orphaned leads\n`);
    } else {
      console.log("✓ No orphaned leads found\n");
    }

    // 4. Delete flow sessions with non-existent pages
    console.log("Checking for orphaned flow sessions...");
    const orphanedSessions = await prisma.flowSession.findMany({
      where: {
        page: null,
      },
    });
    if (orphanedSessions.length > 0) {
      await prisma.flowSession.deleteMany({
        where: {
          page: null,
        },
      });
      console.log(
        `✓ Deleted ${orphanedSessions.length} orphaned flow sessions\n`,
      );
    } else {
      console.log("✓ No orphaned flow sessions found\n");
    }

    // 5. Delete execution logs with non-existent users
    console.log("Checking for orphaned execution logs...");
    const orphanedLogs = await prisma.executionLog.findMany({
      where: {
        user: null,
      },
    });
    if (orphanedLogs.length > 0) {
      await prisma.executionLog.deleteMany({
        where: {
          user: null,
        },
      });
      console.log(`✓ Deleted ${orphanedLogs.length} orphaned execution logs\n`);
    } else {
      console.log("✓ No orphaned execution logs found\n");
    }

    // 6. Delete internal notes with non-existent conversations
    console.log("Checking for orphaned internal notes...");
    const orphanedNotes = await prisma.internalNote.findMany({
      where: {
        conversation: null,
      },
    });
    if (orphanedNotes.length > 0) {
      await prisma.internalNote.deleteMany({
        where: {
          conversation: null,
        },
      });
      console.log(
        `✓ Deleted ${orphanedNotes.length} orphaned internal notes\n`,
      );
    } else {
      console.log("✓ No orphaned internal notes found\n");
    }

    // 7. Get database statistics
    console.log("📊 Current database statistics:\n");
    const stats = await prisma.$queryRaw`
      SELECT 
        (SELECT COUNT(*) FROM tenants) as tenants,
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM facebook_pages) as facebook_pages,
        (SELECT COUNT(*) FROM "CrmConversation") as conversations,
        (SELECT COUNT(*) FROM leads) as leads,
        (SELECT COUNT(*) FROM flows) as flows,
        (SELECT COUNT(*) FROM flow_assignments) as flow_assignments,
        (SELECT COUNT(*) FROM "FlowSession") as flow_sessions
    `;

    Object.entries(stats[0] || {}).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    console.log();

    console.log("✅ Database cleanup completed successfully!\n");
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupOrphanedData();
