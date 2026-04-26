import "dotenv/config";
import { prisma } from "../lib/prisma";
import { getFacebookGraphUrl } from "../lib/server/facebook-utils";

async function debugFacebookPages() {
  const userId = "cmnwwdnkm000112p6ei6rwkxs";
  console.log(`Debugging Facebook pages for user: ${userId}`);

  try {
    const account = await prisma.account.findFirst({
      where: {
        userId: userId,
        provider: "facebook",
      },
    });

    if (!account || !account.access_token) {
      console.log("No Facebook account or access token found for user.");
      return;
    }

    console.log("Calling Facebook Graph API: me/accounts");
    const fbUrl = getFacebookGraphUrl("me/accounts", account.access_token);
    const fbRes = await fetch(fbUrl, {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
      },
    });

    const data = await fbRes.json();
    
    if (!fbRes.ok) {
      console.error("Facebook API Error:", JSON.stringify(data, null, 2));
      return;
    }

    const pages = data.data || [];
    console.log(`Found ${pages.length} pages in Facebook:`);
    pages.forEach((p: any) => {
      console.log(`- ${p.name} (ID: ${p.id})`);
    });

    const targetPageId = "61582603721680";
    const found = pages.find((p: any) => p.id === targetPageId);
    if (found) {
      console.log(`\n✅ TARGET PAGE FOUND: ${found.name} (ID: ${found.id})`);
    } else {
      console.log(`\n❌ TARGET PAGE NOT FOUND: ${targetPageId}`);
      console.log("This means the user's current token does not have access to this page, or didn't grant the permission for it.");
    }

  } catch (error: any) {
    console.error("Debug failed:", error.message || error);
  } finally {
    await prisma.$disconnect();
  }
}

debugFacebookPages();
