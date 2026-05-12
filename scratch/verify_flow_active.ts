import { prisma } from "../lib/prisma";
import "dotenv/config";

async function verifyFlowActive() {
  const flowId = "cmox462p4000114mck073aic4";
  const flow = await prisma.flow.findUnique({
    where: { id: flowId }
  });
  console.log(JSON.stringify(flow, null, 2));
}

verifyFlowActive();
