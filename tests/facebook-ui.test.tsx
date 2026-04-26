/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FacebookIntegrationPage from '../app/(dashboard)/integrations/facebook/page';
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
}));

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
}));

vi.mock('@/components/ui/confirmation-provider', () => ({
  useConfirmation: vi.fn(() => ({
    confirm: vi.fn(),
  })),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/lib/channel-config', () => ({
  isChannelVisibleInUi: vi.fn(() => true),
  isChannelEnabled: vi.fn(() => true),
}));

describe('Facebook Integration UI Compliance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render branding and display required legal links when not connected', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/integrations/facebook/pages')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ connected: false, pages: [] }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });

    const { container } = render(<FacebookIntegrationPage />);

    // Wait for the button by searching for its class or text
    await waitFor(() => {
      const button = container.querySelector('button.bg-\\[\\#1877F2\\]');
      if (!button) throw new Error('Button not found');
      expect(button.textContent).toContain('Continue with Facebook');
    }, { timeout: 5000 });

    const privacyLink = container.querySelector('a[href="https://replybase.co.uk/privacy"]');
    const termsLink = container.querySelector('a[href="https://replybase.co.uk/terms"]');

    expect(privacyLink).not.toBeNull();
    expect(termsLink).not.toBeNull();
    expect(privacyLink?.textContent).toContain('Privacy Policy');
    expect(termsLink?.textContent).toContain('Terms of Service');
  });

  it('should render diagnostic button and handle connection check when connected', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/integrations/facebook/pages')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            connected: true,
            pages: [
              {
                id: '123',
                name: 'Test Page',
                connected: true,
                webhookSubscribed: true,
                category: 'Test Category'
              }
            ]
          }),
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

    const { container } = render(<FacebookIntegrationPage />);

    // Should find "Check Connection" button (it has title="Check Connection")
    await waitFor(() => {
      const checkButton = container.querySelector('button[title="Check Connection"]');
      if (!checkButton) throw new Error('Check Connection button not found');
    }, { timeout: 5000 });

    expect(container.textContent).toContain('Test Page');
  });
});
