import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.FACEBOOK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "FACEBOOK_CLIENT_ID is not configured" }, { status: 500 });
  }

  // Ensure no trailing slash
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/integrations/facebook/callback`;
  const scopes = "public_profile,pages_show_list,pages_manage_metadata,pages_messaging";
  
  // Use state to protect against CSRF and pass context
  const state = session.user.id;

  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${scopes}`;
  
  return NextResponse.redirect(authUrl);
}
