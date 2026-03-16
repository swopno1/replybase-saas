import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateWebchatBotSignals } from "@/lib/webchat-bot-mitigation";

describe("validateWebchatBotSignals", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.WEBCHAT_BOT_MITIGATION_ENABLED;
    delete process.env.WEBCHAT_MIN_INIT_ELAPSED_MS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("when mitigation is disabled", () => {
    it("allows any request", () => {
      process.env.WEBCHAT_BOT_MITIGATION_ENABLED = "false";
      const result = validateWebchatBotSignals({
        stage: "init",
        signals: { honeypot: "filled", elapsedMs: 0 },
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe("honeypot check", () => {
    it("blocks when honeypot field is non-empty", () => {
      const result = validateWebchatBotSignals({
        stage: "init",
        signals: { honeypot: "bot content" },
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("honeypot_triggered");
    });

    it("allows when honeypot field is empty string", () => {
      const result = validateWebchatBotSignals({
        stage: "init",
        signals: { honeypot: "" },
      });
      expect(result.allowed).toBe(true);
    });

    it("allows when honeypot field is absent", () => {
      const result = validateWebchatBotSignals({ stage: "init" });
      expect(result.allowed).toBe(true);
    });

    it("blocks honeypot in message stage too", () => {
      const result = validateWebchatBotSignals({
        stage: "message",
        signals: { honeypot: "x" },
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("honeypot_triggered");
    });
  });

  describe("init elapsed time check", () => {
    it("blocks when elapsedMs is below default threshold (800ms)", () => {
      const result = validateWebchatBotSignals({
        stage: "init",
        signals: { honeypot: "", elapsedMs: 200 },
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("interaction_too_fast");
    });

    it("allows when elapsedMs equals the threshold", () => {
      const result = validateWebchatBotSignals({
        stage: "init",
        signals: { honeypot: "", elapsedMs: 800 },
      });
      expect(result.allowed).toBe(true);
    });

    it("allows when elapsedMs exceeds the threshold", () => {
      const result = validateWebchatBotSignals({
        stage: "init",
        signals: { honeypot: "", elapsedMs: 3000 },
      });
      expect(result.allowed).toBe(true);
    });

    it("allows any elapsedMs in message stage (elapsed check is init-only)", () => {
      const result = validateWebchatBotSignals({
        stage: "message",
        signals: { honeypot: "", elapsedMs: 0 },
      });
      expect(result.allowed).toBe(true);
    });

    it("respects custom WEBCHAT_MIN_INIT_ELAPSED_MS env override", () => {
      process.env.WEBCHAT_MIN_INIT_ELAPSED_MS = "2000";
      const blockedResult = validateWebchatBotSignals({
        stage: "init",
        signals: { honeypot: "", elapsedMs: 1500 },
      });
      expect(blockedResult.allowed).toBe(false);

      const allowedResult = validateWebchatBotSignals({
        stage: "init",
        signals: { honeypot: "", elapsedMs: 2000 },
      });
      expect(allowedResult.allowed).toBe(true);
    });

    it("ignores non-finite elapsedMs values", () => {
      const result = validateWebchatBotSignals({
        stage: "init",
        signals: { honeypot: "", elapsedMs: NaN },
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe("no signals provided", () => {
    it("allows when signals object is null", () => {
      const result = validateWebchatBotSignals({
        stage: "init",
        signals: null,
      });
      expect(result.allowed).toBe(true);
    });
  });
});
