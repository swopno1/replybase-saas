import { prisma } from "../lib/prisma";
import "dotenv/config";

async function inspectSubFlow() {
  const flow = await prisma.flow.findFirst({
    where: { name: "Sub-Flow: Pricing & Lead Capture" }
  });

  if (!flow) return console.log("Flow not found");

  const nodes = await prisma.flowNode.findMany({
    where: { flowId: flow.id },
    orderBy: { order: "asc" }
  });

  nodes.forEach(node => {
    console.log(`Order: ${node.order}, Type: ${node.type}, Content: ${JSON.stringify(node.content).substring(0, 100)}...`);
  });
}

inspectSubFlow();
