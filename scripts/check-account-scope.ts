import "dotenv/config";
import { prisma } from "../lib/prisma";

async function checkAccountScope() {
  const userId = "cmnwwdnkm000112p6ei6rwkxs";
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId: userId,
        provider: "facebook",
      },
    });

    if (account) {
      console.log(`Account Scope for ${userId}:`);
      console.log(account.scope);
    } else {
      console.log("Account not found.");
    }
  } catch (error: any) {
    console.error("Query failed:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAccountScope();
