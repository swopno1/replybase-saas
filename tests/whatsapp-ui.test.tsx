/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import { WhatsAppConfig } from '../components/channels/whatsapp-config';
import React from 'react';

// Define stable mocks
const { mockRouter } = vi.hoisted(() => ({
  mockRouter: {
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/bots/bot-123',
}));

vi.mock('@/components/ui/confirmation-provider', () => ({
  useConfirmation: vi.fn(() => ({
    confirm: vi.fn(),
    alert: vi.fn(),
  })),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('WhatsApp Integration UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render WhatsApp configuration when provided with a botId', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/channels/whatsapp/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ connected: false }),
        } as Response);
      }
      if (url.includes('/api/flows')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ flows: [] }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });

    render(<WhatsAppConfig botId="bot-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Provider Configuration/i)).toBeTruthy();
    });
  });
});
