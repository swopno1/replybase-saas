"use client";

import { useEffect, useState } from "react";
import { OnboardingModal } from "./onboarding-modal";
import { OnboardingBanner } from "./onboarding-banner";

import type { OnboardingData } from "@/types/shared/onboarding";

export function OnboardingWrapper() {
  const [status, setStatus] = useState<{
    isOnboarded: boolean;
    onboardingStep: number;
    onboardingData: OnboardingData;
  } | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      const res = await fetch("/api/onboarding");
      if (res.ok) {
        const data = await res.json();
        setStatus(data.data);
      }
    }
    fetchStatus();
  }, []);

  if (!status || status.isOnboarded) {
    return null;
  }

  return (
    <>
      <OnboardingBanner currentStep={status.onboardingStep} />
      <OnboardingModal
        isOpen={!status.isOnboarded}
        initialStep={status.onboardingStep}
        initialData={status.onboardingData}
      />
    </>
  );
}
