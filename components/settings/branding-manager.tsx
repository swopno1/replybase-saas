"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Palette, Eye, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BrandingData {
  companyName: string;
  logoUrl: string;
  botAvatarUrl: string;
  primaryColor: string;
  accentColor: string;
  emailFromName: string;
  emailFromAddress: string;
}

const DEFAULTS: BrandingData = {
  companyName: "",
  logoUrl: "",
  botAvatarUrl: "",
  primaryColor: "#1d4ed8",
  accentColor: "#0f172a",
  emailFromName: "",
  emailFromAddress: "",
};

function WebchatPreview({ branding }: { branding: BrandingData }) {
  const primary = branding.primaryColor || "#1d4ed8";
  const accent = branding.accentColor || "#0f172a";
  const name = branding.companyName || "Your Company";

  return (
    <div className="rounded-xl overflow-hidden border shadow-md w-72 text-sm font-sans">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: `linear-gradient(135deg, ${accent} 0%, ${primary} 100%)` }}
      >
        {branding.botAvatarUrl ? (
          <img
            src={branding.botAvatarUrl}
            alt="Bot"
            className="w-8 h-8 rounded-full object-cover border-2 border-white/30"
          />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white/30"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <div className="text-white font-semibold text-sm leading-tight">{name}</div>
          <div className="text-white/70 text-xs">Online</div>
        </div>
      </div>

      {/* Messages */}
      <div className="bg-white px-4 py-3 space-y-2">
        <div className="flex gap-2">
          <div
            className="max-w-[70%] px-3 py-2 rounded-2xl rounded-tl-sm text-white text-xs leading-relaxed"
            style={{ background: primary }}
          >
            Hi! How can I help you today?
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <div className="max-w-[70%] px-3 py-2 rounded-2xl rounded-tr-sm bg-gray-100 text-gray-800 text-xs leading-relaxed">
            I have a question about your services.
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="bg-white border-t px-3 py-2 flex items-center gap-2">
        <div className="flex-1 bg-gray-100 rounded-full px-3 py-1.5 text-xs text-gray-400">
          Type a message…
        </div>
        <button
          className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0"
          style={{ background: primary }}
        >
          ▶
        </button>
      </div>

      {branding.logoUrl && (
        <div className="bg-white border-t px-3 py-1.5 flex items-center justify-center">
          <img src={branding.logoUrl} alt={name} className="h-5 object-contain opacity-70" />
        </div>
      )}
    </div>
  );
}

export function BrandingManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [branding, setBranding] = useState<BrandingData>(DEFAULTS);

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    try {
      const res = await fetch("/api/settings/branding");
      if (res.status === 403) {
        setLocked(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setBranding({
        companyName: data.companyName ?? "",
        logoUrl: data.logoUrl ?? "",
        botAvatarUrl: data.botAvatarUrl ?? "",
        primaryColor: data.primaryColor ?? "#1d4ed8",
        accentColor: data.accentColor ?? "#0f172a",
        emailFromName: data.emailFromName ?? "",
        emailFromAddress: data.emailFromAddress ?? "",
      });
    } catch {
      toast.error("Failed to load branding settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        companyName: branding.companyName || null,
        logoUrl: branding.logoUrl || null,
        botAvatarUrl: branding.botAvatarUrl || null,
        primaryColor: branding.primaryColor || null,
        accentColor: branding.accentColor || null,
        emailFromName: branding.emailFromName || null,
        emailFromAddress: branding.emailFromAddress || null,
      };

      const res = await fetch("/api/settings/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Branding saved");
      } else {
        toast.error(data.error || "Failed to save branding");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof BrandingData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setBranding((prev) => ({ ...prev, [key]: e.target.value }));

  if (locked) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <CardTitle className="text-yellow-800">Business Plan Required</CardTitle>
          </div>
          <CardDescription className="text-yellow-700">
            White-label branding is exclusively available on the Business plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-yellow-700 mb-4">
            Customise the webchat widget and lead email notifications with your own logo,
            brand colours, and sender name. Upgrade to Business to unlock this feature.
          </p>
          <Button onClick={() => (window.location.href = "/settings?tab=billing")}>
            Upgrade to Business
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading branding settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <CardTitle>Brand Identity</CardTitle>
              </div>
              <CardDescription>
                Customise how your brand appears in the webchat widget and outgoing emails.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  placeholder="Acme Corp"
                  value={branding.companyName}
                  onChange={set("companyName")}
                />
                <p className="text-xs text-muted-foreground">
                  Shown in the webchat header and email footer.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  placeholder="https://example.com/logo.png"
                  value={branding.logoUrl}
                  onChange={set("logoUrl")}
                />
                <p className="text-xs text-muted-foreground">
                  Displayed at the bottom of the webchat widget and in notification emails.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="botAvatarUrl">Bot Avatar URL</Label>
                <Input
                  id="botAvatarUrl"
                  placeholder="https://example.com/avatar.png"
                  value={branding.botAvatarUrl}
                  onChange={set("botAvatarUrl")}
                />
                <p className="text-xs text-muted-foreground">
                  Square image shown in the webchat header (recommended 64×64 px).
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Colour</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      id="primaryColor"
                      value={branding.primaryColor}
                      onChange={set("primaryColor")}
                      className="h-9 w-12 cursor-pointer rounded border border-input p-0.5"
                    />
                    <Input
                      value={branding.primaryColor}
                      onChange={set("primaryColor")}
                      maxLength={7}
                      className="font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used for chat bubbles and the send button.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accentColor">Accent / Header Colour</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      id="accentColor"
                      value={branding.accentColor}
                      onChange={set("accentColor")}
                      className="h-9 w-12 cursor-pointer rounded border border-input p-0.5"
                    />
                    <Input
                      value={branding.accentColor}
                      onChange={set("accentColor")}
                      maxLength={7}
                      className="font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used for the widget header gradient.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Sender Settings</CardTitle>
              <CardDescription>
                Customise the &ldquo;From&rdquo; name and address on lead notification emails.
                Leave blank to use the default ReplyBase sender.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emailFromName">From Name</Label>
                <Input
                  id="emailFromName"
                  placeholder="Acme Corp Leads"
                  value={branding.emailFromName}
                  onChange={set("emailFromName")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emailFromAddress">From Email Address</Label>
                <Input
                  id="emailFromAddress"
                  type="email"
                  placeholder="leads@acmecorp.com"
                  value={branding.emailFromAddress}
                  onChange={set("emailFromAddress")}
                />
                <p className="text-xs text-muted-foreground">
                  The sending domain must be verified in your Resend account.
                </p>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Branding
              </>
            )}
          </Button>
        </form>

        {/* Live preview */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Eye className="h-4 w-4" />
            Live Preview
          </div>
          <WebchatPreview branding={branding} />
          <p className="text-xs text-muted-foreground">
            This preview updates as you change settings. The actual widget appearance may vary
            slightly based on your embed configuration.
          </p>
        </div>
      </div>
    </div>
  );
}
