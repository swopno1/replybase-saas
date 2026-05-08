/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import { FacebookConfig } from '../components/channels/facebook-config';
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

  it('should render branding and display required legal links', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/integrations/facebook/pages')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ connected: false, pages: [] }),
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

    const { container } = render(<FacebookConfig botId="bot-123" />);

    // Wait for the "Continue with Facebook" button
    await waitFor(() => {
      const button = screen.getByText(/Continue with Facebook/i);
      expect(button).toBeTruthy();
    }, { timeout: 5000 });

    const privacyLink = container.querySelector('a[href="https://replybase.co.uk/privacy"]');
    const termsLink = container.querySelector('a[href="https://replybase.co.uk/terms"]');

    expect(privacyLink).not.toBeNull();
    expect(termsLink).not.toBeNull();
    expect(privacyLink?.textContent?.trim()).toBe('Privacy Policy');
    expect(termsLink?.textContent?.trim()).toBe('Terms of Service');
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
                category: 'Test Category',
                botId: 'bot-123'
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

    const { container } = render(<FacebookConfig botId="bot-123" />);

    await waitFor(() => {
      const checkButton = container.querySelector('button[title="Check Connection"]');
      if (!checkButton) throw new Error('Check Connection button not found');
    }, { timeout: 5000 });

    expect(container.textContent).toContain('Test Page');
    const privacyLinks = await screen.findAllByRole('link', { name: /Privacy Policy/i });
    const termsLinks = await screen.findAllByRole('link', { name: /Terms of Service/i });

    expect(privacyLinks.length).toBeGreaterThan(0);
    expect(termsLinks.length).toBeGreaterThan(0);

    expect(privacyLinks[0]?.getAttribute('href')).toBe('https://replybase.co.uk/privacy');
    expect(termsLinks[0]?.getAttribute('href')).toBe('https://replybase.co.uk/terms');
  });
});
