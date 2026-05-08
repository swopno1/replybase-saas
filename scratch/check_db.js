
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();
  const res = await client.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
  console.log('Tables:', res.rows.map(r => r.tablename));
  await client.end();
}

main().catch(console.error);
