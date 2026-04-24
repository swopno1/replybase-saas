"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { setClarityTags, trackEvent } from "@/lib/client-analytics";

type DashboardFunnelTrackerProps = {
  tenantId: string;
  completedMilestoneIds: string[];
};

export function DashboardFunnelTracker({
  tenantId,
  completedMilestoneIds,
}: DashboardFunnelTrackerProps) {
  const searchParams = useSearchParams();

  useEffect(() => {
    setClarityTags({
      page_type: "dashboard",
      funnel_step: "dashboard",
    });

    trackEvent("dashboard_loaded", {
      onceKey: `dashboard_loaded:${tenantId}`,
      onceScope: "session",
      properties: {
        tenant_id: tenantId,
      },
    });
  }, [tenantId]);

  useEffect(() => {
    for (const milestoneId of completedMilestoneIds) {
      trackEvent("onboarding_step_completed", {
        onceKey: `onboarding_step_completed:${tenantId}:${milestoneId}`,
        onceScope: "local",
        properties: {
          tenant_id: tenantId,
          step_id: milestoneId,
        },
      });
    }

    // Check if all major milestones are completed to fire onboarding_completed
    const majorMilestones = [
      "first-channel",
      "first-automated-reply",
      "plan-selection",
      "lead-notifications",
    ];
    const allMajorCompleted = majorMilestones.every((id) =>
      completedMilestoneIds.includes(id),
    );

    if (allMajorCompleted) {
      trackEvent("onboarding_completed", {
        onceKey: `onboarding_completed:${tenantId}`,
        onceScope: "local",
        properties: {
          tenant_id: tenantId,
        },
      });
    }
  }, [completedMilestoneIds, tenantId]);

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      trackEvent("subscription_started", {
        onceKey: `subscription_started:${tenantId}`,
        onceScope: "local",
        properties: {
          tenant_id: tenantId,
          status: "success",
        },
      });
    }
  }, [searchParams, tenantId]);

  return null;
}
