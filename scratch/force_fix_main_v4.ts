import { prisma } from "../lib/prisma";
import "dotenv/config";

async function forceFixMainV4() {
  const flowId = "cmox462p4000114mck073aic4";
  
  // Update Node 0
  const node0 = await prisma.flowNode.findFirst({ where: { flowId, order: 0 } });
  if (node0) {
    const content0: any = node0.content;
    content0.variableName = "user_intent";
    await prisma.flowNode.update({ where: { id: node0.id }, data: { content: content0 as any } });
  }

  // Update Node 1
  const node1 = await prisma.flowNode.findFirst({ where: { flowId, order: 1 } });
  if (node1) {
    const content1: any = node1.content;
    content1.variableName = "user_intent";
    content1.conditions = [
      { value: "price", operator: "contains", nextNodeOrder: 2 },
      { value: "intent_pricing", operator: "contains", nextNodeOrder: 2 },
      { value: "demo", operator: "contains", nextNodeOrder: 3 },
      { value: "intent_demo", operator: "contains", nextNodeOrder: 3 },
      { value: "book", operator: "contains", nextNodeOrder: 4 },
      { value: "intent_booking", operator: "contains", nextNodeOrder: 4 },
      { value: "trial", operator: "contains", nextNodeOrder: 6 },
      { value: "intent_checkout", operator: "contains", nextNodeOrder: 6 }
    ];
    await prisma.flowNode.update({ where: { id: node1.id }, data: { content: content1 as any } });
  }

  console.log("Main Flow Nodes 0 & 1 synchronized with explicit 'user_intent' variable.");
}

forceFixMainV4();
