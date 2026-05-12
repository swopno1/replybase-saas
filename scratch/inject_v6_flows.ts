import { prisma } from "../lib/prisma";
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

const TENANT_ID = "cmox3h0uw000013nwaubo2wm8";

const FLOW_DEFINITIONS = [
  {
    name: "ReplyBase Main Flow",
    description: "V6 Final - Master Orchestrator: Revenue Engine Hub. Entry point for all visitors.",
    templateFile: "V6_Master_Orchestrator.json",
    isActive: true,
    fallbackMessage: "Sorry, I didn't understand that."
  },
  {
    name: "Sub-Flow: Pricing & Lead Capture",
    description: "Lead-first pricing flow. Captures email immediately, then discovery.",
    templateFile: "V6_SubFlow_Pricing.json",
    isActive: true
  },
  {
    name: "Sub-Flow: Omnichannel Demo",
    description: "Identity stitching demo with lead capture and session tokens.",
    templateFile: "V6_SubFlow_Demo.json",
    isActive: true
  },
  {
    name: "Sub-Flow: Booking & Escalation",
    description: "Human booking and escalation with lead capture.",
    templateFile: "V6_SubFlow_Booking.json",
    isActive: true
  },
  {
    name: "Sub-Flow: Checkout",
    description: "Final conversion flow for trial/purchase with lead capture.",
    templateFile: "V6_SubFlow_Checkout.json",
    isActive: true
  }
];

async function injectFlows() {
  console.log("=== ReplyBase V6 Flow Injection ===");
  console.log(`Tenant: ${TENANT_ID}\n`);

  const flowIdMap: Record<string, string> = {};

  for (const def of FLOW_DEFINITIONS) {
    const templatePath = path.join(__dirname, "../docs/templates", def.templateFile);
    const templateContent = JSON.parse(fs.readFileSync(templatePath, "utf-8"));

    // Find or create the flow
    let flow = await prisma.flow.findFirst({
      where: { tenantId: TENANT_ID, name: def.name }
    });

    if (flow) {
      // Update existing flow metadata
      flow = await prisma.flow.update({
        where: { id: flow.id },
        data: {
          description: def.description,
          isActive: def.isActive,
          fallbackMessage: (def as any).fallbackMessage ?? flow.fallbackMessage
        }
      });

      // Delete existing nodes and re-create
      await prisma.flowNode.deleteMany({ where: { flowId: flow.id } });
      console.log(`♻️  Updated existing flow: "${def.name}" (${flow.id})`);
    } else {
      flow = await prisma.flow.create({
        data: {
          tenantId: TENANT_ID,
          name: def.name,
          description: def.description,
          isActive: def.isActive,
          fallbackMessage: (def as any).fallbackMessage ?? null
        }
      });
      console.log(`✅ Created new flow: "${def.name}" (${flow.id})`);
    }

    flowIdMap[def.name] = flow.id;

    // Create nodes
    for (let i = 0; i < templateContent.length; i++) {
      const nodeData = templateContent[i];
      await prisma.flowNode.create({
        data: {
          flowId: flow.id,
          type: nodeData.type,
          order: i,
          content: nodeData.content as any
        }
      });
    }
    console.log(`   → ${templateContent.length} nodes injected`);
  }

  // Phase 2: Wire call_flow actions with actual flow IDs
  console.log("\n🔗 Wiring sub-flow references with IDs...");

  const masterFlowId = flowIdMap["ReplyBase Main Flow"];
  const masterNodes = await prisma.flowNode.findMany({
    where: { flowId: masterFlowId },
    orderBy: { order: "asc" }
  });

  for (const node of masterNodes) {
    const content = node.content as any;
    if (content?.action === "call_flow" && content?.targetFlowName) {
      const targetId = flowIdMap[content.targetFlowName];
      if (targetId) {
        content.targetFlowId = targetId;
        await prisma.flowNode.update({
          where: { id: node.id },
          data: { content: content as any }
        });
        console.log(`   ✅ ${content.targetFlowName} → ${targetId}`);
      } else {
        console.log(`   ⚠️  No ID found for: ${content.targetFlowName}`);
      }
    }
  }

  // Phase 3: Clear stale sessions for this tenant
  // FlowSession doesn't have tenantId directly, so we filter by flowIds
  const tenantFlows = await prisma.flow.findMany({
    where: { tenantId: TENANT_ID },
    select: { id: true }
  });
  const tenantFlowIds = tenantFlows.map(f => f.id);

  const cleared = await prisma.flowSession.deleteMany({
    where: {
      flowId: { in: tenantFlowIds },
      isActive: true,
      updatedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } // older than 1h
    }
  });
  console.log(`\n🧹 Cleared ${cleared.count} stale sessions`);

  console.log("\n✅ All V6 flows injected and wired successfully!");
  console.log("\nFlow ID Map:");
  for (const [name, id] of Object.entries(flowIdMap)) {
    console.log(`  ${name}: ${id}`);
  }
}

injectFlows()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
