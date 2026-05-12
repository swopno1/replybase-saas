import { prisma } from "../lib/prisma";
import "dotenv/config";

async function testOrder() {
  const flowId = "cmox462p4000114mck073aic4";
  
  // Update Node 1 to be a message
  const node = await prisma.flowNode.findFirst({
    where: { flowId, order: 1 }
  });

  if (!node) return;

  await prisma.flowNode.update({
    where: { id: node.id },
    data: {
      type: "message",
      content: { text: "I REACHED NODE 1" } as any
    }
  });

  console.log("Main Flow Node 1 converted to message for reachability test.");
}

testOrder();
