export const WEBCHAT_TELEMETRY_TAXONOMY_VERSION = "2026-03-16";

const WEBCHAT_TELEMETRY_POLICY = {
  OPEN: { category: "lifecycle", sampleRate: 1 },
  CLOSE: { category: "lifecycle", sampleRate: 1 },
  TYPING: { category: "engagement", sampleRate: 0.25 },
  MESSAGE: { category: "engagement", sampleRate: 1 },
  ERROR: { category: "diagnostic", sampleRate: 1 },
} as const;

type WebchatTelemetryType = keyof typeof WEBCHAT_TELEMETRY_POLICY;

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getWebchatTelemetryConfig() {
  return {
    taxonomyVersion: WEBCHAT_TELEMETRY_TAXONOMY_VERSION,
    sampleRates: Object.fromEntries(
      Object.entries(WEBCHAT_TELEMETRY_POLICY).map(([type, policy]) => [
        type,
        policy.sampleRate,
      ]),
    ),
  };
}

export function getWebchatTelemetryPolicy(type: WebchatTelemetryType) {
  return WEBCHAT_TELEMETRY_POLICY[type];
}

export function shouldSampleWebchatTelemetry(type: WebchatTelemetryType) {
  const policy = getWebchatTelemetryPolicy(type);
  if (policy.sampleRate >= 1) {
    return true;
  }

  return Math.random() <= policy.sampleRate;
}

export function normalizeWebchatTelemetryPayload(
  type: WebchatTelemetryType,
  payload?: Record<string, unknown>,
) {
  const basePayload = {
    taxonomyVersion: WEBCHAT_TELEMETRY_TAXONOMY_VERSION,
    category: WEBCHAT_TELEMETRY_POLICY[type].category,
    eventName: type.toLowerCase(),
  } as Record<string, unknown>;

  switch (type) {
    case "OPEN":
    case "CLOSE":
      return {
        ...basePayload,
        url: getString(payload?.url),
        trigger: getString(payload?.trigger),
      };
    case "TYPING":
      return {
        ...basePayload,
        url: getString(payload?.url),
        inputLength: getNumber(payload?.inputLength),
      };
    case "MESSAGE":
      return {
        ...basePayload,
        url: getString(payload?.url),
        direction: getString(payload?.direction),
        messageLength: getNumber(payload?.messageLength),
      };
    case "ERROR":
      return {
        ...basePayload,
        url: getString(payload?.url),
        stage: getString(payload?.stage),
        reason: getString(payload?.reason),
        message: getString(payload?.message),
      };
    default:
      return basePayload;
  }
}
