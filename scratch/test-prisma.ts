import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const channel = await prisma.channel.findFirst({
    include: {
      flowAssignments: true
    }
  });

  console.log("Channel flowAssignments type:", typeof channel?.flowAssignments);
  console.log("Is array?", Array.isArray(channel?.flowAssignments));
  console.log("Value:", channel?.flowAssignments);
  
  await prisma.$disconnect();
}

main();
