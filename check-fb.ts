import { prisma } from "./lib/prisma";

async function main() {
  const account = await prisma.account.findFirst({
    where: { 
      user: { email: "amirhossain.limon@gmail.com" },
      provider: "facebook" 
    }
  });

  if (!account || !account.access_token) {
    console.log("No facebook account found.");
    return;
  }

  console.log(`Testing token: ${account.access_token.substring(0, 10)}...`);
  
  const fbRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts`, {
    headers: { Authorization: `Bearer ${account.access_token}` },
  });

  console.log(`Status: ${fbRes.status}`);
  const data = await fbRes.json();
  console.log("Response:", JSON.stringify(data, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
