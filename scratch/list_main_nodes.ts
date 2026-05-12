import { prisma } from "../lib/prisma";
import "dotenv/config";

async function listMainNodes() {
  const flowId = "cmox462p4000114mck073aic4";
  const nodes = await prisma.flowNode.findMany({
    where: { flowId },
    orderBy: { order: "asc" }
  });
  console.log(JSON.stringify(nodes, null, 2));
}

listMainNodes();
