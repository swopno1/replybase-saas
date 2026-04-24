/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { trackEvent } from "../../lib/client-analytics";

describe("trackEvent utility", () => {
  beforeEach(() => {
    // Mock window.plausible
    window.plausible = vi.fn();
    // Clear storage
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call window.plausible with mapped goal name for signup_completed", () => {
    trackEvent("signup_completed");
    expect(window.plausible).toHaveBeenCalledWith("signup", expect.any(Object));
  });

  it("should call window.plausible with mapped goal name for onboarding_completed", () => {
    trackEvent("onboarding_completed");
    expect(window.plausible).toHaveBeenCalledWith("onboarding_completed", expect.any(Object));
  });

  it("should call window.plausible for subscription_started", () => {
    trackEvent("subscription_started");
    expect(window.plausible).toHaveBeenCalledWith("subscription_started", expect.any(Object));
  });

  it("should call window.plausible for first_message_sent", () => {
    trackEvent("first_message_sent");
    expect(window.plausible).toHaveBeenCalledWith("first_message_sent", expect.any(Object));
  });

  it("should NOT call window.plausible for unmapped events", () => {
    // @ts-ignore - testing behavior for events not in the Plausible map
    trackEvent("dashboard_loaded");
    expect(window.plausible).not.toHaveBeenCalled();
  });

  it("should handle missing window.plausible gracefully", () => {
    // @ts-ignore
    delete window.plausible;
    expect(() => trackEvent("signup_completed")).not.toThrow();
  });

  it("should respects onceKey and onceScope", () => {
    const eventName = "signup_completed";
    const options = { onceKey: "test-key", onceScope: "memory" as const };

    trackEvent(eventName, options);
    expect(window.plausible).toHaveBeenCalledTimes(1);

    trackEvent(eventName, options);
    expect(window.plausible).toHaveBeenCalledTimes(1); // Should not be called again
  });
});
