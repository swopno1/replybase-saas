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
  Zap,
  Send,
  MessageSquare,
  Bot,
} from "lucide-react";
import {
  ChannelFlowAssignmentCard,
  ChannelActivityLogCard,
} from "@/components/channels/channel-sections";
import { ChannelLimitWarning } from "@/components/channels/channel-ui";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

import { useRouter } from "next/navigation";

export function WebchatConfig({
  botId,
  channelId: initialChannelId,
  channelLimitStatus,
}: {
  botId: string;
  channelId?: string;
  channelLimitStatus?: { allowed: boolean; limit: number } | null;
}) {
  const router = useRouter();
  const [channelId, setChannelId] = useState<string | undefined>(initialChannelId);
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

  // Flow assignment state
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [isFlowsLoading, setIsFlowsLoading] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [isAssigningFlow, setIsAssigningFlow] = useState(false);
  const [isUnassigningFlow, setIsUnassigningFlow] = useState(false);

  const loadFlows = async () => {
    setIsFlowsLoading(true);
    try {
      const res = await fetch("/api/flows?type=my");
      if (res.ok) {
        const data = await res.json();
        setFlows(data.flows || []);
      }
    } catch (error) {
      console.error("Failed to load flows:", error);
    } finally {
      setIsFlowsLoading(false);
    }
  };

  const handleAssignFlow = async () => {
    if (!channelId || !selectedFlowId) return;

    setIsAssigningFlow(true);
    try {
      const res = await fetch(`/api/channels/${channelId}/flows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowId: selectedFlowId }),
      });

      if (!res.ok) throw new Error("Failed to assign flow");
      toast.success("Flow assigned successfully!");
      void loadSite(botId);
    } catch (error) {
      toast.error("Failed to assign flow");
    } finally {
      setIsAssigningFlow(false);
    }
  };

  const handleUnassignFlow = async () => {
    if (!channelId) return;

    setIsUnassigningFlow(true);
    try {
      const res = await fetch(`/api/channels/${channelId}/flows`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to unassign flow");
      toast.success("Flow unassigned.");
      void loadSite(botId);
    } catch (error) {
      toast.error("Failed to unassign flow");
    } finally {
      setIsUnassigningFlow(false);
    }
  };

  const assignedFlow = useMemo(() => {
    // Check if channel exists and has flow assignments
    // Note: the backend site object includes channel data
    return (site as any)?.channel?.flowAssignments?.[0]?.flow;
  }, [site]);

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
        void loadFlows();
      }, 0);
    }
  }, [botId, channelId, initialChannelId]);

  useEffect(() => {
    if (assignedFlow?.id && !selectedFlowId) {
      setSelectedFlowId(assignedFlow.id);
    }
  }, [assignedFlow, selectedFlowId]);

  useEffect(() => {
    if (initialChannelId !== channelId) {
      setChannelId(initialChannelId);
    }
  }, [initialChannelId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let currentChannelId = channelId;

      // If no channelId exists, we need to create the web channel first
      if (!currentChannelId) {
        if (channelLimitStatus && !channelLimitStatus.allowed) {
          throw new Error(`Channel limit reached. Please upgrade your plan to connect more channels.`);
        }

        const channelRes = await fetch(`/api/bots/${botId}/channels`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "web",
            name: name || "Webchat",
          }),
        });

        if (!channelRes.ok) {
          const errorData = await channelRes.json();
          throw new Error(errorData.error || "Failed to create web channel");
        }
        
        const channelData = await channelRes.json();
        currentChannelId = channelData.channel.id;
        setChannelId(currentChannelId);
      }

      const res = await fetch(`/api/bots/${botId}/webchat-site`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: currentChannelId,
          name: name || "Webchat",
          allowedDomains: url ? [url] : [],
          themeConfig: {
            themeColor,
            title,
            welcomeMessage,
            position,
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save webchat site");
      }
      
      const data = await res.json();
      setSite(data.site);
      toast.success("Webchat settings saved!");
      router.refresh();
    } catch (error) {
      console.error("Save error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  
  const snippets = useMemo(() => {
    if (!site) return { html: "", nextjs: "", react: "" };
    const src = `${appUrl}/embed/replybase-webchat.js`;
    return {
      html: `<script src="${src}" data-site-id="${site.id}" async defer></script>`,
      nextjs: `import Script from "next/script";\n\nexport default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <body>\n        {children}\n        <Script src="${src}" data-site-id="${site.id}" strategy="lazyOnload" />\n      </body>\n    </html>\n  );\n}`,
      react: `// Add this to your index.html or public/index.html\n<script src="${src}" data-site-id="${site.id}" async defer></script>`
    };
  }, [site, appUrl]);

  const [activeTab, setActiveTab] = useState("html");

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
      <ChannelLimitWarning limitStatus={channelLimitStatus} />
      
      {/* Settings Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Appearance & Behavior */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
            <CardTitle className="flex items-center gap-2 text-base text-slate-800">
              <Settings className="h-5 w-5 text-indigo-500" />
              Widget Configuration
            </CardTitle>
            <CardDescription>
              Customize how your webchat widget looks and behaves on your site.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-2">
              <Label className="text-slate-700">Target Website URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="focus-visible:ring-indigo-500"
              />
              <p className="text-xs text-muted-foreground">Used for CORS protection. Only this domain can load the widget.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700">Widget Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="focus-visible:ring-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700">Position</Label>
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger className="focus-visible:ring-indigo-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="right">Bottom Right</SelectItem>
                    <SelectItem value="left">Bottom Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700">Welcome Message</Label>
              <Textarea 
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                className="resize-none focus-visible:ring-indigo-500 h-20"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700">Theme Color</Label>
              <div className="flex gap-3 items-center">
                <div className="relative h-10 w-10 overflow-hidden rounded-md border shadow-sm shrink-0 cursor-pointer">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="absolute -top-2 -left-2 h-14 w-14 cursor-pointer"
                  />
                </div>
                <Input
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="flex-1 font-mono uppercase focus-visible:ring-indigo-500"
                />
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm mt-2">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Configuration
            </Button>
          </CardContent>
        </Card>

        {/* Live Preview */}
        <Card className="shadow-sm border-slate-200 flex flex-col overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b pb-4 shrink-0">
            <CardTitle className="flex items-center gap-2 text-base text-slate-800">
              <Globe className="h-5 w-5 text-blue-500" />
              Live Preview
            </CardTitle>
            <CardDescription>
              Test your widget design interactively.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0 relative bg-slate-100 min-h-[400px]">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            <div className="absolute inset-0 overflow-hidden">
              <div
                className={`absolute bottom-6 ${position === "left" ? "left-6" : "right-6"} w-[320px] transition-all duration-300 flex flex-col items-${position === "left" ? "start" : "end"}`}
              >
                {isPreviewOpen && (
                  <div className="flex h-[380px] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl mb-4 animate-in fade-in slide-in-from-bottom-4">
                    <div
                      className="px-4 py-3 text-sm font-semibold text-white shadow-sm flex justify-between items-center"
                      style={{ backgroundColor: themeColor }}
                    >
                      <span>{title}</span>
                      <ChevronDown className="h-4 w-4 cursor-pointer opacity-80 hover:opacity-100" onClick={() => setIsPreviewOpen(false)} />
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 no-scrollbar">
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm" style={{ backgroundColor: themeColor }}>
                          <Bot className="h-4 w-4" />
                        </div>
                        <div className="rounded-2xl rounded-tl-sm bg-white border border-slate-100 shadow-sm p-3 text-sm text-slate-700">
                          {welcomeMessage}
                        </div>
                      </div>
                      
                      {previewMessages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex items-start gap-2 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                        >
                           {m.role === "bot" && (
                             <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm" style={{ backgroundColor: themeColor }}>
                               <Bot className="h-4 w-4" />
                             </div>
                           )}
                           <div
                            className={`rounded-2xl p-3 text-sm shadow-sm max-w-[80%] ${
                              m.role === "user" 
                                ? "rounded-tr-sm text-white" 
                                : "rounded-tl-sm bg-white border border-slate-100 text-slate-700"
                            }`}
                            style={m.role === "user" ? { backgroundColor: themeColor } : {}}
                          >
                            {m.text}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 border-t p-3 bg-white">
                      <input
                        className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                        placeholder="Type a message..."
                        value={previewDraft}
                        onChange={(e) => setPreviewDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handlePreviewSend()}
                      />
                      <button
                        className="rounded-full h-9 w-9 flex items-center justify-center text-white shrink-0 transition-transform hover:scale-105 active:scale-95 shadow-sm"
                        style={{ backgroundColor: previewDraft.trim() ? themeColor : '#cbd5e1' }}
                        onClick={handlePreviewSend}
                        disabled={!previewDraft.trim()}
                      >
                        <Send className="h-4 w-4 ml-0.5" />
                      </button>
                    </div>
                  </div>
                )}
                
                <Button
                  className={`h-14 w-14 rounded-full shadow-xl transition-all duration-300 hover:scale-105 ${isPreviewOpen ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}
                  style={{ backgroundColor: themeColor }}
                  onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                >
                  {isPreviewOpen ? <ChevronDown className="h-6 w-6 text-white" /> : <MessageSquare className="h-6 w-6 text-white" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ChannelFlowAssignmentCard
          title="Channel Flow Assignment"
          description="Assign an active flow to the selected web channel. Channel assignment takes precedence over bot entry flow."
          selectLabel="Assigned Flow"
          selectId="webchatFlowSelect"
          flows={flows}
          isFlowsLoading={isFlowsLoading}
          selectedFlowId={selectedFlowId}
          onSelectFlow={setSelectedFlowId}
          assignedFlowName={assignedFlow?.name}
          unassignedDescription="No channel flow is assigned. Bot entry flow or AI fallback applies."
          onAssign={handleAssignFlow}
          onUnassign={handleUnassignFlow}
          isAssigning={isAssigningFlow}
          isUnassigning={isUnassigningFlow}
          assignDisabled={
            !selectedFlowId ||
            isAssigningFlow ||
            assignedFlow?.id === selectedFlowId
          }
          unassignDisabled={!assignedFlow || isUnassigningFlow}
        />
        
        {/* Installation */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
            <CardTitle className="flex items-center gap-2 text-base text-slate-800">
              <Code className="h-5 w-5 text-emerald-500" />
              Installation Snippet
            </CardTitle>
            <CardDescription>
              Copy this snippet into your website's codebase to embed the widget.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 bg-slate-100/80 p-1">
                <TabsTrigger value="html" className="rounded-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">HTML</TabsTrigger>
                <TabsTrigger value="nextjs" className="rounded-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">Next.js</TabsTrigger>
                <TabsTrigger value="react" className="rounded-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">React</TabsTrigger>
              </TabsList>
              
              <div className="mt-4 relative group">
                <TabsContent value="html" className="m-0">
                  <Textarea
                    value={snippets.html || "Save settings first to generate snippet."}
                    readOnly
                    className="font-mono text-xs h-32 bg-slate-900 text-slate-50 border-none focus-visible:ring-0 resize-none selection:bg-emerald-500/30"
                  />
                </TabsContent>
                <TabsContent value="nextjs" className="m-0">
                  <Textarea
                    value={snippets.nextjs || "Save settings first to generate snippet."}
                    readOnly
                    className="font-mono text-xs h-40 bg-slate-900 text-slate-50 border-none focus-visible:ring-0 resize-none selection:bg-emerald-500/30"
                  />
                </TabsContent>
                <TabsContent value="react" className="m-0">
                  <Textarea
                    value={snippets.react || "Save settings first to generate snippet."}
                    readOnly
                    className="font-mono text-xs h-32 bg-slate-900 text-slate-50 border-none focus-visible:ring-0 resize-none selection:bg-emerald-500/30"
                  />
                </TabsContent>
                
                {site && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 hover:bg-white/20 text-white border-none"
                    onClick={() => {
                      const textToCopy = snippets[activeTab as keyof typeof snippets];
                      if (textToCopy) {
                        navigator.clipboard.writeText(textToCopy);
                        toast.success("Snippet copied!");
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );

}

interface FlowOption {
  id: string;
  name: string;
}
