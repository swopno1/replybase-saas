import "dotenv/config";
import { prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";
import { Prisma } from "@prisma/client";

async function main() {
  const tenantId = process.argv[2] || "cmox3h0uw000013nwaubo2wm8";
  console.log(`🚀 Injecting V6 flows for tenant: ${tenantId}`);

  const filePath = path.join(process.cwd(), "docs/ReplyBase_Flow_V6.json");
  const flowsData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  const user = await prisma.user.findFirst({
    where: { tenantId },
    select: { id: true }
  });

  if (!user) {
    console.error(`❌ No user found for tenant: ${tenantId}`);
    return;
  }

  for (const flowData of flowsData) {
    console.log(`📦 Processing flow: ${flowData.name}`);

    // Delete existing flow with same name to ensure clean update
    const existing = await prisma.flow.findFirst({
      where: { tenantId, name: flowData.name }
    });

    if (existing) {
      console.log(`  - Deleting existing flow: ${existing.id}`);
      await prisma.flow.delete({ where: { id: existing.id } });
    }

    const flow = await prisma.flow.create({
      data: {
        name: flowData.name,
        description: flowData.description,
        tenantId,
        ownerId: user.id,
        isActive: true,
        isGlobal: flowData.name.includes("Master Orchestrator"),
        nodes: {
          create: flowData.nodes.map((node: any) => ({
            type: node.type,
            order: node.order,
            content: node.content as Prisma.InputJsonValue
          }))
        }
      }
    });

    console.log(`  ✅ Created new flow: ${flow.id}`);
  }

  console.log("\n✨ All flows injected successfully!");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
