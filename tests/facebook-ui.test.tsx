/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import FacebookIntegrationRedirect from '../app/(dashboard)/integrations/facebook/page';
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
  usePathname: () => '/integrations/facebook',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('Facebook Integration Redirect UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should redirect if only one bot exists', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/bots')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            bots: [{ id: 'bot-123', name: 'Test Bot' }]
          }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });

    render(<FacebookIntegrationRedirect />);

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/bots/bot-123?tab=channels&channel=facebook');
    }, { timeout: 5000 });
  });

  it('should show bot selector if multiple bots exist', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/bots')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            bots: [
              { id: 'bot-1', name: 'Bot 1' },
              { id: 'bot-2', name: 'Bot 2' }
            ]
          }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });

    const { container } = render(<FacebookIntegrationRedirect />);

    await waitFor(() => {
      expect(container.textContent).toContain('Select Bot');
    }, { timeout: 5000 });
  });
});
