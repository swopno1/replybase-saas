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

  console.log(JSON.stringify(nodes, null, 2));
}

inspectSubFlow();
