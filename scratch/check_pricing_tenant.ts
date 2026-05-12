import { prisma } from "../lib/prisma";
import "dotenv/config";

async function checkPricingFlowTenant() {
  const flowId = "cmoyq80kx000csfighds8roff";
  const flow = await prisma.flow.findUnique({
    where: { id: flowId },
    select: { id: true, name: true, tenantId: true }
  });
  console.log(JSON.stringify(flow, null, 2));
}

checkPricingFlowTenant();
