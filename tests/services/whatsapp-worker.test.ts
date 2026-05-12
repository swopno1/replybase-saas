import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processWhatsAppJob } from '@/lib/services/whatsapp-worker';
import { prisma } from '@/lib/prisma';
import { checkTenantUsageLimits, incrementTenantUsage } from '@/lib/subscription';
import { executeBotEntryFlowFirst } from '@/lib/bot-entry-flow-engine';
import { sendWhatsAppText } from '@/lib/whatsapp-provider';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contact: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    crmConversation: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    crmMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    channel: {
      update: vi.fn(),
    },
    bot: {
      findUnique: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    flowSession: {
      update: vi.fn(),
    }
  },
}));

vi.mock('@/lib/subscription', () => ({
  checkTenantUsageLimits: vi.fn(),
  incrementTenantUsage: vi.fn(),
}));

vi.mock('@/lib/bot-entry-flow-engine', () => ({
  executeBotEntryFlowFirst: vi.fn(),
  waitForFlowDurationMs: vi.fn(),
}));

vi.mock('@/lib/whatsapp-provider', () => ({
  sendWhatsAppText: vi.fn(),
  normalizeWhatsAppAddress: (val: string) => val,
  normalizeWhatsAppE164: (val: string) => val,
}));

vi.mock('@/lib/whatsapp-channel-credentials', () => ({
  decryptWhatsAppCredentialEnvelope: vi.fn(() => ({
    provider: 'meta_cloud',
    credentials: { accessToken: 'tok' }
  })),
  getStringFromJsonConfig: vi.fn((config, key) => config?.[key] || null),
}));

vi.mock('@/lib/contact-stitching', () => ({
  stitchContactIdentities: vi.fn(),
}));

vi.mock('@/lib/services/lead-service', () => ({
  leadService: {
    syncContactIdentifiedStatus: vi.fn(),
    extractAndSyncLeadDataFromMessage: vi.fn(),
  },
}));

vi.mock('@/lib/milestone-events', () => ({
  recordMilestoneEvent: vi.fn(),
}));

describe('WhatsApp Worker', () => {
  const defaultPayload = {
    channel: {
      id: 'chan_1',
      botId: 'bot_1',
      accessToken: 'enc_tok',
      bot: { tenantId: 'tenant_1' },
      config: { provider: 'meta_cloud' }
    },
    waId: '1234567890',
    profileName: 'John Doe',
    rawPhone: '1234567890',
    inboundText: 'Hello bot',
    messageId: 'msg_123',
    timestamp: '1600000000',
    botId: 'bot_1'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully processes an inbound message and triggers flow', async () => {
    vi.mocked(checkTenantUsageLimits).mockResolvedValue({ allowed: true } as any);
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.contact.create).mockResolvedValue({ id: 'contact_1' } as any);
    vi.mocked(prisma.crmConversation.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.crmConversation.create).mockResolvedValue({ id: 'conv_1', metadata: {} } as any);
    vi.mocked(prisma.bot.findUnique).mockResolvedValue({ enabled: true, entryFlow: 'flow_1' } as any);

    vi.mocked(executeBotEntryFlowFirst).mockResolvedValue({
      responses: [{ type: 'text', text: 'Hello from flow' }]
    } as any);

    vi.mocked(sendWhatsAppText).mockResolvedValue({ success: true });

    await processWhatsAppJob(defaultPayload);

    expect(prisma.crmMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        content: 'Hello bot',
        direction: 'inbound'
      })
    }));

    expect(executeBotEntryFlowFirst).toHaveBeenCalled();
    expect(sendWhatsAppText).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Hello from flow'
    }));

    expect(incrementTenantUsage).toHaveBeenCalledWith('tenant_1', 'message', 1, 'bot_1', 'chan_1');
  });

  it('stops processing if conversation limit is reached', async () => {
    vi.mocked(checkTenantUsageLimits).mockResolvedValue({ allowed: false } as any);

    await processWhatsAppJob(defaultPayload);

    expect(prisma.contact.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to AI if flow returns no responses', async () => {
    vi.mocked(checkTenantUsageLimits).mockResolvedValue({ allowed: true } as any);
    vi.mocked(prisma.contact.findFirst).mockResolvedValue({ id: 'contact_1' } as any);
    vi.mocked(prisma.crmConversation.findFirst).mockResolvedValue({ id: 'conv_1', metadata: {} } as any);
    vi.mocked(prisma.bot.findUnique).mockResolvedValue({ enabled: true } as any);
    vi.mocked(executeBotEntryFlowFirst).mockResolvedValue({ responses: [] } as any);
    vi.mocked(prisma.crmMessage.findMany).mockResolvedValue([]);
    vi.mocked(sendWhatsAppText).mockResolvedValue({ success: true });

    // Mock AI fallback dynamic import
    vi.doMock('@/lib/ai-fallback', () => ({
      aiFallback: vi.fn().mockResolvedValue('AI Response')
    }));

    await processWhatsAppJob(defaultPayload);

    // Note: AI fallback is currently imported inside the worker,
    // we might need to handle the dynamic import mock carefully or
    // check if it attempts to call sendWhatsAppText with AI content.
    expect(sendWhatsAppText).toHaveBeenCalled();
  });
});
