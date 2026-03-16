export type WebchatBotSignals = {
  honeypot?: string | null;
  elapsedMs?: number | null;
};

export type WebchatBotMitigationResult = {
  allowed: boolean;
  reason?: string;
  message?: string;
};

function isMitigationEnabled() {
  if (process.env.WEBCHAT_BOT_MITIGATION_ENABLED === "false") {
    return false;
  }

  return true;
}

function getMinElapsedMs() {
  const raw = process.env.WEBCHAT_MIN_INIT_ELAPSED_MS;
  if (!raw) {
    return 800;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 800;
}

export function validateWebchatBotSignals(params: {
  stage: "init" | "message";
  signals?: WebchatBotSignals | null;
}): WebchatBotMitigationResult {
  if (!isMitigationEnabled()) {
    return { allowed: true };
  }

  const honeypot =
    typeof params.signals?.honeypot === "string"
      ? params.signals.honeypot.trim()
      : "";

  if (honeypot) {
    return {
      allowed: false,
      reason: "honeypot_triggered",
      message: "Automated request blocked",
    };
  }

  if (params.stage === "init") {
    const elapsedMs = params.signals?.elapsedMs;
    if (typeof elapsedMs === "number" && Number.isFinite(elapsedMs)) {
      if (elapsedMs < getMinElapsedMs()) {
        return {
          allowed: false,
          reason: "interaction_too_fast",
          message: "Initialization request blocked",
        };
      }
    }
  }

  return { allowed: true };
}
