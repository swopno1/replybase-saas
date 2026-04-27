import { describe, it, expect } from 'vitest';
import { createWebchatSessionToken, verifyWebchatSessionToken } from '@/lib/webchat-session';

describe('Webchat Session', () => {
  const secret = 'test-secret';
  const oldEnv = process.env;

  beforeEach(() => {
    process.env = { ...oldEnv, WEBCHAT_TOKEN_SECRET: secret };
  });

  afterEach(() => {
    process.env = oldEnv;
  });

  it('should create and verify a valid token', () => {
    const params = {
      channelId: 'ch_1',
      botId: 'bot_1',
      tenantId: 'tenant_1',
      conversationId: 'conv_1',
      visitorId: 'vis_1',
    };

    const token = createWebchatSessionToken(params);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decoded = verifyWebchatSessionToken(token);
    expect(decoded).toMatchObject(params);
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('should throw error for expired token', () => {
    const token = createWebchatSessionToken({
      channelId: 'ch_1',
      botId: 'bot_1',
      tenantId: 'tenant_1',
      conversationId: 'conv_1',
      visitorId: 'vis_1',
      ttlSeconds: -10,
    });

    expect(() => verifyWebchatSessionToken(token)).toThrow('Token expired');
  });

  it('should throw error for invalid signature', () => {
    const token = createWebchatSessionToken({
      channelId: 'ch_1',
      botId: 'bot_1',
      tenantId: 'tenant_1',
      conversationId: 'conv_1',
      visitorId: 'vis_1',
    });

    const tamperedToken = token.substring(0, token.length - 1) + (token.endsWith('a') ? 'b' : 'a');
    expect(() => verifyWebchatSessionToken(tamperedToken)).toThrow('Invalid token signature');
  });

  it('should throw error for malformed token', () => {
    expect(() => verifyWebchatSessionToken('invalid-token')).toThrow('Invalid token format');
  });
});
