#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Database URL Update Script
 *
 * This script updates any references to bot.investorhints.com to bot.replybase.co.uk
 * in the database. It searches through common tables that may contain URLs.
 *
 * Usage: node scripts/update-bot-urls.js
 */

const { PrismaClient } = require("@prisma/client");

const OLD_DOMAIN = "bot.investorhints.com";
const NEW_DOMAIN = "bot.replybase.co.uk";

const prisma = new PrismaClient();

async function updateBotUrls() {
  console.log("🔍 Searching for URLs containing:", OLD_DOMAIN);
  console.log("📝 Will replace with:", NEW_DOMAIN);
  console.log("");

  let totalUpdates = 0;

  try {
    // Check Typebot table for any URLs
    console.log("Checking Typebot table...");
    const typebots = await prisma.typebot.findMany({
      where: {
        OR: [
          { publicId: { contains: OLD_DOMAIN } },
          { name: { contains: OLD_DOMAIN } },
        ],
      },
    });

    if (typebots.length > 0) {
      console.log(`  Found ${typebots.length} Typebot records with old domain`);
      for (const bot of typebots) {
        const updates = {};
        if (bot.publicId?.includes(OLD_DOMAIN)) {
          updates.publicId = bot.publicId.replace(
            new RegExp(OLD_DOMAIN, "g"),
            NEW_DOMAIN,
          );
        }
        if (bot.name?.includes(OLD_DOMAIN)) {
          updates.name = bot.name.replace(
            new RegExp(OLD_DOMAIN, "g"),
            NEW_DOMAIN,
          );
        }

        if (Object.keys(updates).length > 0) {
          await prisma.typebot.update({
            where: { id: bot.id },
            data: updates,
          });
          console.log(`  ✓ Updated Typebot: ${bot.name || bot.id}`);
          totalUpdates++;
        }
      }
    } else {
      console.log("  No Typebot records found with old domain");
    }

    // Check Flow table
    console.log("\nChecking Flow table...");
    const flows = await prisma.flow.findMany();

    let flowUpdates = 0;
    for (const flow of flows) {
      // Check if nodes contain old domain (nodes is JSON)
      if (flow.nodes && typeof flow.nodes === "object") {
        const nodesStr = JSON.stringify(flow.nodes);
        if (nodesStr.includes(OLD_DOMAIN)) {
          const updatedNodes = JSON.parse(
            nodesStr.replace(new RegExp(OLD_DOMAIN, "g"), NEW_DOMAIN),
          );

          await prisma.flow.update({
            where: { id: flow.id },
            data: { nodes: updatedNodes },
          });

          console.log(`  ✓ Updated Flow: ${flow.name || flow.id}`);
          flowUpdates++;
          totalUpdates++;
        }
      }
    }

    if (flowUpdates === 0) {
      console.log("  No Flow records found with old domain");
    }

    // Check FlowNode table
    console.log("\nChecking FlowNode table...");
    const flowNodes = await prisma.flowNode.findMany();

    let nodeUpdates = 0;
    for (const node of flowNodes) {
      // Check if data contains old domain (data is JSON)
      if (node.data && typeof node.data === "object") {
        const dataStr = JSON.stringify(node.data);
        if (dataStr.includes(OLD_DOMAIN)) {
          const updatedData = JSON.parse(
            dataStr.replace(new RegExp(OLD_DOMAIN, "g"), NEW_DOMAIN),
          );

          await prisma.flowNode.update({
            where: { id: node.id },
            data: { data: updatedData },
          });

          console.log(`  ✓ Updated FlowNode: ${node.id}`);
          nodeUpdates++;
          totalUpdates++;
        }
      }
    }

    if (nodeUpdates === 0) {
      console.log("  No FlowNode records found with old domain");
    }

    // Check CrmConversation table
    console.log("\nChecking CrmConversation table...");
    const conversations = await prisma.crmConversation.findMany();

    let conversationUpdates = 0;
    for (const conv of conversations) {
      // Check if metadata contains old domain (metadata is JSON)
      if (conv.metadata && typeof conv.metadata === "object") {
        const metadataStr = JSON.stringify(conv.metadata);
        if (metadataStr.includes(OLD_DOMAIN)) {
          const updatedMetadata = JSON.parse(
            metadataStr.replace(new RegExp(OLD_DOMAIN, "g"), NEW_DOMAIN),
          );

          await prisma.crmConversation.update({
            where: { id: conv.id },
            data: { metadata: updatedMetadata },
          });

          console.log(`  ✓ Updated Conversation: ${conv.id}`);
          conversationUpdates++;
          totalUpdates++;
        }
      }
    }

    if (conversationUpdates === 0) {
      console.log("  No Conversation records found with old domain");
    }

    console.log("");
    console.log("═══════════════════════════════════════");
    console.log(`✅ Update complete! Total updates: ${totalUpdates}`);
    console.log("═══════════════════════════════════════");
  } catch (error) {
    console.error("❌ Error updating URLs:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateBotUrls()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
