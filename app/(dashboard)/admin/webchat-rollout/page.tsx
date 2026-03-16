"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type WebchatRolloutMode = "off" | "pilot" | "tiered" | "ga";

type RolloutConfig = {
  mode: WebchatRolloutMode;
  enabledTenantIds: string[];
  disabledTenantIds: string[];
  pilotTenantIds: string[];
  allowedPlanNames: string[];
};

const EMPTY_CONFIG: RolloutConfig = {
  mode: "off",
  enabledTenantIds: [],
  disabledTenantIds: [],
  pilotTenantIds: [],
  allowedPlanNames: [],
};

function parseLines(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function toMultiline(value: string[]) {
  return value.join("\n");
}

export default function AdminWebchatRolloutPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<RolloutConfig>(EMPTY_CONFIG);
  const [enabledDraft, setEnabledDraft] = useState("");
  const [disabledDraft, setDisabledDraft] = useState("");
  const [pilotDraft, setPilotDraft] = useState("");
  const [planDraft, setPlanDraft] = useState("");

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/webchat-rollout");
      if (!response.ok) {
        throw new Error("Failed to load rollout config");
      }

      const data = await response.json();
      const nextConfig: RolloutConfig = data.config || EMPTY_CONFIG;
      setConfig(nextConfig);
      setEnabledDraft(toMultiline(nextConfig.enabledTenantIds || []));
      setDisabledDraft(toMultiline(nextConfig.disabledTenantIds || []));
      setPilotDraft(toMultiline(nextConfig.pilotTenantIds || []));
      setPlanDraft(toMultiline(nextConfig.allowedPlanNames || []));
    } catch (error) {
      console.error(error);
      toast.error("Failed to load rollout config");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const payload: RolloutConfig = {
        mode: config.mode,
        enabledTenantIds: parseLines(enabledDraft),
        disabledTenantIds: parseLines(disabledDraft),
        pilotTenantIds: parseLines(pilotDraft),
        allowedPlanNames: parseLines(planDraft).map((name) =>
          name.toLowerCase(),
        ),
      };

      const response = await fetch("/api/admin/webchat-rollout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save rollout config");
      }

      const data = await response.json();
      const nextConfig: RolloutConfig = data.config || payload;
      setConfig(nextConfig);
      setEnabledDraft(toMultiline(nextConfig.enabledTenantIds || []));
      setDisabledDraft(toMultiline(nextConfig.disabledTenantIds || []));
      setPilotDraft(toMultiline(nextConfig.pilotTenantIds || []));
      setPlanDraft(toMultiline(nextConfig.allowedPlanNames || []));
      toast.success("Webchat rollout config updated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save rollout config");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Webchat Rollout Controls</CardTitle>
          <CardDescription>
            Manage Phase 8 rollout policy for webchat endpoints.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2 max-w-sm">
            <Label htmlFor="mode">Rollout Mode</Label>
            <Select
              value={config.mode}
              onValueChange={(value: WebchatRolloutMode) =>
                setConfig((prev) => ({ ...prev, mode: value }))
              }
            >
              <SelectTrigger id="mode">
                <SelectValue placeholder="Select rollout mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">off (no enforcement)</SelectItem>
                <SelectItem value="pilot">
                  pilot (pilot tenants only)
                </SelectItem>
                <SelectItem value="tiered">
                  tiered (pilot + plan checks)
                </SelectItem>
                <SelectItem value="ga">
                  ga (all tenants, except explicit deny)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="enabled-tenants">Force-enabled tenant IDs</Label>
              <Textarea
                id="enabled-tenants"
                value={enabledDraft}
                onChange={(event) => setEnabledDraft(event.target.value)}
                placeholder="tenant_abc\ntenant_xyz"
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="disabled-tenants">
                Force-disabled tenant IDs
              </Label>
              <Textarea
                id="disabled-tenants"
                value={disabledDraft}
                onChange={(event) => setDisabledDraft(event.target.value)}
                placeholder="tenant_blocked"
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pilot-tenants">Pilot tenant IDs</Label>
              <Textarea
                id="pilot-tenants"
                value={pilotDraft}
                onChange={(event) => setPilotDraft(event.target.value)}
                placeholder="tenant_pilot_1\ntenant_pilot_2"
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="allowed-plans">Tiered allowed plan names</Label>
              <Textarea
                id="allowed-plans"
                value={planDraft}
                onChange={(event) => setPlanDraft(event.target.value)}
                placeholder="pro\nenterprise"
                rows={6}
              />
            </div>
          </div>

          <div className="grid gap-2 max-w-xl">
            <Label htmlFor="hint">Persistence note</Label>
            <Input
              id="hint"
              disabled
              value="These controls update runtime config. Mirror values to deployment env vars for durable rollout settings."
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save rollout config
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
