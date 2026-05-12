import { prisma } from "../lib/prisma";
import "dotenv/config";

async function checkPricingFlowActive() {
  const flowId = "cmoyq80kx000csfighds8roff";
  const flow = await prisma.flow.findUnique({
    where: { id: flowId },
    select: { id: true, name: true, isActive: true }
  });
  console.log(JSON.stringify(flow, null, 2));
}

checkPricingFlowActive();
