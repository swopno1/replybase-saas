"use client";

export type TrackingEventName =
  | "get_started_click"
  | "signup_started"
  | "signup_completed"
  | "onboarding_step_completed"
  | "dashboard_loaded"
  | "pricing_viewed"
  | "newsletter_signup"
  | "contact_form_submission";

type OnceScope = "memory" | "session" | "local";

type TrackEventOptions = {
  properties?: Record<string, string | number | boolean | null | undefined>;
  onceKey?: string;
  onceScope?: OnceScope;
};

type ClarityAPI = {
  (command: "event", eventName: string): void;
  (command: "set", key: string, value: string): void;
};

declare global {
  interface Window {
    plausible?: (
      eventName: string,
      options?: { props?: Record<string, unknown> },
    ) => void;
    clarity?: ClarityAPI;
    posthog?: {
      capture: (eventName: string, properties?: Record<string, unknown>) => void;
    };
  }
}

const inMemoryEventKeys = new Set<string>();

const plausibleGoalMap: Partial<Record<TrackingEventName, string>> = {
  get_started_click: "Get Started Click",
  signup_completed: "Signup Completed",
  pricing_viewed: "Pricing Viewed",
  newsletter_signup: "Newsletter Signup",
  contact_form_submission: "Contact Form Submission",
};

function hasWindow() {
  return typeof window !== "undefined";
}

function hasBeenTracked(eventKey: string, scope: OnceScope): boolean {
  if (!hasWindow()) {
    return true;
  }

  if (scope === "memory") {
    if (inMemoryEventKeys.has(eventKey)) {
      return true;
    }
    inMemoryEventKeys.add(eventKey);
    return false;
  }

  const storage = scope === "local" ? window.localStorage : window.sessionStorage;
  if (storage.getItem(eventKey)) {
    return true;
  }

  storage.setItem(eventKey, "1");
  return false;
}

function cleanProperties(
  properties: Record<string, string | number | boolean | null | undefined> = {},
): Record<string, string | number | boolean> {
  const cleaned: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

export function setClarityTags(tags: Record<string, string | undefined>) {
  if (!hasWindow() || typeof window.clarity !== "function") {
    return;
  }

  for (const [key, value] of Object.entries(tags)) {
    if (!value) {
      continue;
    }

    window.clarity("set", key, value);
  }
}

export function trackEvent(
  eventName: TrackingEventName,
  options: TrackEventOptions = {},
) {
  if (!hasWindow()) {
    return false;
  }

  // Only track in production
  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  const onceKey = options.onceKey;
  const onceScope = options.onceScope || "memory";
  if (onceKey && hasBeenTracked(`tracking:${onceKey}`, onceScope)) {
    return false;
  }

  const properties = cleanProperties({
    ...options.properties,
    path: window.location.pathname,
  });

  try {
    const plausibleGoalName = plausibleGoalMap[eventName];
    if (plausibleGoalName && typeof window.plausible === "function") {
      window.plausible(plausibleGoalName, { props: properties });
    }
  } catch (err) {
    console.error("Failed to track Plausible event", err);
  }

  try {
    if (typeof window.clarity === "function") {
      window.clarity("event", eventName);
    }
  } catch (err) {
    console.error("Failed to track Clarity event", err);
  }

  try {
    if (window.posthog?.capture) {
      window.posthog.capture(eventName, properties);
    }
  } catch (err) {
    console.error("Failed to track PostHog event", err);
  }

  return true;
}
