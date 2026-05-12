import { prisma } from "../lib/prisma";
import "dotenv/config";

async function inspectDemoNode1() {
  const flow = await prisma.flow.findFirst({
    where: { name: "Sub-Flow: Omnichannel Demo" }
  });

  if (!flow) return console.log("Flow not found");

  const node = await prisma.flowNode.findFirst({
    where: { flowId: flow.id, order: 1 }
  });

  console.log(JSON.stringify(node?.content, null, 2));
}

inspectDemoNode1();
