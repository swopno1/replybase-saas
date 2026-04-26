import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyWebhookSignature, generateAppSecretProof, getFacebookGraphUrl } from '../lib/server/facebook-utils';
import { FACEBOOK_GRAPH_API_VERSION, FACEBOOK_BASE_URL } from '../lib/meta-config';

describe('Facebook Security Hardening', () => {
  const appSecret = 'test_app_secret';
  const accessToken = 'test_access_token';
  const payload = JSON.stringify({ object: 'page', entry: [] });

  describe('verifyWebhookSignature', () => {
    it('should validate a correct sha256 signature', () => {
      const crypto = require('crypto');
      const signature = 'sha256=' + crypto
        .createHmac('sha256', appSecret)
        .update(payload)
        .digest('hex');

      expect(verifyWebhookSignature(payload, signature, appSecret)).toBe(true);
    });

    it('should reject an incorrect signature', () => {
      expect(verifyWebhookSignature(payload, 'sha256=wrong', appSecret)).toBe(false);
    });

    it('should reject a signature with wrong algorithm', () => {
      expect(verifyWebhookSignature(payload, 'sha1=abcdef', appSecret)).toBe(false);
    });
  });

  describe('generateAppSecretProof', () => {
    it('should generate a valid hmac hex string', () => {
      const proof = generateAppSecretProof(accessToken, appSecret);
      expect(proof).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('getFacebookGraphUrl', () => {
    beforeEach(() => {
      process.env.FACEBOOK_CLIENT_SECRET = appSecret;
    });

    it('should include the centralized API version', () => {
      const url = getFacebookGraphUrl('me/messages', accessToken);
      expect(url).toContain(FACEBOOK_GRAPH_API_VERSION);
      expect(url).toContain(FACEBOOK_BASE_URL);
    });

    it('should include appsecret_proof automatically', () => {
      const url = getFacebookGraphUrl('me/messages', accessToken);
      const proof = generateAppSecretProof(accessToken, appSecret);
      expect(url).toContain(`appsecret_proof=${proof}`);
    });

    it('should include additional search parameters', () => {
      const url = getFacebookGraphUrl('me/accounts', accessToken, { fields: 'name,id' });
      expect(url).toContain('fields=name%2Cid');
      expect(url).toContain('access_token=' + accessToken);
    });
  });
});
