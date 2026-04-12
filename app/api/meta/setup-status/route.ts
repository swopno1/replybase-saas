import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

function hasValue(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function normalizeBaseUrl(url: string | undefined, fallback: string) {
  const base = (url || fallback).trim();
  return base.replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appBaseUrl = normalizeBaseUrl(
    process.env.NEXTAUTH_URL,
    req.nextUrl.origin,
  );

  return NextResponse.json({
    channelFlags: {
      enableFacebook: process.env.ENABLE_CHANNEL_FACEBOOK || "true",
      enableUiFacebook: process.env.ENABLE_UI_CHANNEL_FACEBOOK || "true",
      enableWhatsapp: process.env.ENABLE_CHANNEL_WHATSAPP || "true",
      enableUiWhatsapp: process.env.ENABLE_UI_CHANNEL_WHATSAPP || "true",
    },
    facebook: {
      oauthConfigured:
        hasValue(process.env.FACEBOOK_CLIENT_ID) &&
        hasValue(process.env.FACEBOOK_CLIENT_SECRET),
      webhookVerifyTokenConfigured: hasValue(
        process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN,
      ),
      oauthCallbackUrl: `${appBaseUrl}/api/auth/callback/facebook`,
      webhookCallbackUrl: `${appBaseUrl}/api/facebook/webhook`,
      requiredScopes: [
        "email",
        "public_profile",
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_metadata",
        "pages_messaging",
        "business_management",
      ],
    },
    whatsapp: {
      appSecretConfigured: hasValue(
        process.env.WHATSAPP_APP_SECRET || process.env.FACEBOOK_CLIENT_SECRET,
      ),
      webhookVerifyTokenConfigured: hasValue(
        process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
          process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN,
      ),
      webhookCallbackUrl: `${normalizeBaseUrl(process.env.WHATSAPP_WEBHOOK_BASE_URL, appBaseUrl)}/api/whatsapp/webhook`,
      requiredPermissions: [
        "whatsapp_business_management",
        "whatsapp_business_messaging",
      ],
    },
  });
}
