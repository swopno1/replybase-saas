import { describe, it, expect } from 'vitest';
import { interpolateText, normalizeDurationMs, evaluateCondition, waitForFlowDurationMs } from '@/lib/flow-runtime-utils';

describe('flow-runtime-utils', () => {
  describe('interpolateText', () => {
    it('should interpolate a single variable', () => {
      const text = 'Hello {{name}}!';
      const variables = { name: 'Jules' };
      expect(interpolateText(text, variables)).toBe('Hello Jules!');
    });

    it('should interpolate multiple variables', () => {
      const text = '{{greet}} {{name}}!';
      const variables = { greet: 'Hi', name: 'Jules' };
      expect(interpolateText(text, variables)).toBe('Hi Jules!');
    });

    it('should handle whitespace in tags', () => {
      const text = 'Hello {{  name  }}!';
      const variables = { name: 'Jules' };
      expect(interpolateText(text, variables)).toBe('Hello Jules!');
    });

    it('should return an empty string for missing variables', () => {
      const text = 'Hello {{unknown}}!';
      const variables = {};
      expect(interpolateText(text, variables)).toBe('Hello !');
    });

    it('should return an empty string for null or undefined values', () => {
      const text = '{{nullVar}} {{undefinedVar}}';
      const variables = { nullVar: null, undefinedVar: undefined };
      expect(interpolateText(text, variables)).toBe(' ');
    });

    it('should convert non-string values to strings', () => {
      const text = 'Count: {{count}}, Active: {{active}}';
      const variables = { count: 42, active: true };
      expect(interpolateText(text, variables)).toBe('Count: 42, Active: true');
    });

    it('should support dot in variable names (literal match)', () => {
      const text = 'User: {{user.name}}';
      const variables = { 'user.name': 'Jules' };
      expect(interpolateText(text, variables)).toBe('User: Jules');
    });
  });

  describe('normalizeDurationMs', () => {
    it('should return the value if it is a valid number within range', () => {
      expect(normalizeDurationMs(1000)).toBe(1000);
    });

    it('should return fallback if value is not a number', () => {
      expect(normalizeDurationMs('1000', 500)).toBe(500);
      expect(normalizeDurationMs(null, 500)).toBe(500);
      expect(normalizeDurationMs(undefined, 500)).toBe(500);
    });

    it('should use default fallback 0 if not provided', () => {
      expect(normalizeDurationMs('1000')).toBe(0);
      expect(normalizeDurationMs(null)).toBe(0);
      expect(normalizeDurationMs(undefined)).toBe(0);
    });

    it('should return fallback if value is NaN or Infinite', () => {
      expect(normalizeDurationMs(NaN, 500)).toBe(500);
      expect(normalizeDurationMs(Infinity, 500)).toBe(500);
    });

    it('should clamp value to 0 if negative', () => {
      expect(normalizeDurationMs(-100)).toBe(0);
    });

    it('should clamp value to max if it exceeds max', () => {
      expect(normalizeDurationMs(6000, 0, 5000)).toBe(5000);
    });

    it('should use default max 5000 if not provided', () => {
      expect(normalizeDurationMs(6000)).toBe(5000);
    });

    it('should round the value', () => {
      expect(normalizeDurationMs(100.6)).toBe(101);
      expect(normalizeDurationMs(100.4)).toBe(100);
    });
  });

  describe('evaluateCondition', () => {
    describe('equals', () => {
      it('should return true for equal strings (case-insensitive)', () => {
        expect(evaluateCondition('Hello', 'equals', 'hello')).toBe(true);
      });

      it('should return false for unequal strings', () => {
        expect(evaluateCondition('Hello', 'equals', 'world')).toBe(false);
      });

      it('should work with numbers', () => {
        expect(evaluateCondition(123, 'equals', '123')).toBe(true);
      });
    });

    describe('contains', () => {
      it('should return true if value contains compareValue (case-insensitive)', () => {
        expect(evaluateCondition('Hello World', 'contains', 'world')).toBe(true);
      });

      it('should return false if value does not contain compareValue', () => {
        expect(evaluateCondition('Hello World', 'contains', 'foo')).toBe(false);
      });
    });

    describe('greater_than', () => {
      it('should return true if value is greater than compareValue', () => {
        expect(evaluateCondition(10, 'greater_than', '5')).toBe(true);
        expect(evaluateCondition('10', 'greater_than', '5')).toBe(true);
      });

      it('should return false if value is not greater than compareValue', () => {
        expect(evaluateCondition(5, 'greater_than', '10')).toBe(false);
        expect(evaluateCondition(10, 'greater_than', '10')).toBe(false);
      });
    });

    describe('less_than', () => {
      it('should return true if value is less than compareValue', () => {
        expect(evaluateCondition(5, 'less_than', '10')).toBe(true);
        expect(evaluateCondition('5', 'less_than', '10')).toBe(true);
      });

      it('should return false if value is not less than compareValue', () => {
        expect(evaluateCondition(10, 'less_than', '5')).toBe(false);
        expect(evaluateCondition(10, 'less_than', '10')).toBe(false);
      });
    });

    it('should return false for unknown operator', () => {
      expect(evaluateCondition('test', 'unknown', 'test')).toBe(false);
    });
  });

  describe('waitForFlowDurationMs', () => {
    it('should resolve immediately if duration is 0 or less', async () => {
      const start = Date.now();
      await waitForFlowDurationMs(0);
      await waitForFlowDurationMs(-100);
      const end = Date.now();
      expect(end - start).toBeLessThan(10);
    });

    it('should wait for the specified duration', async () => {
      const start = Date.now();
      await waitForFlowDurationMs(50);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(40); // allow small timing variations
    });
  });
});
