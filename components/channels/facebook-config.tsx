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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChannelLimitWarning } from "@/components/channels/channel-ui";
import { toast } from "sonner";
import { useConfirmation } from "@/components/ui/confirmation-provider";
import { FacebookLogo } from "@/components/icons/MetaIcons";
import { ChannelFlowAssignmentCard } from "@/components/channels/channel-sections";

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
  const [statusMap, setStatusMap] = useState<Record<string, "idle" | "loading" | "diagnosing">>({});
  const [diagnosticResult, setDiagnosticResult] = useState<Record<string, { tokenValid: boolean; webhookSubscribed: boolean }>>({});

  // Flow assignment state
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [isFlowsLoading, setIsFlowsLoading] = useState(false);
  const [selectedFlowIdMap, setSelectedFlowIdMap] = useState<Record<string, string>>({});
  const [assigningMap, setAssigningMap] = useState<Record<string, boolean>>({});
  const [unassigningMap, setUnassigningMap] = useState<Record<string, boolean>>({});

  const loadPages = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bots/${id}/channels/facebook`);
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
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      "/api/integrations/facebook/auth",
      "facebook-auth",
      `width=${width},height=${height},top=${top},left=${left}`
    );

    const interval = setInterval(() => {
      if (window.closed) {
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
      const res = await fetch(`/api/bots/${botId}/channels/facebook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: page.id,
          pageName: page.name,
          accessToken: "legacy_handled_on_backend", // In a real flow, this might come from FB SDK
        }),
      });

      if (!res.ok) throw new Error("Failed to connect page");

      toast.success(`Page "${page.name}" connected!`);
      void loadPages(botId);
    } catch (error) {
      toast.error("Failed to connect page");
    } finally {
      setStatusMap((prev) => ({ ...prev, [page.id]: "idle" }));
    }
  };

  const handleDisconnectPage = async (page: FacebookPage) => {
    const confirmed = await confirm({
      title: "Disconnect Page",
      description: `Are you sure you want to disconnect "${page.name}"?`,
      confirmText: "Disconnect",
      variant: "destructive",
    });

    if (!confirmed) return;

    setStatusMap((prev) => ({ ...prev, [page.id]: "loading" }));
    try {
      const res = await fetch(`/api/bots/${botId}/channels/facebook/${page.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to disconnect page");

      toast.success(`Page "${page.name}" disconnected.`);
      void loadPages(botId);
    } catch (error) {
      toast.error("Failed to disconnect page");
    } finally {
      setStatusMap((prev) => ({ ...prev, [page.id]: "idle" }));
    }
  };

  const handleRunDiagnostics = async (page: FacebookPage) => {
    setStatusMap((prev) => ({ ...prev, [page.id]: "diagnosing" }));
    try {
      const res = await fetch(`/api/bots/${botId}/channels/facebook/${page.id}/check-connection`);
      if (res.ok) {
        const data = await res.json();
        setDiagnosticResult((prev) => ({ ...prev, [page.id]: data }));
        if (data.tokenValid && data.webhookSubscribed) {
          toast.success("Connection is healthy!");
        } else {
          toast.error("Connection issues detected.");
        }
      }
    } catch (error) {
      toast.error("Failed to run diagnostics");
    } finally {
      setStatusMap((prev) => ({ ...prev, [page.id]: "idle" }));
    }
  };

  const handleReconnectPage = async (page: FacebookPage) => {
    const diag = diagnosticResult[page.id];
    
    // If token is invalid, we must re-authenticate
    if (diag && !diag.tokenValid) {
      handleFacebookLogin();
      return;
    }

    setStatusMap((prev) => ({ ...prev, [page.id]: "loading" }));
    try {
      const res = await fetch(`/api/bots/${botId}/channels/facebook/reconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: page.id }),
      });

      if (res.ok) {
        toast.success("Connection restored!");
        void handleRunDiagnostics(page);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to reconnect");
        if (data.reauthRequired) {
           handleFacebookLogin();
        }
      }
    } catch (error) {
      toast.error("Failed to reconnect");
    } finally {
      setStatusMap((prev) => ({ ...prev, [page.id]: "idle" }));
    }
  };

  const handleAssignFlow = async (page: FacebookPage) => {
    const flowId = selectedFlowIdMap[page.id];
    if (!flowId) return;

    setAssigningMap((prev) => ({ ...prev, [page.id]: true }));
    try {
      const res = await fetch(`/api/bots/${botId}/channels/facebook/${page.id}/toggle-ai-engine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowId, enabled: true }),
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
      const res = await fetch(`/api/bots/${botId}/channels/facebook/${page.id}/toggle-ai-engine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });

      if (!res.ok) throw new Error("Failed to unassign flow");
      toast.success("Flow unassigned.");
      void loadPages(botId);
    } catch (error) {
      toast.error("Failed to unassign flow");
    } finally {
      setUnassigningMap((prev) => ({ ...prev, [page.id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <ChannelLimitWarning limitStatus={channelLimitStatus || limitStatus} />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Facebook Pages</CardTitle>
            <CardDescription>
              Manage which Facebook pages are connected to this bot.
            </CardDescription>
          </div>
          <div className="flex gap-2">
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
                            disabled={statusMap[page.id] === "loading"}
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
                      <div className="bg-slate-50 border rounded-lg overflow-hidden">
                        <ChannelFlowAssignmentCard
                          title="Page Flow Assignment"
                          description="Assign a specific automation flow to run when users message this page."
                          selectLabel="Assigned Flow"
                          selectId={`fb-flow-${page.id}`}
                          flows={flows}
                          isFlowsLoading={isFlowsLoading}
                          selectedFlowId={selectedFlowIdMap[page.id] || ""}
                          onSelectFlow={(val) => setSelectedFlowIdMap((prev) => ({ ...prev, [page.id]: val }))}
                          assignedFlowName={page.assignedFlow?.name}
                          unassignedDescription="No channel flow assigned. Bot default flow applies."
                          onAssign={() => handleAssignFlow(page)}
                          onUnassign={() => handleUnassignFlow(page)}
                          isAssigning={assigningMap[page.id]}
                          isUnassigning={unassigningMap[page.id]}
                          assignDisabled={
                            assigningMap[page.id] ||
                            !selectedFlowIdMap[page.id] ||
                            selectedFlowIdMap[page.id] === page.assignedFlow?.id
                          }
                          unassignDisabled={!page.assignedFlow || unassigningMap[page.id]}
                          compact={true}
                        />
                      </div>

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
                            {(!diagnosticResult[page.id].tokenValid || !diagnosticResult[page.id].webhookSubscribed) && (
                              <div className="pt-2 border-t mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full h-7 text-[10px]"
                                  onClick={() => handleReconnectPage(page)}
                                  disabled={statusMap[page.id] === "loading"}
                                >
                                  {statusMap[page.id] === "loading" ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                  )}
                                  Reconnect / Fix
                                </Button>
                              </div>
                            )}
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
