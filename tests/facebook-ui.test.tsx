/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FacebookIntegrationPage from '../app/(dashboard)/integrations/facebook/page';
import { useConfirmation } from '@/components/ui/confirmation-provider';
import { useRouter } from 'next/navigation';

// Mock dependencies
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    replace: vi.fn(),
  })),
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
}));

describe('Facebook Integration UI Compliance', () => {
  beforeEach(() => {
    // Mock fetch for page load
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ connected: false, pages: [] }),
      })
    );
  });

  it('should render branding and display required legal links', async () => {
    render(<FacebookIntegrationPage />);

    const connectButton = await screen.findByText(/Continue with Facebook/i);
    expect(connectButton).toBeDefined();
    expect(connectButton.closest('button')?.className).toContain('bg-[#1877F2]');

    const privacyLink = await screen.findByRole('link', { name: /Privacy Policy/i });
    const termsLink = await screen.findByRole('link', { name: /Terms of Service/i });

    expect(privacyLink).toBeDefined();
    expect(termsLink).toBeDefined();
    expect(privacyLink?.getAttribute('href')).toBe('https://replybase.co.uk/privacy');
    expect(termsLink?.getAttribute('href')).toBe('https://replybase.co.uk/terms');
    expect(privacyLink?.getAttribute('target')).toBe('_blank');
    expect(termsLink?.getAttribute('target')).toBe('_blank');
    expect(privacyLink?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(termsLink?.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
