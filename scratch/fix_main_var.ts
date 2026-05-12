import { prisma } from "../lib/prisma";
import "dotenv/config";

async function fixMainFlowVariable() {
  const flowId = "cmox462p4000114mck073aic4";
  const node = await prisma.flowNode.findFirst({
    where: { flowId, order: 1 }
  });

  if (!node) return;

  const content: any = node.content;
  content.variableName = "msg_0"; // Match the output of Node 0

  await prisma.flowNode.update({
    where: { id: node.id },
    data: { content: content as any }
  });

  console.log("Main Flow Node 1 variable set to msg_0 for direct response matching.");
}

fixMainFlowVariable();
