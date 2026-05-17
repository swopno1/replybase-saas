import "dotenv/config";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { Prisma } from "@prisma/client";

const FLOWS_TO_SEED = [
  // 1. Master Orchestrators
  {
    fileName: "ReplyBase_website_master.json",
    flowName: "ReplyBase_website_master",
    description: "Website Master Orchestrator for qualified lead capture, value suggestion, and ROI-driven conversion."
  },
  {
    fileName: "ReplyBase_whatsapp_master.json",
    flowName: "ReplyBase_whatsapp_master",
    description: "WhatsApp Master Orchestrator leveraging high-open rates, profile sync, and CRM lead capture."
  },
  {
    fileName: "ReplyBase_facebook_master.json",
    flowName: "ReplyBase_facebook_master",
    description: "Facebook Messenger Master Orchestrator optimizing quick-replies, CRM synchronization, and ad-to-chat onboarding."
  },
  {
    fileName: "ReplyBase_telegram_master.json",
    flowName: "ReplyBase_telegram_master",
    description: "Telegram Master Orchestrator mapping customer profiles, CRM lead tagging, and automated strategy routing."
  },
  // 2. Subflows
  {
    fileName: "ReplyBase_SubFlow_Pricing.json",
    flowName: "ReplyBase_SubFlow_Pricing",
    description: "Sub-Flow: Pricing & ROI breakdowns with Starter, Pro, and Enterprise strategy branching."
  },
  {
    fileName: "ReplyBase_SubFlow_Demo.json",
    flowName: "ReplyBase_SubFlow_Demo",
    description: "Sub-Flow: Omnichannel session switching demonstration (continuing conversations seamlessly on WhatsApp/Telegram)."
  },
  {
    fileName: "ReplyBase_SubFlow_Booking.json",
    flowName: "ReplyBase_SubFlow_Booking",
    description: "Sub-Flow: Enterprise human expert walkthrough and scheduling via Calendly."
  },
  {
    fileName: "ReplyBase_SubFlow_Checkout.json",
    flowName: "ReplyBase_SubFlow_Checkout",
    description: "Sub-Flow: Trial activation, checkout routing, and customized plan selection."
  }
];

async function main() {
  const adminEmail = "replybase1@gmail.com";
  console.log(`🚀 Starting ReplyBase flows seeding for: ${adminEmail}`);

  try {
    const user = await prisma.user.findFirst({
      where: { email: adminEmail },
      select: { id: true, tenantId: true, email: true },
    });

    if (!user) {
      console.error(`❌ User not found with email: ${adminEmail}`);
      process.exit(1);
    }

    console.log(`🔗 Target user resolved. User ID: ${user.id}, Tenant ID: ${user.tenantId}`);

    for (const flowConfig of FLOWS_TO_SEED) {
      const filePath = path.resolve(process.cwd(), "docs/templates", flowConfig.fileName);
      
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Template file not found: ${filePath}`);
        continue;
      }

      const fileContent = fs.readFileSync(filePath, "utf-8");
      const nodes: any[] = JSON.parse(fileContent);

      const flowName = flowConfig.flowName;
      const flowDescription = flowConfig.description;

      // Idempotency: check if the flow already exists for this tenant
      const existingFlow = await prisma.flow.findFirst({
        where: { tenantId: user.tenantId, name: flowName }
      });

      if (existingFlow) {
        // Delete all old nodes to prevent duplicates/orphans
        await prisma.flowNode.deleteMany({
          where: { flowId: existingFlow.id }
        });

        // Update the flow and create the fresh node set
        await prisma.flow.update({
          where: { id: existingFlow.id },
          data: {
            description: flowDescription,
            isActive: true,
            nodes: {
              create: nodes.map((n, idx) => ({
                type: n.type,
                content: n.content as Prisma.InputJsonValue,
                order: n.order ?? idx
              }))
            }
          }
        });
        console.log(`🔄 Flow updated successfully: ${flowName} (${existingFlow.id})`);
      } else {
        // Create a completely new flow assignment
        const newFlow = await prisma.flow.create({
          data: {
            name: flowName,
            description: flowDescription,
            tenantId: user.tenantId,
            ownerId: user.id,
            isActive: true,
            nodes: {
              create: nodes.map((n, idx) => ({
                type: n.type,
                content: n.content as Prisma.InputJsonValue,
                order: n.order ?? idx
              }))
            }
          }
        });
        console.log(`✅ Flow created successfully: ${flowName} (${newFlow.id})`);
      }
    }

    console.log("🏁 All ReplyBase Master and SubFlows seeded successfully!");

  } catch (error) {
    console.error("❌ Seeding failed with error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
