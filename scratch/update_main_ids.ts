import { prisma } from "../lib/prisma";
import "dotenv/config";

async function updateMainFlowWithIDs() {
  const flowId = "cmox462p4000114mck073aic4";
  
  const nodes = await prisma.flowNode.findMany({
    where: { flowId }
  });

  for (const node of nodes) {
    const content: any = node.content;
    if (node.type === "action" && content.action === "call_flow") {
      if (content.targetFlowName === "Sub-Flow: Pricing & Lead Capture") {
        content.targetFlowId = "cmoyq80kx000csfighds8roff";
      } else if (content.targetFlowName === "Sub-Flow: Omnichannel Demo") {
        content.targetFlowId = "cmoyq9vhx000msfigwcxz4b3g";
      } else if (content.targetFlowName === "Sub-Flow: Booking & Escalation") {
        content.targetFlowId = "cmoyqb5kc000qsfigve3nue6h";
      } else if (content.targetFlowName === "Sub-Flow: Checkout") {
        content.targetFlowId = "cmoyqc0jj000wsfig2dnzh7uk";
      }
      
      await prisma.flowNode.update({
        where: { id: node.id },
        data: { content: content as any }
      });
    }
  }

  console.log("Main Flow updated with hardcoded Flow IDs for maximum reliability.");
}

updateMainFlowWithIDs();
