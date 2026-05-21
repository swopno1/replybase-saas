import { describe, it, expect, vi } from 'vitest';
import { prismaMock } from '../mocks/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

import {
  interpolateText,
  normalizeDurationMs,
  evaluateCondition,
  waitForFlowDurationMs,
  getNextNode,
  getNodeByOrder,
  getRuntimeState,
  setRuntimeState,
  createInitialRuntimeState,
  loadAccessibleFlow,
  resolveReferencedFlow,
  resumeParentFlow,
} from '@/lib/flow-runtime-utils';

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

    it('should return fallback for objects and arrays', () => {
      expect(normalizeDurationMs({}, 500)).toBe(500);
      expect(normalizeDurationMs([], 500)).toBe(500);
    });

    it('should handle custom max values', () => {
      expect(normalizeDurationMs(10000, 0, 20000)).toBe(10000);
      expect(normalizeDurationMs(30000, 0, 20000)).toBe(20000);
    });

    it('should handle non-integer max values', () => {
      expect(normalizeDurationMs(100, 0, 50.5)).toBe(50.5);
    });

    it('should return non-numeric fallback as-is', () => {
      expect(normalizeDurationMs('invalid', 'fallback' as any)).toBe('fallback');
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

      it('should handle boolean values', () => {
        expect(evaluateCondition(true, 'equals', 'true')).toBe(true);
        expect(evaluateCondition(false, 'equals', 'false')).toBe(true);
        expect(evaluateCondition(true, 'equals', 'false')).toBe(false);
      });

      it('should handle null and undefined', () => {
        expect(evaluateCondition(null, 'equals', 'null')).toBe(true);
        expect(evaluateCondition(undefined, 'equals', 'undefined')).toBe(true);
        expect(evaluateCondition(null, 'equals', '')).toBe(false);
      });

      it('should handle empty strings', () => {
        expect(evaluateCondition('', 'equals', '')).toBe(true);
        expect(evaluateCondition(' ', 'equals', ' ')).toBe(true);
      });
    });

    describe('contains', () => {
      it('should return true if value contains compareValue (case-insensitive)', () => {
        expect(evaluateCondition('Hello World', 'contains', 'world')).toBe(true);
      });

      it('should return false if value does not contain compareValue', () => {
        expect(evaluateCondition('Hello World', 'contains', 'foo')).toBe(false);
      });

      it('should handle boolean values', () => {
        expect(evaluateCondition(true, 'contains', 'ru')).toBe(true);
        expect(evaluateCondition(false, 'contains', 'al')).toBe(true);
      });

      it('should handle null and undefined', () => {
        expect(evaluateCondition(null, 'contains', 'ul')).toBe(true);
        expect(evaluateCondition(undefined, 'contains', 'def')).toBe(true);
      });

      it('should handle empty strings', () => {
        expect(evaluateCondition('', 'contains', '')).toBe(true);
        expect(evaluateCondition('a', 'contains', '')).toBe(true);
        expect(evaluateCondition('', 'contains', 'a')).toBe(false);
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

      it('should handle invalid numeric strings', () => {
        expect(evaluateCondition('abc', 'greater_than', '5')).toBe(false);
        expect(evaluateCondition('10', 'greater_than', 'xyz')).toBe(false);
      });

      it('should handle null and undefined', () => {
        expect(evaluateCondition(null, 'greater_than', '0')).toBe(false); // Number(null) is 0
        expect(evaluateCondition(null, 'greater_than', '-1')).toBe(true);
        expect(evaluateCondition(undefined, 'greater_than', '0')).toBe(false); // Number(undefined) is NaN
      });

      it('should handle boolean values', () => {
        expect(evaluateCondition(true, 'greater_than', '0')).toBe(true); // Number(true) is 1
        expect(evaluateCondition(false, 'greater_than', '0')).toBe(false); // Number(false) is 0
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

      it('should handle invalid numeric strings', () => {
        expect(evaluateCondition('abc', 'less_than', '5')).toBe(false);
        expect(evaluateCondition('5', 'less_than', 'xyz')).toBe(false);
      });

      it('should handle null and undefined', () => {
        expect(evaluateCondition(null, 'less_than', '1')).toBe(true); // Number(null) is 0
        expect(evaluateCondition(null, 'less_than', '0')).toBe(false);
        expect(evaluateCondition(undefined, 'less_than', '1')).toBe(false); // Number(undefined) is NaN
      });

      it('should handle boolean values', () => {
        expect(evaluateCondition(true, 'less_than', '2')).toBe(true); // Number(true) is 1
        expect(evaluateCondition(false, 'less_than', '1')).toBe(true); // Number(false) is 0
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

  describe('getNextNode', () => {
    const nodes = [
      { id: '1', order: 1 } as any,
      { id: '2', order: 2 } as any,
      { id: '3', order: 3 } as any,
    ];

    it('should return the next node sequentially if explicitNextOrder is not provided', () => {
      expect(getNextNode(nodes, 1)).toEqual(nodes[1]);
      expect(getNextNode(nodes, 2)).toEqual(nodes[2]);
    });

    it('should return the node with explicitNextOrder if provided', () => {
      expect(getNextNode(nodes, 1, 3)).toEqual(nodes[2]);
    });

    it('should return null if no node matches the target order', () => {
      expect(getNextNode(nodes, 3)).toBeNull();
      expect(getNextNode(nodes, 1, 5)).toBeNull();
    });
  });

  describe('getNodeByOrder', () => {
    const nodes = [
      { id: '1', order: 1 } as any,
      { id: '2', order: 2 } as any,
    ];

    it('should return the node with the specified order', () => {
      expect(getNodeByOrder(nodes, 1)).toEqual(nodes[0]);
      expect(getNodeByOrder(nodes, 2)).toEqual(nodes[1]);
    });

    it('should return null if order is null or undefined', () => {
      expect(getNodeByOrder(nodes, null)).toBeNull();
      expect(getNodeByOrder(nodes, undefined)).toBeNull();
    });

    it('should return null if no node matches the order', () => {
      expect(getNodeByOrder(nodes, 3)).toBeNull();
    });
  });

  describe('createInitialRuntimeState', () => {
    it('should create initial runtime state with provided flowId', () => {
      const flowId = 'flow_1';
      const state = createInitialRuntimeState(flowId);
      expect(state).toEqual({
        rootFlowId: flowId,
        activeFlowId: flowId,
        callStack: [],
      });
    });
  });

  describe('setRuntimeState', () => {
    it('should set the runtime state on the variables object', () => {
      const variables: any = {};
      const runtime = {
        rootFlowId: 'root',
        activeFlowId: 'active',
        callStack: [],
      };
      setRuntimeState(variables, runtime);
      expect(variables.__runtime).toEqual(runtime);
    });
  });

  describe('getRuntimeState', () => {
    const fallbackFlowId = 'fallback';

    it('should return the runtime state from variables if valid', () => {
      const runtime = {
        rootFlowId: 'root',
        activeFlowId: 'active',
        callStack: [{ flowId: 'parent', nextNodeOrder: 5 }],
      };
      const variables = { __runtime: runtime };
      expect(getRuntimeState(variables, fallbackFlowId)).toEqual(runtime);
    });

    it('should fallback to provided flowId if __runtime is missing', () => {
      const variables = {};
      expect(getRuntimeState(variables, fallbackFlowId)).toEqual({
        rootFlowId: fallbackFlowId,
        activeFlowId: fallbackFlowId,
        callStack: [],
      });
    });

    it('should fallback if __runtime is null or not an object', () => {
      expect(getRuntimeState({ __runtime: null }, fallbackFlowId)).toEqual({
        rootFlowId: fallbackFlowId,
        activeFlowId: fallbackFlowId,
        callStack: [],
      });
      expect(getRuntimeState({ __runtime: 'invalid' as any }, fallbackFlowId)).toEqual({
        rootFlowId: fallbackFlowId,
        activeFlowId: fallbackFlowId,
        callStack: [],
      });
      expect(getRuntimeState({ __runtime: [] as any }, fallbackFlowId)).toEqual({
        rootFlowId: fallbackFlowId,
        activeFlowId: fallbackFlowId,
        callStack: [],
      });
    });

    it('should handle partial runtime state by using defaults', () => {
      const partialRuntime = {
        activeFlowId: 'active',
      };
      const variables = { __runtime: partialRuntime as any };
      expect(getRuntimeState(variables, fallbackFlowId)).toEqual({
        rootFlowId: fallbackFlowId,
        activeFlowId: 'active',
        callStack: [],
      });
    });
  });

  describe('database interactive utilities', () => {
    describe('loadAccessibleFlow', () => {
      it('should query prisma.flow.findFirst with correct parameters', async () => {
        const mockFlow = { id: 'flow-123', tenantId: 'tenant-123', name: 'Flow Name', nodes: [] };
        prismaMock.flow.findFirst.mockResolvedValue(mockFlow as any);

        const result = await loadAccessibleFlow({ tenantId: 'tenant-123', flowId: 'flow-123' });

        expect(result).toEqual(mockFlow);
        expect(prismaMock.flow.findFirst).toHaveBeenCalledWith({
          where: {
            id: 'flow-123',
            OR: [{ tenantId: 'tenant-123' }, { isGlobal: true }],
          },
          include: {
            nodes: {
              orderBy: { order: 'asc' },
            },
          },
        });
      });
    });

    describe('resolveReferencedFlow', () => {
      it('should look up by targetFlowId if provided', async () => {
        const mockFlow = { id: 'flow-id', tenantId: 'tenant-123', nodes: [] };
        prismaMock.flow.findFirst.mockResolvedValue(mockFlow as any);

        const result = await resolveReferencedFlow({
          tenantId: 'tenant-123',
          targetFlowId: 'flow-id',
        });

        expect(result).toEqual(mockFlow);
        expect(prismaMock.flow.findFirst).toHaveBeenCalledWith({
          where: {
            OR: [{ tenantId: 'tenant-123' }, { isGlobal: true }],
            id: 'flow-id',
          },
          include: {
            nodes: {
              orderBy: { order: 'asc' },
            },
          },
        });
      });

      it('should look up by targetFlowName if targetFlowId is not provided', async () => {
        const mockFlow = { id: 'flow-id', tenantId: 'tenant-123', name: 'flow-name', nodes: [] };
        prismaMock.flow.findFirst.mockResolvedValue(mockFlow as any);

        const result = await resolveReferencedFlow({
          tenantId: 'tenant-123',
          targetFlowName: 'flow-name',
        });

        expect(result).toEqual(mockFlow);
        expect(prismaMock.flow.findFirst).toHaveBeenCalledWith({
          where: {
            OR: [{ tenantId: 'tenant-123' }, { isGlobal: true }],
            name: 'flow-name',
          },
          include: {
            nodes: {
              orderBy: { order: 'asc' },
            },
          },
        });
      });

      it('should return null if neither targetFlowId nor targetFlowName is provided', async () => {
        const result = await resolveReferencedFlow({ tenantId: 'tenant-123' });
        expect(result).toBeNull();
        expect(prismaMock.flow.findFirst).not.toHaveBeenCalled();
      });
    });

    describe('resumeParentFlow', () => {
      it('should return null if callStack is empty', async () => {
        const runtime = {
          rootFlowId: 'root',
          activeFlowId: 'active',
          callStack: [],
        };

        const result = await resumeParentFlow({ tenantId: 'tenant-123', runtime });
        expect(result).toBeNull();
      });

      it('should pop parent frame, fetch parent flow, update activeFlowId, and return flow and next node', async () => {
        const parentNode = { id: 'node-2', order: 2 };
        const parentFlow = {
          id: 'parent-flow-id',
          nodes: [
            { id: 'node-1', order: 1 },
            parentNode,
          ],
        };
        prismaMock.flow.findFirst.mockResolvedValue(parentFlow as any);

        const runtime = {
          rootFlowId: 'root',
          activeFlowId: 'active',
          callStack: [
            { flowId: 'parent-flow-id', nextNodeOrder: 2 },
          ],
        };

        const result = await resumeParentFlow({ tenantId: 'tenant-123', runtime });

        expect(result).toEqual({
          flow: parentFlow,
          node: parentNode,
        });
        expect(runtime.activeFlowId).toBe('parent-flow-id');
        expect(runtime.callStack).toHaveLength(0);
        expect(prismaMock.flow.findFirst).toHaveBeenCalledWith({
          where: {
            id: 'parent-flow-id',
            OR: [{ tenantId: 'tenant-123' }, { isGlobal: true }],
          },
          include: {
            nodes: {
              orderBy: { order: 'asc' },
            },
          },
        });
      });

      it('should return null if parent flow is not found in database', async () => {
        prismaMock.flow.findFirst.mockResolvedValue(null);

        const runtime = {
          rootFlowId: 'root',
          activeFlowId: 'active',
          callStack: [
            { flowId: 'parent-flow-id', nextNodeOrder: 2 },
          ],
        };

        const result = await resumeParentFlow({ tenantId: 'tenant-123', runtime });
        expect(result).toBeNull();
      });
    });
  });
});
