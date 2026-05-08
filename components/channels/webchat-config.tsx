"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Loader2,
  Globe,
  Settings,
  Code,
  Copy,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface WebchatSite {
  id: string;
  name: string | null;
  publicKey: string;
  secretKey: string;
  allowedDomains: string[];
  themeConfig: Record<string, any>;
  channelId: string | null;
  isActive: boolean;
}

interface WebchatDiagnostics {
  lastPingAt: string | null;
  blockedOriginCount: number;
  rateLimitCount: number;
  recentErrors: Array<{
    id: string;
    reason: string;
    message: string | null;
    stage: string | null;
    createdAt: string;
  }>;
}

export function WebchatConfig({
  botId,
  channelId,
}: {
  botId: string;
  channelId?: string;
}) {
  const [site, setSite] = useState<WebchatSite | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [themeColor, setThemeColor] = useState("#0f172a");
  const [title, setTitle] = useState("Chat with us");
  const [welcomeMessage, setWelcomeMessage] =
    useState("Hello! How can we help you today?");
  const [position, setPosition] = useState("right");

  // Diagnostics state
  const [diagnostics, setDiagnostics] = useState<WebchatDiagnostics | null>(
    null,
  );
  const [isDiagnosticsLoading, setIsDiagnosticsLoading] = useState(false);

  // Preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewDraft, setPreviewDraft] = useState("");
  const [previewMessages, setPreviewMessages] = useState<
    Array<{ id: string; role: "user" | "bot"; text: string }>
  >([]);

  const loadSite = async (id: string) => {
    if (!channelId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/bots/${id}/webchat-site?channelId=${channelId}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.site) {
          setSite(data.site);
          const domains = data.site.allowedDomains || [];
          setUrl(domains[0] || "");
          setName(data.site.name || "");
          const theme = data.site.themeConfig || {};
          setThemeColor(theme.themeColor || "#0f172a");
          setTitle(theme.title || "Chat with us");
          setWelcomeMessage(
            theme.welcomeMessage || "Hello! How can we help you today?",
          );
          setPosition(theme.position || "right");
          void loadDiagnostics(id);
        }
      }
    } catch (error) {
      console.error("Failed to load webchat site:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadDiagnostics = async (id: string) => {
    setIsDiagnosticsLoading(true);
    try {
      const res = await fetch(`/api/bots/${id}/webchat-site/diagnostics`);
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data);
      }
    } catch (error) {
      console.error("Failed to load diagnostics:", error);
    } finally {
      setIsDiagnosticsLoading(false);
    }
  };

  useEffect(() => {
    if (botId) {
      setTimeout(() => {
        void loadSite(botId);
      }, 0);
    }
  }, [botId, channelId]);

  const handleSave = async () => {
    if (!channelId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bots/${botId}/webchat-site`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          name,
          allowedDomains: url ? [url] : [],
          themeConfig: {
            themeColor,
            title,
            welcomeMessage,
            position,
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to save webchat site");
      const data = await res.json();
      setSite(data.site);
      toast.success("Webchat settings saved!");
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const embedSnippet = site ? `<script src="${appUrl}/embed/replybase-webchat.js" data-site-id="${site.id}" async defer></script>` : "";

  const handlePreviewSend = () => {
    if (!previewDraft.trim()) return;
    const userMsg = { id: Math.random().toString(), role: "user" as const, text: previewDraft };
    setPreviewMessages((prev) => [...prev, userMsg]);
    setPreviewDraft("");

    setTimeout(() => {
      setPreviewMessages((prev) => [...prev, { id: Math.random().toString(), role: "bot" as const, text: "This is a preview response. In your live site, the AI will respond." }]);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4" />
              Widget Configuration
            </CardTitle>
            <CardDescription>
              Customize how your webchat widget looks and behaves.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Target Website URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
              <p className="text-xs text-muted-foreground">Used for CORS protection.</p>
            </div>
            <div className="space-y-2">
              <Label>Widget Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Theme Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-12 p-1"
                />
                <Input
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Code className="h-4 w-4" />
              Installation
            </CardTitle>
            <CardDescription>
              Copy this snippet into your website's &lt;head&gt; or before the closing &lt;/body&gt; tag.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Textarea
                value={embedSnippet || "Save settings first to generate snippet."}
                readOnly
                className="font-mono text-xs h-24"
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  if (embedSnippet) {
                    navigator.clipboard.writeText(embedSnippet);
                    toast.success("Snippet copied!");
                  }
                }}
                disabled={!embedSnippet}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Snippet
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live Preview</CardTitle>
          <CardDescription>
            Preview your widget design. AI responses are simulated here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative h-64 rounded-lg border bg-slate-50 p-4 overflow-hidden">
            <div className={`absolute bottom-4 ${position === "left" ? "left-4" : "right-4"} w-64`}>
              {isPreviewOpen && (
                <div className="rounded-lg border bg-white shadow-lg overflow-hidden flex flex-col h-48">
                  <div className="px-3 py-2 text-white text-xs font-bold" style={{ backgroundColor: themeColor }}>
                    {title}
                  </div>
                  <div className="flex-1 p-2 overflow-y-auto space-y-2">
                    <div className="bg-slate-100 p-2 rounded text-[10px]">{welcomeMessage}</div>
                    {previewMessages.map(m => (
                      <div key={m.id} className={`p-2 rounded text-[10px] ${m.role === 'user' ? 'bg-blue-100 ml-4' : 'bg-slate-100 mr-4'}`}>
                        {m.text}
                      </div>
                    ))}
                  </div>
                  <div className="p-2 border-t flex gap-1">
                    <input
                      className="flex-1 text-[10px] border rounded px-2 outline-none"
                      placeholder="Type..."
                      value={previewDraft}
                      onChange={e => setPreviewDraft(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handlePreviewSend()}
                    />
                    <button
                      className="px-2 py-1 text-white rounded text-[10px]"
                      style={{ backgroundColor: themeColor }}
                      onClick={handlePreviewSend}
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
              <Button
                className="rounded-full h-10 w-10 p-0 ml-auto flex mt-2"
                style={{ backgroundColor: themeColor }}
                onClick={() => setIsPreviewOpen(!isPreviewOpen)}
              >
                <Globe className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
