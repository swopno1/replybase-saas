import "dotenv/config";
import { prisma } from "../lib/prisma";

async function checkFacebookPage() {
  const pageId = "61582603721680";
  console.log(`Checking Facebook Page ID: ${pageId}`);

  try {
    const page = await prisma.facebookPage.findUnique({
      where: { facebookId: pageId },
      include: {
        tenant: true,
      },
    });

    if (page) {
      console.log("Found Page in DB:");
      console.log(JSON.stringify(page, null, 2));
      
      // Also check if any users are linked to this tenant
      const users = await prisma.user.findMany({
        where: { tenantId: page.tenantId },
        select: { id: true, email: true, name: true }
      });
      console.log("\nUsers in this tenant:");
      console.log(JSON.stringify(users, null, 2));
    } else {
      console.log("Page not found in database.");
    }
  } catch (error: any) {
    console.error("Database query failed:");
    console.error(error.message || error);
    if (error.code) console.error(`Error Code: ${error.code}`);
  } finally {
    await prisma.$disconnect();
  }
}

checkFacebookPage();
