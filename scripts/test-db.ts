import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.plan.count();
  console.log(`Plans count: ${count}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
