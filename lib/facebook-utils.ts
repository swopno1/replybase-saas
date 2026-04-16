import crypto from "crypto";

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
