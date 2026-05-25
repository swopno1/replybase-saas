import { prisma } from "../lib/prisma";

async function main() {
  const flow = await prisma.flow.findFirst({
    where: { name: "ReplyBase_SubFlow_Pricing" },
    include: { nodes: { orderBy: { order: "asc" } } }
  });

  if (!flow) {
    console.error("❌ Pricing flow not found");
    process.exit(1);
  }

  const pricingNode = flow.nodes.find(n => n.order === 4);
  if (!pricingNode) {
    console.error("❌ Pricing node (order 4) not found");
    process.exit(1);
  }

  console.log("✅ Pricing Flow found:", flow.name);
  console.log("✅ Pricing Node type:", pricingNode.type);
  console.log("✅ Pricing Node content:", JSON.stringify(pricingNode.content, null, 2));

  if (pricingNode.type === "input") {
    console.log("🚀 SUCCESS: Pricing node is now an 'input' type and will wait for user response.");
  } else {
    console.error("❌ FAILURE: Pricing node is still type:", pricingNode.type);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
