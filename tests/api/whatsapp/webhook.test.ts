import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '@/app/api/whatsapp/webhook/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { messageQueue } from '@/lib/queue';
import { decryptWhatsAppCredentialEnvelope } from '@/lib/whatsapp-channel-credentials';
import { verifyWebhookSignature, verifyTwilioSignature } from '@/lib/whatsapp-provider';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    channel: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    webhookLog: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/queue', () => ({
  messageQueue: {
    add: vi.fn(),
  },
}));

vi.mock('@/lib/whatsapp-channel-credentials', () => ({
  decryptWhatsAppCredentialEnvelope: vi.fn(),
}));

vi.mock('@/lib/whatsapp-provider', () => ({
  verifyWebhookSignature: vi.fn(),
  verifyTwilioSignature: vi.fn(),
  normalizeWhatsAppE164: (val: string) => val,
  normalizeWhatsAppAddress: (val: string) => val,
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('WhatsApp Webhook API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'test_token';
  });

  describe('GET /api/whatsapp/webhook', () => {
    it('verifies the webhook successfully', async () => {
      const url = new URL('http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test_token&hub.challenge=1234');
      const req = new NextRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('1234');
    });

    it('returns 403 on invalid token', async () => {
      const url = new URL('http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=1234');
      const req = new NextRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/whatsapp/webhook (Meta)', () => {
    const metaPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            metadata: { phone_number_id: '12345' },
            messages: [{
              from: '1234567890',
              id: 'msg_123',
              timestamp: '1600000000',
              type: 'text',
              text: { body: 'Hello' }
            }]
          }
        }]
      }]
    };

    it('processes a valid Meta message', async () => {
      vi.mocked(prisma.channel.findFirst).mockResolvedValue({
        id: 'chan_1',
        botId: 'bot_1',
        accessToken: 'enc_token',
        bot: { tenantId: 'tenant_1' }
      } as any);

      vi.mocked(decryptWhatsAppCredentialEnvelope).mockReturnValue({
        provider: 'meta_cloud',
        credentials: { appSecret: 'secret' }
      } as any);

      vi.mocked(verifyWebhookSignature).mockReturnValue(true);

      const req = new NextRequest('http://localhost', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': 'sha256=valid_sig'
        },
        body: JSON.stringify(metaPayload)
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(messageQueue.add).toHaveBeenCalledWith(
        'whatsapp-message',
        expect.objectContaining({
          botId: 'bot_1',
          payload: expect.objectContaining({
            messageId: 'msg_123',
            inboundText: 'Hello'
          })
        }),
        { jobId: 'whatsapp:msg_123' }
      );
    });

    it('returns 403 on invalid Meta signature', async () => {
      vi.mocked(prisma.channel.findFirst).mockResolvedValue({
        id: 'chan_1',
        botId: 'bot_1',
        accessToken: 'enc_token',
        bot: { tenantId: 'tenant_1' }
      } as any);

      vi.mocked(decryptWhatsAppCredentialEnvelope).mockReturnValue({
        provider: 'meta_cloud',
        credentials: { appSecret: 'secret' }
      } as any);

      vi.mocked(verifyWebhookSignature).mockReturnValue(false);

      const req = new NextRequest('http://localhost', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': 'sha256=invalid_sig'
        },
        body: JSON.stringify(metaPayload)
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/whatsapp/webhook (Twilio)', () => {
    it('processes a valid Twilio message', async () => {
      vi.mocked(prisma.channel.findFirst).mockResolvedValue({
        id: 'chan_2',
        botId: 'bot_2',
        accessToken: 'enc_token_twilio',
        bot: { tenantId: 'tenant_2' }
      } as any);

      vi.mocked(decryptWhatsAppCredentialEnvelope).mockReturnValue({
        provider: 'twilio',
        credentials: { authToken: 'tw_secret' }
      } as any);

      vi.mocked(verifyTwilioSignature).mockReturnValue(true);

      const params = new URLSearchParams({
        To: '+12345',
        From: '+67890',
        Body: 'Hi Twilio',
        MessageSid: 'SM123'
      });

      const req = new NextRequest('http://localhost/api/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'valid_tw_sig'
        },
        body: params.toString()
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(messageQueue.add).toHaveBeenCalledWith(
        'whatsapp-message',
        expect.objectContaining({
          botId: 'bot_2',
          payload: expect.objectContaining({
            messageId: 'SM123',
            inboundText: 'Hi Twilio'
          })
        }),
        { jobId: 'whatsapp:SM123' }
      );
    });
  });
});
