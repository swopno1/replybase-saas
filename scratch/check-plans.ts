import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const plans = await prisma.plan.findMany();
  console.log(JSON.stringify(plans, null, 2));
  await prisma.$disconnect();
}

main();
