import "dotenv/config";
import { prisma } from "../lib/prisma";

async function checkRecentFacebookAccounts() {
  console.log("Checking recent Facebook accounts...");

  try {
    const users = await prisma.user.findMany({
      where: {
        accounts: {
          some: { provider: "facebook" }
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        accounts: {
          where: { provider: "facebook" }
        }
      }
    });

    console.log("Recent Users with Facebook Accounts:");
    console.log(JSON.stringify(users.map(u => ({
      userId: u.id,
      email: u.email,
      name: u.name,
      tenantId: u.tenantId,
      updatedAt: u.updatedAt,
      fbAccountId: u.accounts[0]?.providerAccountId
    })), null, 2));

  } catch (error: any) {
    console.error("Database query failed:", error.message || error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentFacebookAccounts();
