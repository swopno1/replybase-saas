import { prisma } from "../lib/prisma";

async function main() {
  const latestFail = await prisma.testHistory.findFirst({
    where: { type: "ai_diagnostic", status: "failed" },
    orderBy: { createdAt: "desc" },
  });

  if (!latestFail) {
    console.log("No failed AI diagnostics found.");
    return;
  }

  console.log("--- Latest AI Diagnostic Failure ---");
  console.log("Date:", latestFail.createdAt);
  console.log("Name:", latestFail.name);
  console.log("Error Output:", JSON.parse(latestFail.output || "{}"));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
