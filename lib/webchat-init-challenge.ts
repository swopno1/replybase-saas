import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const DEFAULT_INIT_CHALLENGE_TTL_SECONDS = 60 * 5;

type WebchatInitChallengePayload = {
  jti: string;
  siteId: string;
  publicKey: string;
  origin?: string;
  exp: number;
};

function getSigningSecret(): string {
  const secret =
    process.env.WEBCHAT_INIT_CHALLENGE_SECRET ||
    process.env.WEBCHAT_TOKEN_SECRET ||
    process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("WEBCHAT_INIT_CHALLENGE_SECRET is not configured");
  }

  return secret;
}

function base64urlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64urlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function normalizeOrigin(origin?: string | null) {
  if (!origin) {
    return "";
  }

  try {
    return new URL(origin).origin.toLowerCase();
  } catch {
    return "";
  }
}

function verifyChallengeToken(token: string): WebchatInitChallengePayload {
  const [payloadSegment, signatureSegment] = token.split(".");

  if (!payloadSegment || !signatureSegment) {
    throw new Error("Invalid init challenge format");
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
    throw new Error("Invalid init challenge signature");
  }

  const payload = JSON.parse(
    base64urlDecode(payloadSegment),
  ) as WebchatInitChallengePayload;

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("Init challenge expired");
  }

  return payload;
}

export function createWebchatInitChallenge(params: {
  siteId: string;
  publicKey: string;
  origin?: string | null;
  ttlSeconds?: number;
}) {
  const ttlSeconds = params.ttlSeconds || DEFAULT_INIT_CHALLENGE_TTL_SECONDS;
  const payload: WebchatInitChallengePayload = {
    jti: crypto.randomUUID(),
    siteId: params.siteId,
    publicKey: params.publicKey,
    origin: normalizeOrigin(params.origin),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const payloadSegment = base64urlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payloadSegment)
    .digest("base64url");

  return {
    token: `${payloadSegment}.${signature}`,
    expiresIn: ttlSeconds,
  };
}

export async function consumeWebchatInitChallenge(params: {
  token: string;
  siteId: string;
  publicKey: string;
  origin?: string | null;
}) {
  const payload = verifyChallengeToken(params.token);

  if (payload.siteId !== params.siteId) {
    throw new Error("Init challenge site mismatch");
  }

  if (payload.publicKey !== params.publicKey) {
    throw new Error("Init challenge public key mismatch");
  }

  const normalizedRequestOrigin = normalizeOrigin(params.origin);
  if (
    payload.origin &&
    normalizedRequestOrigin &&
    payload.origin !== normalizedRequestOrigin
  ) {
    throw new Error("Init challenge origin mismatch");
  }

  const replayEventKey = `init_nonce:${payload.jti}`;
  const existing = await prisma.webhookLog.findFirst({
    where: {
      tenantId: (await prisma.webChatSite.findUnique({ where: { id: payload.siteId }, select: { tenantId: true } }))?.tenantId,
      source: "webchat_init",
      event: replayEventKey,
    },
    select: { id: true },
  });

  if (existing) {
    throw new Error("Init challenge already used");
  }

  await prisma.webhookLog.create({
    data: {
      tenantId: (await prisma.webChatSite.findUnique({ where: { id: payload.siteId }, select: { tenantId: true } }))?.tenantId,
      source: "webchat_init",
      type: "nonce_used",
      event: replayEventKey,
      data: {
        siteId: payload.siteId,
        publicKey: payload.publicKey,
        origin: payload.origin || null,
        exp: payload.exp,
      },
    },
  });

  return payload;
}
