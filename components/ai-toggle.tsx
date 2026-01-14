"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AIToggleProps {
  pageId: string;
  enabled: boolean;
  disabled?: boolean;
}

export function AIToggle({
  pageId,
  enabled: initialEnabled,
  disabled,
}: AIToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  const handleToggle = async (checked: boolean) => {
    if (disabled) {
      toast.error("Engine is offline. Cannot enable AI replies.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/integrations/facebook/pages/${pageId}/toggle-ai`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            enabled: checked,
          }),
        }
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to update AI status" }));
        throw new Error(error.error || "Failed to update AI status");
      }

      setEnabled(checked);
      toast.success(
        checked
          ? "AI replies enabled for this page"
          : "AI replies disabled for this page"
      );
    } catch (error) {
      console.error("Error toggling AI status:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update AI status"
      );
      // Revert the toggle on error
      setEnabled(!checked);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {loading && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
      <div className="flex items-center gap-2">
        <Switch
          id={`ai-toggle-${pageId}`}
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={loading || disabled}
        />
        <Label
          htmlFor={`ai-toggle-${pageId}`}
          className="text-sm cursor-pointer"
        >
          {enabled ? "Enabled" : "Disabled"}
        </Label>
      </div>
    </div>
  );
}
