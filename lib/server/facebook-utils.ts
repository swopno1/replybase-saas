import crypto from "crypto";
import { FACEBOOK_BASE_URL } from "@/lib/meta-config";

interface SignedRequestPayload {
  user_id?: string;
  algorithm: string;
  issued_at: number;
  [key: string]: unknown;
}

export function parseSignedRequest(
  signedRequest: string,
  appSecret: string,
): SignedRequestPayload | null {
  try {
    const [encodedSig, payload] = signedRequest.split(".");

    if (!encodedSig || !payload) return null;

    // Decode signature
    const sig = base64decode(encodedSig);

    // Decode payload
    const data = JSON.parse(base64decode(payload));

    if (data.algorithm.toUpperCase() !== "HMAC-SHA256") {
      console.error("Unknown algorithm. Expected HMAC-SHA256");
      return null;
    }

    // Verify signature
    const expectedSig = crypto
      .createHmac("sha256", appSecret)
      .update(payload)
      .digest();

    // Timing safe compare
    if (!crypto.timingSafeEqual(Buffer.from(sig, "binary"), expectedSig)) {
      console.error("Bad Signed JSON Signature!");
      return null;
    }

    return data;
  } catch (e) {
    console.error("Error parsing signed request:", e);
    return null;
  }
}

function base64decode(str: string): string {
  // Base64 Url decoding
  return Buffer.from(
    str.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf-8");
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string,
): boolean {
  if (!signature.startsWith("sha256=")) return false;

  const sig = signature.substring(7); // remove 'sha256='
  const expectedSig = crypto
    .createHmac("sha256", appSecret)
    .update(payload)
    .digest("hex");

  // Convert hex strings to Buffers for timing-safe comparison
  const sigBuffer = Buffer.from(sig, "hex");
  const expectedSigBuffer = Buffer.from(expectedSig, "hex");

  // Ensure both buffers are the same length
  if (sigBuffer.length !== expectedSigBuffer.length) return false;

  return crypto.timingSafeEqual(sigBuffer, expectedSigBuffer);
}

export function generateAppSecretProof(
  accessToken: string,
  appSecret: string,
): string {
  return crypto
    .createHmac("sha256", appSecret)
    .update(accessToken)
    .digest("hex");
}

/**
 * Exchanges a short-lived user access token for a long-lived one (60 days)
 */
export async function exchangeLongLivedToken(shortLivedToken: string): Promise<string | null> {
  const appId = process.env.FACEBOOK_CLIENT_ID;
  const appSecret = process.env.FACEBOOK_CLIENT_SECRET;

  if (!appId || !appSecret) {
    console.error("[Facebook Utils] Missing app ID or secret for token exchange");
    return null;
  }

  const url = new URL(`${FACEBOOK_BASE_URL}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();
    return data.access_token || null;
  } catch (error) {
    console.error("[Facebook Utils] Token exchange error:", error);
    return null;
  }
}

/**
 * Configures the Messenger Profile for a page (Get Started button, Persistent Menu, etc.)
 */
export async function setupMessengerProfile(pageId: string, accessToken: string) {
  const url = getFacebookGraphUrl(`${pageId}/messenger_profile`, accessToken);
  
  const payload = {
    get_started: {
      payload: "GET_STARTED_PAYLOAD"
    },
    greeting: [
      {
        locale: "default",
        text: "Welcome to our bot! Click the button below to get started."
      }
    ]
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data.result === "success";
  } catch (error) {
    console.error("[Facebook Utils] Messenger Profile setup error:", error);
    return false;
  }
}

/**
 * Appends appsecret_proof to a Facebook Graph API URL
 */
export function getFacebookGraphUrl(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
): string {
  const appSecret = process.env.FACEBOOK_CLIENT_SECRET;

  const url = new URL(`${FACEBOOK_BASE_URL}/${path}`);
  url.searchParams.set("access_token", accessToken);

  if (appSecret) {
    url.searchParams.set(
      "appsecret_proof",
      generateAppSecretProof(accessToken, appSecret),
    );
  }

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}
