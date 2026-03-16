/**
 * Lightweight structured metrics for webchat events.
 * Emits newline-delimited JSON to stdout — compatible with any log aggregator
 * (Datadog, CloudWatch Logs, Loki, etc.).
 *
 * Disable by setting WEBCHAT_METRICS_ENABLED=false.
 */

export type WebchatMetricEvent =
  | "webchat.session.init"
  | "webchat.message.processed"
  | "webchat.event.tracked"
  | "webchat.event.sampled_out"
  | "webchat.rate_limit.hit"
  | "webchat.cors.denied"
  | "webchat.bot.blocked"
  | "webchat.challenge.failed";

export type WebchatMetricLabels = Record<
  string,
  string | number | boolean | null | undefined
>;

function isEnabled(): boolean {
  return process.env.WEBCHAT_METRICS_ENABLED !== "false";
}

/**
 * Emit a single structured metric line.
 * Never throws — metric emission must not affect the request path.
 */
export function recordWebchatMetric(
  event: WebchatMetricEvent,
  labels?: WebchatMetricLabels,
): void {
  try {
    if (!isEnabled()) {
      return;
    }

    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      metric: event,
      ...labels,
    };

    console.log(JSON.stringify(entry));
  } catch {
    // Intentionally swallowed — metrics must never break the request path.
  }
}
