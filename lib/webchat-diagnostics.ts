import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sanitizeWebchatMetadataForRetention } from "@/lib/webchat-privacy";

export async function recordWebchatErrorEvent(params: {
  siteId: string;
  sessionId?: string | null;
  reason:
    | "blocked_origin"
    | "rate_limit"
    | "message_error"
    | "invalid_token"
    | "invalid_init_challenge"
    | "bot_mitigation"
    | "rollout_disabled";
  stage: "init" | "config" | "message" | "events";
  payload?: Record<string, unknown>;
}) {
  try {
    await prisma.webChatEvent.create({
      data: {
        siteId: params.siteId,
        sessionId: params.sessionId || null,
        type: "ERROR",
        payload: {
          reason: params.reason,
          stage: params.stage,
          ...sanitizeWebchatMetadataForRetention(params.payload || {}),
        } as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error("[Webchat Diagnostics] Failed to record error event:", error);
  }
}
