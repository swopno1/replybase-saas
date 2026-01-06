'use client';

import { useEffect, useState } from 'react';

interface TrialBadgeProps {
  trialEndsAt: string | null;
}

export function TrialBadge({ trialEndsAt }: TrialBadgeProps) {
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!trialEndsAt) return;

    const calculateDays = () => {
      const endDate = new Date(trialEndsAt);
      const days = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      setDaysRemaining(Math.max(0, days));
    };

    calculateDays();
    const interval = setInterval(calculateDays, 60000);

    return () => clearInterval(interval);
  }, [trialEndsAt]);

  if (daysRemaining === null) return null;
  if (daysRemaining <= 0) return null;

  return (
    <div className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
      Trial: {daysRemaining} days remaining
    </div>
  );
}