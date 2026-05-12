import { prisma } from "../lib/prisma";
import "dotenv/config";

async function forceFixMainV5() {
  const flowId = "cmox462p4000114mck073aic4";
  const node = await prisma.flowNode.findFirst({
    where: { flowId, order: 1 }
  });

  if (!node) return;

  const content = {
    variableName: "contact_name",
    conditions: [
      { value: "Final Test User", operator: "equals", nextNodeOrder: 2 }
    ],
    nextNodeOrder: 5
  };

  await prisma.flowNode.update({
    where: { id: node.id },
    data: { content: content as any }
  });

  console.log("Main Flow Node 1 set to match contact_name for absolute testing.");
}

forceFixMainV5();
