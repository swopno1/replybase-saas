import crypto from "crypto";

const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export type WebchatSessionPayload = {
  siteId?: string;
  channelId: string;
  botId: string;
  tenantId: string;
  conversationId: string;
  visitorId: string;
  isShadow?: boolean;
  exp: number;
};

function base64urlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64urlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getSigningSecret(): string {
  const secret = process.env.WEBCHAT_TOKEN_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("WEBCHAT_TOKEN_SECRET is not configured");
  }
  return secret;
}

export function createWebchatSessionToken(params: {
  siteId?: string;
  channelId: string;
  botId: string;
  tenantId: string;
  conversationId: string;
  visitorId: string;
  isShadow?: boolean;
  ttlSeconds?: number;
}): string {
  const ttlSeconds = params.ttlSeconds || DEFAULT_TTL_SECONDS;
  const payload: WebchatSessionPayload = {
    siteId: params.siteId,
    channelId: params.channelId,
    botId: params.botId,
    tenantId: params.tenantId,
    conversationId: params.conversationId,
    visitorId: params.visitorId,
    isShadow: params.isShadow,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const payloadSegment = base64urlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payloadSegment)
    .digest("base64url");

  return `${payloadSegment}.${signature}`;
}

export function verifyWebchatSessionToken(
  token: string,
): WebchatSessionPayload {
  const [payloadSegment, signatureSegment] = token.split(".");

  if (!payloadSegment || !signatureSegment) {
    throw new Error("Invalid token format");
  }

  const expectedSignature = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payloadSegment)
    .digest("base64url");

  const matches =
    signatureSegment.length === expectedSignature.length &&
    crypto.timingSafeEqual(
      Buffer.from(signatureSegment),
      Buffer.from(expectedSignature),
    );

  if (!matches) {
    throw new Error("Invalid token signature");
  }

  const payload = JSON.parse(
    base64urlDecode(payloadSegment),
  ) as WebchatSessionPayload;
  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return payload;
}
