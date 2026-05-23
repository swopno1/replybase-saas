import * as Sentry from "@sentry/nextjs";

const SECRET_REGEX = /(?:sk_(?:live|test)_[a-zA-Z0-9]{24,})|(?:sk-[a-zA-Z0-9]{20,})|(?:EAA[a-zA-Z0-9]{40,})|(?:bearer\s+[a-zA-Z0-9\-._~+/]+=*)/gi;

function scrub(value: any, seen = new WeakSet()): any {
  if (typeof value === "string") {
    return value.replace(SECRET_REGEX, "[REDACTED]");
  }
  if (value !== null && typeof value === "object") {
    if (seen.has(value)) {
      return value;
    }
    seen.add(value);
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        if (/(?:password|token|secret|key|authorization|cookie)/i.test(key)) {
          if (typeof value[key] === "string") {
            value[key] = "[REDACTED]";
          } else {
            value[key] = scrub(value[key], seen);
          }
        } else {
          value[key] = scrub(value[key], seen);
        }
      }
    }
  }
  return value;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  sendDefaultPii: false,

  tracesSampler: (samplingContext) => {
    const transactionName = samplingContext.transactionContext.name || "";
    if (transactionName.includes("/api/health") || transactionName.includes("/api/system-health")) {
      return 0.0;
    }
    if (transactionName.includes("/api/conversations/") || transactionName.includes("/api/webchat/messages")) {
      return 0.01;
    }
    if (
      transactionName.includes("/api/billing/webhook") ||
      transactionName.includes("/api/facebook/webhook") ||
      transactionName.includes("/api/telegram/webhook") ||
      transactionName.includes("/api/whatsapp/webhook")
    ) {
      return 1.0;
    }
    const isDev = process.env.NODE_ENV === "development";
    return isDev ? 1.0 : 0.02;
  },

  // Session Replay: 0.1% of all sessions, 100% of sessions with errors (Task 048)
  replaysSessionSampleRate: 0.001,
  replaysOnErrorSampleRate: 1.0,

  enableLogs: true,

  integrations: [
    Sentry.replayIntegration(),
  ],

  beforeSend(event) {
    if (event.request) event.request = scrub(event.request);
    if (event.extra) event.extra = scrub(event.extra);
    
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
        if (breadcrumb.data) {
          breadcrumb.data = scrub(breadcrumb.data);
        }
        if (breadcrumb.message) {
          breadcrumb.message = scrub(breadcrumb.message);
        }
        return breadcrumb;
      });
    }

    return event;
  },
});

// Hook into App Router navigation transitions
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
