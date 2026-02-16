import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Ensure environment is loaded
import("dotenv").then((dotenv) => {
  if (dotenv.default) {
    dotenv.default.config();
  }
});

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function cleanupDatabase() {
  try {
    console.log("🧹 Starting database cleanup...\n");

    // Step 1: Find and remove user vivescriptsolutions@gmail.com
    console.log("📧 Removing resources for vivescriptsolutions@gmail.com...");
    const targetUser = await prisma.user.findUnique({
      where: { email: "vivescriptsolutions@gmail.com" },
      include: {
        flows: true,
        executionLogs: true,
        internalNotes: true,
        usageLogs: true,
        assignedConversations: true,
        sessions: true,
        accounts: true,
      },
    });

    if (targetUser) {
      console.log(`Found user with:`);
      console.log(`  - Flows: ${targetUser.flows.length}`);
      console.log(`  - Execution Logs: ${targetUser.executionLogs.length}`);
      console.log(`  - Internal Notes: ${targetUser.internalNotes.length}`);
      console.log(`  - Usage Logs: ${targetUser.usageLogs.length}`);
      console.log(
        `  - Assigned Conversations: ${targetUser.assignedConversations.length}`,
      );
      console.log(`  - Sessions: ${targetUser.sessions.length}`);
      console.log(`  - Accounts: ${targetUser.accounts.length}\n`);

      // Delete the user - cascading deletes will handle related records
      const deletedUser = await prisma.user.delete({
        where: { id: targetUser.id },
      });
      console.log(`✅ Deleted user: ${deletedUser.email}\n`);
    } else {
      console.log("⚠️  User vivescriptsolutions@gmail.com not found\n");
    }

    // Step 2: Database verification
    console.log("📊 Database verification:\n");

    // Count records by type
    const userCount = await prisma.user.count();
    const tenantCount = await prisma.tenant.count();
    const botCount = await prisma.bot.count();
    const conversationCount = await prisma.crmConversation.count();
    const leadCount = await prisma.lead.count();
    const flowCount = await prisma.flow.count();
    const executionLogCount = await prisma.executionLog.count();
    const usageLogCount = await prisma.usageLog.count();

    console.log(`Total records in database:`);
    console.log(`  - Users: ${userCount}`);
    console.log(`  - Tenants: ${tenantCount}`);
    console.log(`  - Bots: ${botCount}`);
    console.log(`  - Conversations: ${conversationCount}`);
    console.log(`  - Leads: ${leadCount}`);
    console.log(`  - Flows: ${flowCount}`);
    console.log(`  - Execution Logs: ${executionLogCount}`);
    console.log(`  - Usage Logs: ${usageLogCount}\n`);

    // Step 3: Summary
    console.log("✨ Database cleanup completed successfully!");
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

cleanupDatabase();
