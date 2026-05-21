"use client";

import { useEffect, useState } from "react";
import { OnboardingModal } from "./onboarding-modal";
import { OnboardingBanner } from "./onboarding-banner";

import { useSearchParams } from "next/navigation";
import type { OnboardingData } from "@/types/shared/onboarding";

export function OnboardingWrapper() {
  const searchParams = useSearchParams();
  const isCheckoutFlow = searchParams.get("checkout") === "true";

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

  if (isCheckoutFlow || !status || status.isOnboarded) {
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
