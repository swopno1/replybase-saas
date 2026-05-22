import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const count = await prisma.plan.count();
  console.log(`Plans count: ${count}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
