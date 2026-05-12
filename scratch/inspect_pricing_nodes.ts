import { prisma } from "../lib/prisma";
import "dotenv/config";

async function inspectPricingNodes() {
  const flowId = "cmoyq80kx000csfighds8roff";
  const nodes = await prisma.flowNode.findMany({
    where: { flowId },
    orderBy: { order: "asc" }
  });
  nodes.forEach(node => {
    console.log(`Order: ${node.order}, Type: ${node.type}, Content: ${JSON.stringify(node.content).substring(0, 100)}...`);
  });
}

inspectPricingNodes();
