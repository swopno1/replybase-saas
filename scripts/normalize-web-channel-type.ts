import { prisma } from "../lib/prisma";

async function main() {
  const result = await prisma.channel.updateMany({
    where: { type: "Web" },
    data: { type: "web" },
  });

  console.log(
    `[normalize-web-channel-type] Updated ${result.count} channel rows`,
  );
}

main()
  .catch((error) => {
    console.error("[normalize-web-channel-type] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
