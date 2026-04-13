import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/facebook-utils";

export const dynamic = "force-dynamic";

function getVerifyToken(): string | null {
  return (
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() ||
    process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN?.trim() ||
    null
  );
}

function getAppSecret(): string | null {
  return (
    process.env.WHATSAPP_APP_SECRET?.trim() ||
    process.env.FACEBOOK_CLIENT_SECRET?.trim() ||
    null
  );
}

// Meta webhook verification handshake.
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = getVerifyToken();
  if (!verifyToken) {
    return NextResponse.json(
      { error: "Webhook verify token is not configured" },
      { status: 500 },
    );
  }

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// Runtime event receiver. Returns 200 so Meta does not retry on non-fatal parse issues.
export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-hub-signature-256");
    const appSecret = getAppSecret();
    const bodyText = await req.text();

    if (signature && appSecret) {
      const isValid = verifyWebhookSignature(bodyText, signature, appSecret);
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 403 },
        );
      }
    }

    let payload: unknown = null;
    try {
      payload = JSON.parse(bodyText || "{}");
    } catch {
      return NextResponse.json(
        { received: true, parsed: false },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { received: true, parsed: true, payload },
      { status: 200 },
    );
  } catch (error) {
    console.error("[WhatsApp Webhook] Error:", error);
    return NextResponse.json({ received: false }, { status: 500 });
  }
}
