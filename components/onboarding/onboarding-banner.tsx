"use client";

import { Progress } from "@/components/ui/progress";
import { AlertCircle } from "lucide-react";

export function OnboardingBanner({
  currentStep,
  totalSteps = 6
}: {
  currentStep: number;
  totalSteps?: number;
}) {
  const progress = totalSteps > 0 ? Math.round(((currentStep || 0) / totalSteps) * 100) : 0;
  const safeProgress = isNaN(progress) ? 0 : progress;

  return (
    <div className="bg-primary/5 border-b border-primary/10 px-4 py-2">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <AlertCircle className="h-4 w-4" />
          <span>Finish setting up your AI assistant to launch your chatbot.</span>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Setup Progress: {safeProgress}%
          </span>
          <Progress value={safeProgress} className="h-2 w-full md:w-48" />
        </div>
      </div>
    </div>
  );
}
