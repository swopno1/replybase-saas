import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  
  if (error) {
    return new NextResponse(
      `<html><body style="font-family: sans-serif; text-align: center; padding: 2rem;">
        Authentication failed or was cancelled. 
        <script>setTimeout(() => window.close(), 1000);</script>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code) {
    return new NextResponse("No code provided", { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const clientId = process.env.FACEBOOK_CLIENT_ID;
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/integrations/facebook/callback`;

  try {
    // Exchange code for token
    const tokenResponse = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${code}`);
    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error("Failed to retrieve access token: " + JSON.stringify(tokenData));
    }

    // Get Facebook User ID
    const meResponse = await fetch(`https://graph.facebook.com/me?access_token=${tokenData.access_token}`);
    const meData = await meResponse.json();

    if (!meData.id) {
      throw new Error("Failed to retrieve user ID: " + JSON.stringify(meData));
    }

    // Upsert the Account
    const existingAccount = await prisma.account.findFirst({
      where: { userId: session.user.id, provider: "facebook" }
    });

    if (existingAccount) {
      await prisma.account.update({
        where: { id: existingAccount.id },
        data: {
          access_token: tokenData.access_token,
          providerAccountId: meData.id,
        }
      });
    } else {
      await prisma.account.create({
        data: {
          userId: session.user.id,
          type: "oauth",
          provider: "facebook",
          providerAccountId: meData.id,
          access_token: tokenData.access_token,
        }
      });
    }

    // Return HTML to close the popup
    return new NextResponse(
      `<html><body style="font-family: sans-serif; text-align: center; padding: 2rem;">
        <h2 style="color: #10b981;">Integration Successful!</h2>
        <p>You can close this window now.</p>
        <script>window.close();</script>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    console.error("Facebook Integration Error:", err);
    return new NextResponse(
      `<html><body style="font-family: sans-serif; text-align: center; padding: 2rem; color: #ef4444;">
        An error occurred during integration. Please check the server logs.
        <script>setTimeout(() => window.close(), 3000);</script>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }
}
