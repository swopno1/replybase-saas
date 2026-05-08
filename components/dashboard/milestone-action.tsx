"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { ChannelActivationDialog } from "@/components/onboarding/channel-activation-dialog";

interface MilestoneActionProps {
  id: string;
  actionLabel: string;
  actionHref: string;
  isNextAction: boolean;
  tenantId: string;
}

export function MilestoneAction({
  id,
  actionLabel,
  actionHref,
  isNextAction,
  tenantId
}: MilestoneActionProps) {
  const [isActivationOpen, setIsActivationOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (id === "first-channel") {
      e.preventDefault();
      setIsActivationOpen(true);
    }
  };

  return (
    <>
      <Link href={actionHref} onClick={handleClick}>
        <Button
          size="sm"
          variant={isNextAction ? "default" : "outline"}
          className="rounded-lg font-bold"
        >
          {actionLabel}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </Link>

      {id === "first-channel" && (
        <ChannelActivationDialog
          isOpen={isActivationOpen}
          onClose={() => setIsActivationOpen(false)}
          tenantId={tenantId}
        />
      )}
    </>
  );
}
