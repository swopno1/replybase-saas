import { prisma } from "../lib/prisma";
import "dotenv/config";

async function forceFixMainV3() {
  const flowId = "cmox462p4000114mck073aic4";
  const node = await prisma.flowNode.findFirst({
    where: { flowId, order: 1 }
  });

  if (!node) return;

  const content = {
    variableName: "msg_0",
    conditions: [
      { value: "INTENT_PRICING", operator: "equals", nextNodeOrder: 2 },
      { value: "INTENT_DEMO", operator: "equals", nextNodeOrder: 3 },
      { value: "INTENT_BOOKING", operator: "equals", nextNodeOrder: 4 },
      { value: "INTENT_CHECKOUT", operator: "equals", nextNodeOrder: 6 },
      { value: "price", operator: "contains", nextNodeOrder: 2 },
      { value: "cost", operator: "contains", nextNodeOrder: 2 },
      { value: "demo", operator: "contains", nextNodeOrder: 3 },
      { value: "book", operator: "contains", nextNodeOrder: 4 },
      { value: "trial", operator: "contains", nextNodeOrder: 6 }
    ],
    nextNodeOrder: 5
  };

  await prisma.flowNode.update({
    where: { id: node.id },
    data: { content: content as any }
  });

  console.log("Main Flow Node 1 condition set to direct payload matching.");
}

forceFixMainV3();
