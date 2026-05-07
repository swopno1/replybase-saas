"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  Zap,
  Unplug,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
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
import { ChannelLimitWarning } from "@/components/channels/channel-ui";
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useConfirmation } from "@/components/ui/confirmation-provider";
import { FacebookLogo } from "@/components/icons/MetaIcons";

interface FacebookPage {
  id: string;
  name: string;
  connected: boolean;
  botId: string | null;
  assignedFlow?: {
    id: string;
    name: string;
  } | null;
}

interface FlowOption {
  id: string;
  name: string;
}

export function FacebookConfig({ botId, channelLimitStatus }: { botId: string; channelLimitStatus?: { allowed: boolean; limit: number } | null }) {
  const { confirm } = useConfirmation();

  // State
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [limitStatus, setLimitStatus] = useState<{ allowed: boolean; limit: number } | null>(null);
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [isFlowsLoading, setIsFlowsLoading] = useState(false);

  // Status/Action states
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [assigningMap, setAssigningMap] = useState<Record<string, boolean>>({});
  const [unassigningMap, setUnassigningMap] = useState<Record<string, boolean>>({});
  const [selectedFlowIdMap, setSelectedFlowIdMap] = useState<Record<string, string>>({});
  const [diagnosticResult, setDiagnosticResult] = useState<Record<string, any /* eslint-disable-line @typescript-eslint/no-explicit-any */>>({});

  const loadPages = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/facebook/pages");
      if (res.ok) {
        const data = await res.json();
        setPages(data.pages || []);
        if (data.limitStatus) setLimitStatus(data.limitStatus);
      }
    } catch (error) {
      console.error("Failed to load Facebook pages:", error);
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    if (botId) {
      setTimeout(() => {
        void loadPages(botId);
        void loadFlows();
      }, 0);
    }
  }, [botId]);

  const handleFacebookLogin = () => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    const popup = window.open(
      "/api/auth/facebook",
      "Facebook Login",
      `width=${width},height=${height},left=${left},top=${top}`,
    );

    const interval = setInterval(() => {
      if (popup?.closed) {
        clearInterval(interval);
        void loadPages(botId);
      }
    }, 1000);
  };

  const handleConnectPage = async (page: FacebookPage) => {
    if (!botId) return;

    const effectiveLimitStatus = channelLimitStatus || limitStatus;
    if (effectiveLimitStatus && !effectiveLimitStatus.allowed) {
      toast.error(`Channel limit reached (${effectiveLimitStatus.limit}). Please upgrade.`);
      return;
    }

    setStatusMap((prev) => ({ ...prev, [page.id]: "loading" }));
    try {
      const res = await fetch("/api/integrations/facebook/pages/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: page.id,
          botId: botId,
        }),
      });

      if (!res.ok) throw new Error("Failed to connect page");

      toast.success(`Page "${page.name}" connected!`);
      void loadPages(botId);
    } catch (error) {
      toast.error("Failed to connect page");
    } finally {
      setStatusMap((prev) => ({ ...prev, [page.id]: "" }));
    }
  };

  const handleDisconnectPage = async (page: FacebookPage) => {
    const confirmed = await confirm({
      title: "Disconnect Page",
      description: `Are you sure you want to disconnect "${page.name}"? This bot will stop responding to messages on this page.`,
      confirmText: "Disconnect",
      variant: "destructive",
    });

    if (!confirmed) return;

    setStatusMap((prev) => ({ ...prev, [page.id]: "loading" }));
    try {
      const res = await fetch("/api/integrations/facebook/pages/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: page.id }),
      });

      if (!res.ok) throw new Error("Failed to disconnect page");

      toast.success("Page disconnected");
      void loadPages(botId);
    } catch (error) {
      toast.error("Failed to disconnect page");
    } finally {
      setStatusMap((prev) => ({ ...prev, [page.id]: "" }));
    }
  };

  const handleAssignFlow = async (page: FacebookPage) => {
    const flowId = selectedFlowIdMap[page.id];
    if (!flowId) return;

    setAssigningMap((prev) => ({ ...prev, [page.id]: true }));
    try {
      const res = await fetch(`/api/integrations/facebook/pages/${page.id}/flows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowId }),
      });

      if (!res.ok) throw new Error("Failed to assign flow");
      toast.success("Flow assigned successfully!");
      void loadPages(botId);
    } catch (error) {
      toast.error("Failed to assign flow");
    } finally {
      setAssigningMap((prev) => ({ ...prev, [page.id]: false }));
    }
  };

  const handleUnassignFlow = async (page: FacebookPage) => {
    setUnassigningMap((prev) => ({ ...prev, [page.id]: true }));
    try {
      const res = await fetch(`/api/integrations/facebook/pages/${page.id}/flows`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to unassign flow");
      toast.success("Flow unassigned");
      void loadPages(botId);
    } catch (error) {
      toast.error("Failed to unassign flow");
    } finally {
      setUnassigningMap((prev) => ({ ...prev, [page.id]: false }));
    }
  };

  const handleRunDiagnostics = async (page: FacebookPage) => {
    setStatusMap((prev) => ({ ...prev, [page.id]: "diagnosing" }));
    try {
      const res = await fetch(`/api/integrations/facebook/pages/${page.id}/diagnostics`);
      if (!res.ok) throw new Error("Diagnostics failed");
      const data = await res.json();
      setDiagnosticResult((prev) => ({ ...prev, [page.id]: data }));
      toast.success("Diagnostics completed");
    } catch (error) {
      toast.error("Failed to run diagnostics");
    } finally {
      setStatusMap((prev) => ({ ...prev, [page.id]: "" }));
    }
  };

  return (
      <ChannelLimitWarning limitStatus={channelLimitStatus || limitStatus} />
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FacebookLogo className="h-5 w-5" />
                Facebook Integration
              </CardTitle>
              <CardDescription>
                Connect Facebook Pages to this bot.
              </CardDescription>
            </div>
            <Button onClick={handleFacebookLogin} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Pages
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pages.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-slate-50">
              <FacebookLogo className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm text-muted-foreground mb-4">
                No Facebook pages found. Please link your account first.
              </p>
              <Button onClick={handleFacebookLogin}>
                Link Facebook Account
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {pages.map((page) => (
                <div key={page.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{page.name}</h3>
                      <p className="text-xs text-muted-foreground">ID: {page.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {page.connected ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRunDiagnostics(page)}
                            disabled={statusMap[page.id] === "diagnosing"}
                            title="Check Connection"
                          >
                            <ShieldAlert className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDisconnectPage(page)}
                            disabled={statusMap[page.id] === "loading" || !(channelLimitStatus || limitStatus)?.allowed}
                          >
                            {statusMap[page.id] === "loading" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Unplug className="h-4 w-4 mr-2" />
                            )}
                            Disconnect
                          </Button>
                          <Badge variant={page.botId === botId ? "secondary" : "outline"}>
                            {page.botId === botId ? "Connected here" : "Connected elsewhere"}
                          </Badge>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleConnectPage(page)}
                          disabled={statusMap[page.id] === "loading" || !(channelLimitStatus || limitStatus)?.allowed}
                        >
                          {statusMap[page.id] === "loading" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4 mr-2" />
                          )}
                          Connect Page
                        </Button>
                      )}
                    </div>
                  </div>

                  {page.connected && page.botId === botId && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Card className="bg-slate-50 border-none shadow-none">
                        <CardContent className="pt-4 space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Page Flow Assignment</Label>
                            <div className="flex gap-2">
                              <Select
                                value={selectedFlowIdMap[page.id] || page.assignedFlow?.id || ""}
                                onValueChange={(val) =>
                                  setSelectedFlowIdMap((prev) => ({ ...prev, [page.id]: val }))
                                }
                              >
                                <SelectTrigger className="h-8 text-xs bg-white">
                                  <SelectValue placeholder="Select flow" />
                                </SelectTrigger>
                                <SelectContent>
                                  {flows.map((f) => (
                                    <SelectItem key={f.id} value={f.id} className="text-xs">
                                      {f.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                className="h-8 px-2 text-[10px]"
                                onClick={() => handleAssignFlow(page)}
                                disabled={
                                  assigningMap[page.id] ||
                                  !selectedFlowIdMap[page.id] ||
                                  selectedFlowIdMap[page.id] === page.assignedFlow?.id
                                }
                              >
                                {assigningMap[page.id] ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  "Assign"
                                )}
                              </Button>
                              {page.assignedFlow && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-[10px] text-red-600"
                                  onClick={() => handleUnassignFlow(page)}
                                  disabled={unassigningMap[page.id]}
                                >
                                  {unassigningMap[page.id] ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    "Unassign"
                                  )}
                                </Button>
                              )}
                            </div>
                            {page.assignedFlow ? (
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                                <CheckCircle2 className="h-2 w-2 text-green-600" />
                                Active: {page.assignedFlow.name}
                              </p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                No flow assigned.
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {diagnosticResult[page.id] && (
                        <Card className="bg-white border-none shadow-sm">
                          <CardContent className="pt-4 space-y-2 text-[10px]">
                            <div className="flex justify-between">
                              <span>Token Valid:</span>
                              <span className={diagnosticResult[page.id].tokenValid ? "text-green-600" : "text-red-600"}>
                                {diagnosticResult[page.id].tokenValid ? "Yes" : "No"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Webhook Subscribed:</span>
                              <span className={diagnosticResult[page.id].webhookSubscribed ? "text-green-600" : "text-red-600"}>
                                {diagnosticResult[page.id].webhookSubscribed ? "Yes" : "No"}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <a href="https://replybase.co.uk/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline">Privacy Policy</a>
        <a href="https://replybase.co.uk/terms" target="_blank" rel="noopener noreferrer" className="hover:underline">Terms of Service</a>
      </div>
      <div className="mt-8 flex justify-center">
        <Button onClick={handleFacebookLogin} className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
          <FacebookLogo className="mr-2 h-5 w-5 fill-white" />
          Continue with Facebook
        </Button>
      </div>
    </div>
  );
}

function Badge({ children, variant = "default", className = "" }: { children: React.ReactNode; variant?: string; className?: string }) {
  const variants: Record<string, string> = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    outline: "text-foreground border border-input",
    destructive: "bg-destructive text-destructive-foreground",
  };
  return <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variants[variant]} ${className}`}>{children}</div>;
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <label className={`text-sm font-medium ${className}`}>{children}</label>;
}
