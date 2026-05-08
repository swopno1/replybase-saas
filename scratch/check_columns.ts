import { prisma } from "./lib/prisma";

async function main() {
  const result = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'channels';
  `;
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
