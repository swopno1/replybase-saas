import React from "react";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

interface LimitStatus {
  allowed: boolean;
  limit: number;
  current?: number;
  planName?: string;
}

export function ChannelLimitWarning({ limitStatus }: { limitStatus: LimitStatus | null | undefined }) {
  if (!limitStatus || limitStatus.allowed) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-6 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-800">Channel Limit Reached</p>
        <p className="text-sm text-amber-700">
          This bot has reached the maximum of {limitStatus.limit} channels for your {limitStatus.planName || "current"} plan.
          <Link href="/settings?tab=billing" className="ml-1 underline font-semibold">
            Upgrade your plan
          </Link> to connect more channels to this bot.
        </p>
      </div>
    </div>
  );
}
