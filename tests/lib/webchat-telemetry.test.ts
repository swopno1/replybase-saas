import { describe, it, expect, vi } from 'vitest';
import {
  normalizeWebchatTelemetryPayload,
  shouldSampleWebchatTelemetry,
  getWebchatTelemetryConfig
} from '@/lib/webchat-telemetry';

describe('Webchat Telemetry', () => {
  describe('normalizeWebchatTelemetryPayload', () => {
    it('should normalize OPEN event', () => {
      const payload = normalizeWebchatTelemetryPayload('OPEN', { url: 'https://example.com', trigger: 'button' });
      expect(payload).toMatchObject({
        eventName: 'open',
        category: 'lifecycle',
        url: 'https://example.com',
        trigger: 'button'
      });
    });

    it('should normalize MESSAGE event', () => {
      const payload = normalizeWebchatTelemetryPayload('MESSAGE', { url: 'https://example.com', direction: 'in', messageLength: 10 });
      expect(payload).toMatchObject({
        eventName: 'message',
        category: 'engagement',
        direction: 'in',
        messageLength: 10
      });
    });

    it('should handle missing payload fields', () => {
      const payload = normalizeWebchatTelemetryPayload('ERROR', {});
      expect(payload).toMatchObject({
        eventName: 'error',
        category: 'diagnostic',
        url: null
      });
    });
  });

  describe('sampling logic', () => {
    it('should always sample 1.0 rate events', () => {
      expect(shouldSampleWebchatTelemetry('OPEN')).toBe(true);
      expect(shouldSampleWebchatTelemetry('MESSAGE')).toBe(true);
      expect(shouldSampleWebchatTelemetry('ERROR')).toBe(true);
    });

    it('should respect partial sample rates', () => {
      // Mock Math.random to test sampling
      const spy = vi.spyOn(Math, 'random');

      spy.mockReturnValue(0.1);
      expect(shouldSampleWebchatTelemetry('TYPING')).toBe(true); // rate is 0.25

      spy.mockReturnValue(0.3);
      expect(shouldSampleWebchatTelemetry('TYPING')).toBe(false);

      spy.mockRestore();
    });
  });

  describe('config', () => {
    it('should return valid config object', () => {
      const config = getWebchatTelemetryConfig();
      expect(config.taxonomyVersion).toBeDefined();
      expect(config.sampleRates.TYPING).toBe(0.25);
    });
  });
});
