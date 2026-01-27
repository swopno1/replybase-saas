"use client";

import { BotList } from '@/components/bot-list';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * PHASE 1: Secure Bot Builder Access
 * 
 * This component ensures users can only access Typebot Builder through the SaaS-controlled
 * OIDC flow. Direct links to engine.replybase.co.uk are replaced with secure authorization.
 */
export default function BotsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLaunchBuilder = async () => {
    setIsLoading(true);
    try {
      // Call the secure authorization endpoint
      // This will verify subscription and generate OIDC authorization URL
      const response = await fetch('/api/typebot/authorize', {
        method: 'POST',
      });

      if (response.redirected) {
        // If POST redirects, follow it
        window.location.href = response.url;
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        
        // Handle subscription required
        if (response.status === 403 && error.redirect) {
          router.push(error.redirect);
          return;
        }
        
        // Handle unauthorized
        if (response.status === 401) {
          router.push('/auth/login');
          return;
        }

        throw new Error(error.error || 'Failed to launch builder');
      }

      // If response is JSON with authorizationUrl, redirect to it
      const data = await response.json();
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error('Invalid response from authorization endpoint');
      }
    } catch (error: any) {
      console.error('[Launch Builder] Error:', error);
      alert('Failed to launch builder. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bots</h1>
          <p className="text-gray-600">Manage your AI bots and channels</p>
        </div>
        <Button
          onClick={handleLaunchBuilder}
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
        >
          {isLoading ? 'Launching...' : 'Launch Builder ↗'}
        </Button>
      </div>
      <BotList />
    </div>
  );
}
