const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgres://postgres:2b1HcgrA4TZHQ7L8MPsCwUAM9QbFafetMu0agPoAk4onrILLZb1kKjVeVyKaAHFL@104.248.160.102:5432/replybase_saas"
  });

  try {
    await client.connect();
    // Corrected table name: test_history
    const res = await client.query(`
      SELECT * FROM test_history 
      WHERE type = 'ai_diagnostic' AND status = 'failed' 
      ORDER BY "createdAt" DESC 
      LIMIT 1
    `);

    if (res.rows.length === 0) {
      console.log("No failed AI diagnostics found in DB.");
      return;
    }

    const latestFail = res.rows[0];
    console.log("--- Latest AI Diagnostic Failure ---");
    console.log("Date:", latestFail.createdAt);
    console.log("Name:", latestFail.name);
    console.log("Error Output:", latestFail.output);
  } catch (err) {
    console.error("Query error", err);
  } finally {
    await client.end();
  }
}

main();
