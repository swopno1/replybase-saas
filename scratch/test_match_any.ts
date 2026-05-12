import { prisma } from "../lib/prisma";
import "dotenv/config";

async function testMatchAny() {
  const flowId = "cmox462p4000114mck073aic4";
  const node = await prisma.flowNode.findFirst({
    where: { flowId, order: 1 }
  });

  if (!node) return;

  const content = {
    variableName: "msg_0",
    conditions: [
      { value: "", operator: "contains", nextNodeOrder: 2 } // Should match anything
    ],
    nextNodeOrder: 5
  };

  await prisma.flowNode.update({
    where: { id: node.id },
    data: { content: content as any }
  });

  console.log("Main Flow Node 1 set to match ANY input to test routing.");
}

testMatchAny();
