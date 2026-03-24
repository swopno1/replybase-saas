#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Database Cleanup Script
 * Removes orphaned bot/webchat references and reports current record counts.
 * Run with: npm run db:cleanup
 */

require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

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

async function cleanupOrphanedData() {
  console.log("Starting database cleanup...\n");

  try {
    const bots = await prisma.bot.findMany({ select: { id: true } });
    const channels = await prisma.channel.findMany({ select: { id: true } });
    const webChatSites = await prisma.webChatSite.findMany({
      select: { id: true, channelId: true },
    });

    const validBotIds = new Set(bots.map((bot) => bot.id));
    const validChannelIds = new Set(channels.map((channel) => channel.id));
    const validSiteIds = new Set(webChatSites.map((site) => site.id));

    console.log("Checking for Facebook pages linked to deleted bots...");
    const pagesWithMissingBots = await prisma.facebookPage.findMany({
      where: { botId: { not: null } },
      select: { id: true, botId: true },
    });
    const pageIdsToDetach = pagesWithMissingBots
      .filter((page) => page.botId && !validBotIds.has(page.botId))
      .map((page) => page.id);

    if (pageIdsToDetach.length > 0) {
      await prisma.facebookPage.updateMany({
        where: { id: { in: pageIdsToDetach } },
        data: { botId: null },
      });
      console.log(`Fixed ${pageIdsToDetach.length} Facebook page bot links\n`);
    } else {
      console.log("No orphaned Facebook page bot links found\n");
    }

    console.log("Checking for conversations linked to deleted bots...");
    const conversationsWithMissingBots = await prisma.crmConversation.findMany({
      where: { botId: { not: null } },
      select: { id: true, botId: true },
    });
    const conversationIdsToDetach = conversationsWithMissingBots
      .filter(
        (conversation) =>
          conversation.botId && !validBotIds.has(conversation.botId),
      )
      .map((conversation) => conversation.id);

    if (conversationIdsToDetach.length > 0) {
      await prisma.crmConversation.updateMany({
        where: { id: { in: conversationIdsToDetach } },
        data: { botId: null },
      });
      console.log(
        `Fixed ${conversationIdsToDetach.length} conversation bot links\n`,
      );
    } else {
      console.log("No orphaned conversation bot links found\n");
    }

    console.log(
      "Checking for usage logs linked to missing bots or channels...",
    );
    const usageLogs = await prisma.usageLog.findMany({
      where: {
        OR: [{ botId: { not: null } }, { channelId: { not: null } }],
      },
      select: { id: true, botId: true, channelId: true },
    });
    const usageLogIdsToReset = usageLogs
      .filter(
        (log) =>
          (log.botId && !validBotIds.has(log.botId)) ||
          (log.channelId && !validChannelIds.has(log.channelId)),
      )
      .map((log) => log.id);

    if (usageLogIdsToReset.length > 0) {
      await prisma.usageLog.updateMany({
        where: { id: { in: usageLogIdsToReset } },
        data: { botId: null, channelId: null },
      });
      console.log(`Fixed ${usageLogIdsToReset.length} usage log links\n`);
    } else {
      console.log("No orphaned usage log links found\n");
    }

    console.log("Checking for webchat sites linked to missing channels...");
    const siteIdsToDetachFromChannel = webChatSites
      .filter((site) => site.channelId && !validChannelIds.has(site.channelId))
      .map((site) => site.id);

    if (siteIdsToDetachFromChannel.length > 0) {
      await prisma.webChatSite.updateMany({
        where: { id: { in: siteIdsToDetachFromChannel } },
        data: { channelId: null },
      });
      console.log(
        `Fixed ${siteIdsToDetachFromChannel.length} webchat site channel links\n`,
      );
    } else {
      console.log("No orphaned webchat site channel links found\n");
    }

    console.log(
      "Checking for webchat flow sessions linked to missing sites...",
    );
    const webFlowSessions = await prisma.flowSession.findMany({
      where: {
        pageId: {
          startsWith: "web:",
        },
      },
      select: { id: true, pageId: true },
    });
    const flowSessionIdsToDelete = webFlowSessions
      .filter((session) => {
        const siteId = session.pageId.slice(4);
        return !validSiteIds.has(siteId);
      })
      .map((session) => session.id);

    if (flowSessionIdsToDelete.length > 0) {
      await prisma.flowSession.deleteMany({
        where: { id: { in: flowSessionIdsToDelete } },
      });
      console.log(
        `Deleted ${flowSessionIdsToDelete.length} orphaned webchat flow sessions\n`,
      );
    } else {
      console.log("No orphaned webchat flow sessions found\n");
    }

    console.log("Current database statistics:\n");
    const [
      botCount,
      channelCount,
      webChatSiteCount,
      conversationCount,
      usageLogCount,
      executionLogCount,
      flowSessionCount,
    ] = await Promise.all([
      prisma.bot.count(),
      prisma.channel.count(),
      prisma.webChatSite.count(),
      prisma.crmConversation.count(),
      prisma.usageLog.count(),
      prisma.executionLog.count(),
      prisma.flowSession.count(),
    ]);

    console.log(`  bots: ${botCount}`);
    console.log(`  channels: ${channelCount}`);
    console.log(`  webchat_sites: ${webChatSiteCount}`);
    console.log(`  conversations: ${conversationCount}`);
    console.log(`  usage_logs: ${usageLogCount}`);
    console.log(`  execution_logs: ${executionLogCount}`);
    console.log(`  flow_sessions: ${flowSessionCount}`);
    console.log();

    console.log("Database cleanup completed successfully.\n");
  } catch (error) {
    console.error("Database cleanup failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

cleanupOrphanedData();
