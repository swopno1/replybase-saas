import { prisma } from "../lib/prisma";
import "dotenv/config";

async function inspectMainNode1() {
  const flowId = "cmox462p4000114mck073aic4";
  
  const node = await prisma.flowNode.findFirst({
    where: { flowId, order: 1 }
  });

  console.log(JSON.stringify(node?.content, null, 2));
}

inspectMainNode1();
