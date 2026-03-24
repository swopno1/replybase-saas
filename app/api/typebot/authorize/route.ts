import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import getOidcProvider from "@/lib/oidc-provider";

/**
 * PHASE 1: Secure OIDC Authorization Endpoint
 *
 * This endpoint generates an OIDC authorization URL for Typebot Engine access.
 * It ensures:
 * 1. User is authenticated in SaaS
 * 2. User has active subscription
 * 3. OIDC token includes required claims (plan, subscription_status)
 * 4. User is redirected to Typebot Engine with proper OIDC flow
 *
 * Security: This is the ONLY way users should access Typebot Builder.
 * Direct access to engine.replybase.co.uk should be blocked at infrastructure level.
 */
export async function GET() {
  try {
    // Step 1: Verify user is authenticated in SaaS
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to access the bot builder." },
        { status: 401 },
      );
    }

    // Step 2: Verify subscription status
    const subscriptionStatus = session.user.subscriptionStatus as string;

    if (subscriptionStatus !== "active" && subscriptionStatus !== "trialing") {
      return NextResponse.json(
        {
          error: "Subscription required",
          redirect: "/pricing?reason=subscription_required",
        },
        { status: 403 },
      );
    }

    // Step 3: Get OIDC provider (ensures provider is initialized) and generate authorization URL
    getOidcProvider();
    const clientId = process.env.TYPEBOT_OIDC_CLIENT_ID || "typebot-engine";
    const redirectUri =
      process.env.TYPEBOT_CALLBACK_URL ||
      "https://engine.replybase.co.uk/api/auth/oauth/generic-oidc/callback";

    const issuerBase =
      process.env.NEXT_PUBLIC_APP_URL || "https://app.replybase.co.uk";
    // oidc-provider authorization endpoint is mounted at `${issuerBase}/api/oidc/auth`
    // This triggers the flow: SaaS(IdP) → Engine(RP) → callback → Engine
    const authUrl = new URL(`${issuerBase}/api/oidc/auth`);
    authUrl.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile plan subscription_status",
      state: session.user.id,
    }).toString();

    // Step 4: Return authorization URL
    // The frontend will redirect the user to this URL
    // Typebot Engine will handle the OIDC callback and issue tokens
    return NextResponse.json({
      authorizationUrl: authUrl.toString(),
    });
  } catch (error: unknown) {
    console.error("[Typebot Authorize] Error:", error);
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate authorization URL", details },
      { status: 500 },
    );
  }
}

/**
 * POST handler for server-side redirects
 * This allows the SaaS app to redirect users directly without exposing the URL
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }

    const subscriptionStatus = session.user.subscriptionStatus as string;

    if (subscriptionStatus !== "active" && subscriptionStatus !== "trialing") {
      return NextResponse.redirect(
        new URL("/pricing?reason=subscription_required", req.url),
      );
    }

    getOidcProvider();
    const clientId = process.env.TYPEBOT_OIDC_CLIENT_ID || "typebot-engine";
    const redirectUri =
      process.env.TYPEBOT_CALLBACK_URL ||
      "https://engine.replybase.co.uk/api/auth/oauth/generic-oidc/callback";

    const issuerBase =
      process.env.NEXT_PUBLIC_APP_URL || "https://app.replybase.co.uk";
    const authUrl = new URL(`${issuerBase}/api/oidc/auth`);
    authUrl.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile plan subscription_status",
      state: session.user.id,
    }).toString();

    // Direct redirect to OIDC authorization endpoint
    return NextResponse.redirect(authUrl);
  } catch (error: unknown) {
    console.error("[Typebot Authorize] Error:", error);
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to authorize", details },
      { status: 500 },
    );
  }
}
