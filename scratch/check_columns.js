const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgres://postgres:2b1HcgrA4TZHQ7L8MPsCwUAM9QbFafetMu0agPoAk4onrILLZb1kKjVeVyKaAHFL@104.248.160.102:5432/replybase_wip_v1"
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'channels';
  `);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
