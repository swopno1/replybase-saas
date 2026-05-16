import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: ["test.vivescriptsolutions@gmail.com", "amirhossain.limon@gmail.com"]
      }
    },
    select: {
      email: true,
      tenantId: true
    }
  });

  console.log("Users Found:", JSON.stringify(users, null, 2));

  for (const user of users) {
    const channels = await prisma.channel.findMany({
      where: {
        tenantId: user.tenantId,
        type: "whatsapp"
      }
    });
    console.log(`Channels for ${user.email} (${user.tenantId}):`, JSON.stringify(channels, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
