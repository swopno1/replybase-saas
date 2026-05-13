import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateWebchatBotSignals } from '@/lib/webchat-bot-mitigation';

describe('validateWebchatBotSignals', () => {
  const oldEnv = process.env;

  beforeEach(() => {
    process.env = { ...oldEnv };
    // Clear relevant env vars for a clean state in each test
    delete process.env.WEBCHAT_BOT_MITIGATION_ENABLED;
    delete process.env.WEBCHAT_MIN_INIT_ELAPSED_MS;
  });

  afterEach(() => {
    process.env = oldEnv;
  });

  it('should allow everything when mitigation is disabled', () => {
    process.env.WEBCHAT_BOT_MITIGATION_ENABLED = 'false';

    const result = validateWebchatBotSignals({
      stage: 'init',
      signals: { honeypot: 'bot', elapsedMs: 10 }
    });

    expect(result.allowed).toBe(true);
  });

  it('should block when honeypot is triggered', () => {
    const result = validateWebchatBotSignals({
      stage: 'message',
      signals: { honeypot: '  some-value  ' }
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('honeypot_triggered');
  });

  it('should block when init happens too fast (default threshold)', () => {
    const result = validateWebchatBotSignals({
      stage: 'init',
      signals: { elapsedMs: 500 } // Default is 800
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('interaction_too_fast');
  });

  it('should allow when init is slow enough (default threshold)', () => {
    const result = validateWebchatBotSignals({
      stage: 'init',
      signals: { elapsedMs: 900 }
    });

    expect(result.allowed).toBe(true);
  });

  it('should respect custom WEBCHAT_MIN_INIT_ELAPSED_MS', () => {
    process.env.WEBCHAT_MIN_INIT_ELAPSED_MS = '2000';

    const tooFast = validateWebchatBotSignals({
      stage: 'init',
      signals: { elapsedMs: 1500 }
    });
    expect(tooFast.allowed).toBe(false);

    const slowEnough = validateWebchatBotSignals({
      stage: 'init',
      signals: { elapsedMs: 2500 }
    });
    expect(slowEnough.allowed).toBe(true);
  });

  it('should NOT block based on time in "message" stage', () => {
    const result = validateWebchatBotSignals({
      stage: 'message',
      signals: { elapsedMs: 100 }
    });

    expect(result.allowed).toBe(true);
  });

  it('should handle missing or malformed signals gracefully', () => {
    expect(validateWebchatBotSignals({ stage: 'init' }).allowed).toBe(true);
    expect(validateWebchatBotSignals({ stage: 'init', signals: null }).allowed).toBe(true);
    expect(validateWebchatBotSignals({ stage: 'init', signals: { elapsedMs: NaN } }).allowed).toBe(true);
    expect(validateWebchatBotSignals({ stage: 'init', signals: { honeypot: null as any } }).allowed).toBe(true);
  });
});
