import { prisma } from "../lib/prisma";

async function checkLogs() {
  try {
    const logs = await prisma.webhookLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    console.log(`\n📊 Recent Webhook Logs (${logs.length} found):\n`);

    if (logs.length === 0) {
      console.log("❌ No webhook logs found!");
      console.log("This means events were not logged to the database.");
    } else {
      logs.forEach((log, i) => {
        console.log(
          `${i + 1}. Type: ${log.type}, Source: ${log.source}, Event: ${log.event}`,
        );
        console.log(`   Created: ${log.createdAt}`);
        console.log(`   Data: ${JSON.stringify(log.data, null, 2)}`);
        console.log("");
      });
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error("Error querying webhook logs:", error);
    process.exit(1);
  }
}

checkLogs();
