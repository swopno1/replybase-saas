import { prisma } from "../lib/prisma";
import "dotenv/config";

async function restoreFullConditions() {
  const flowId = "cmox462p4000114mck073aic4";
  const node = await prisma.flowNode.findFirst({
    where: { flowId, order: 1 }
  });

  if (!node) return;

  const content = {
    variableName: "msg_0",
    conditions: [
      { value: "price", operator: "contains", nextNodeOrder: 2 },
      { value: "cost", operator: "contains", nextNodeOrder: 2 },
      { value: "intent_pricing", operator: "contains", nextNodeOrder: 2 },
      { value: "demo", operator: "contains", nextNodeOrder: 3 },
      { value: "intent_demo", operator: "contains", nextNodeOrder: 3 },
      { value: "book", operator: "contains", nextNodeOrder: 4 },
      { value: "intent_booking", operator: "contains", nextNodeOrder: 4 },
      { value: "trial", operator: "contains", nextNodeOrder: 6 },
      { value: "start", operator: "contains", nextNodeOrder: 6 },
      { value: "intent_checkout", operator: "contains", nextNodeOrder: 6 }
    ],
    nextNodeOrder: 5
  };

  await prisma.flowNode.update({
    where: { id: node.id },
    data: { content: content as any }
  });

  console.log("Main Flow Node 1 conditions restored with msg_0 mapping.");
}

restoreFullConditions();
