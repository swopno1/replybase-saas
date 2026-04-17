"use client";

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
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  Loader2,
  MessageSquare,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ExternalLink,
  Trash2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { isChannelVisibleInUi } from "@/lib/channel-config";
import { useConfirmation } from "@/components/ui/confirmation-provider";

export const dynamic = "force-dynamic";

interface FlowOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface AssignedFlow {
  flowId: string;
  id: string;
  name: string;
  isActive: boolean;
}

interface FBPage {
  id: string;
  name: string;
  access_token: string;
  category: string;
  connected?: boolean;
  engineConnected?: boolean;
  webhookSubscribed?: boolean;
  internalId?: string | null;
  assignedFlow?: AssignedFlow | null;
}

interface MetaSetupStatus {
  facebook?: {
    oauthConfigured: boolean;
    webhookVerifyTokenConfigured: boolean;
    oauthCallbackUrl: string;
    webhookCallbackUrl: string;
    requiredScopes: string[];
  };
}

export default function FacebookIntegrationPage() {
  const router = useRouter();
  const { confirm } = useConfirmation();
  const channelVisible = isChannelVisibleInUi("facebook");
  const [isLoading, setIsLoading] = useState(true);
  const [pages, setPages] = useState<FBPage[]>([]);
  const [connected, setConnected] = useState(false);
  const [setupStatus, setSetupStatus] = useState<MetaSetupStatus | null>(null);
  const [statusMap, setStatusMap] = useState<
    Record<string, string | undefined>
  >({});

  // Flow assignment state
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [isFlowsLoading, setIsFlowsLoading] = useState(false);
  const [selectedFlowIdMap, setSelectedFlowIdMap] = useState<
    Record<string, string>
  >({});
  const [assigningMap, setAssigningMap] = useState<Record<string, boolean>>({});
  const [unassigningMap, setUnassigningMap] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    if (!channelVisible) {
      router.replace("/");
      return;
    }
    fetchPages();
  }, [channelVisible, router]);

  if (!channelVisible) {
    return null;
  }

  const fetchPages = async () => {
    try {
      setIsLoading(true);
      const [pagesResponse, setupResponse] = await Promise.all([
        fetch("/api/integrations/facebook/pages"),
        fetch("/api/meta/setup-status"),
      ]);

      const data = await pagesResponse.json();
      if (!pagesResponse.ok) {
        const errMsg =
          typeof data?.error === "string"
            ? data.error
            : "Failed to load Facebook pages";
        throw new Error(errMsg);
      }

      if (data.connected) {
        setConnected(true);
        setPages(data.pages || []);
        // Seed selected-flow map from any existing assignments
        const initialFlowMap: Record<string, string> = {};
        for (const page of data.pages || []) {
          if (page.assignedFlow?.flowId) {
            initialFlowMap[page.id] = page.assignedFlow.flowId;
          }
        }
        setSelectedFlowIdMap(initialFlowMap);
        await loadFlows();
      } else {
        setConnected(false);
        setPages([]);
      }

      if (setupResponse.ok) {
        const setupData = (await setupResponse.json()) as MetaSetupStatus;
        setSetupStatus(setupData);
      }
    } catch (e) {
      console.error(e);
      setConnected(false);
      setPages([]);
      const message =
        e instanceof Error ? e.message : "Failed to load Facebook pages";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFlows = async () => {
    setIsFlowsLoading(true);
    try {
      const res = await fetch("/api/flows?isActive=true&type=my");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load flows");
      const flowList: FlowOption[] = Array.isArray(data.flows)
        ? data.flows.map((f: FlowOption) => ({
            id: f.id,
            name: f.name,
            isActive: f.isActive,
          }))
        : [];
      setFlows(flowList);
    } catch {
      toast.error("Failed to load flows");
    } finally {
      setIsFlowsLoading(false);
    }
  };

  const handleConnectPage = async (page: FBPage) => {
    setStatusMap((prev) => ({ ...prev, [page.id]: "loading" }));
    try {
      const res = await fetch("/api/integrations/facebook", {
        method: "POST",
        body: JSON.stringify({
          pageId: page.id,
          pageName: page.name,
          accessToken: page.access_token,
          accessTokenOnly: true,
        }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to connect page");
      }
      setStatusMap((prev) => ({ ...prev, [page.id]: "success" }));
      toast.success(`Successfully connected ${page.name}`);
      await fetchPages();
    } catch (error) {
      console.error("Error connecting page:", error);
      setStatusMap((prev) => ({ ...prev, [page.id]: "error" }));
      toast.error(
        error instanceof Error ? error.message : "Failed to connect page",
      );
    }
  };

  const handleUnlinkPage = async (page: FBPage) => {
    const confirmed = await confirm({
      title: "Unlink Page",
      description: `Are you sure you want to unlink "${page.name}"? You can reconnect it later.`,
      confirmText: "Unlink",
      variant: "destructive",
    });
    if (!confirmed) return;
    setStatusMap((prev) => ({ ...prev, [page.id]: "unlinking" }));
    try {
      const res = await fetch(`/api/integrations/facebook/pages/${page.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to unlink page");
      }
      setStatusMap((prev) => ({ ...prev, [page.id]: undefined }));
      toast.success(`Successfully unlinked ${page.name}`);
      await fetchPages();
    } catch (error) {
      console.error("Error unlinking page:", error);
      setStatusMap((prev) => ({ ...prev, [page.id]: "error" }));
      toast.error(
        error instanceof Error ? error.message : "Failed to unlink page",
      );
    }
  };

  const handleUnlinkAllPages = async () => {
    const confirmed = await confirm({
      title: "Disconnect Facebook Account",
      description:
        "This will remove all connected pages, their flow assignments, and revoke ReplyBase's access from your Meta account. You can reconnect at any time.",
      confirmText: "Disconnect All",
      variant: "destructive",
    });
    if (!confirmed) return;

    try {
      setIsLoading(true);
      const res = await fetch("/api/integrations/facebook", {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to disconnect Facebook account");
      }
      setConnected(false);
      setPages([]);
      setSelectedFlowIdMap({});
      toast.success("Facebook account disconnected successfully");
      await fetchPages();
    } catch (error) {
      console.error("Error disconnecting Facebook account:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to disconnect Facebook account",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignFlow = async (page: FBPage) => {
    const internalPageId = page.internalId;
    if (!internalPageId) {
      toast.error("Connect the page first before assigning a flow");
      return;
    }
    const flowId = selectedFlowIdMap[page.id];
    if (!flowId) {
      toast.error("Select a flow to assign");
      return;
    }
    setAssigningMap((prev) => ({ ...prev, [page.id]: true }));
    try {
      const res = await fetch(`/api/flows/${flowId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: internalPageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign flow");
      toast.success(`Flow assigned to ${page.name}`);
      await fetchPages();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to assign flow",
      );
    } finally {
      setAssigningMap((prev) => ({ ...prev, [page.id]: false }));
    }
  };

  const handleUnassignFlow = async (page: FBPage) => {
    const internalPageId = page.internalId;
    const assignedFlowId = page.assignedFlow?.flowId;
    if (!internalPageId || !assignedFlowId) {
      toast.error("No assigned flow found");
      return;
    }
    setUnassigningMap((prev) => ({ ...prev, [page.id]: true }));
    try {
      const res = await fetch(
        `/api/flows/${assignedFlowId}/assign?pageId=${encodeURIComponent(internalPageId)}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to unassign flow");
      toast.success(`Flow unassigned from ${page.name}`);
      setSelectedFlowIdMap((prev) => ({ ...prev, [page.id]: "" }));
      await fetchPages();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to unassign flow",
      );
    } finally {
      setUnassigningMap((prev) => ({ ...prev, [page.id]: false }));
    }
  };

  const connectedPagesCount = pages.filter(
    (p) => p.connected || p.engineConnected,
  ).length;
  const activePagesCount = pages.filter((p) => p.engineConnected).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Facebook Pages</h1>
        <p className="text-muted-foreground mt-1">
          Connect your Facebook Pages, assign flows, and enable AI auto-replies
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Effective Response Mode</CardTitle>
          <CardDescription>
            How ReplyBase decides what responds to incoming Facebook messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            1. If an active flow is assigned to the page, that flow handles the
            message first.
          </p>
          <p>
            2. If no active flow handles the message and AI is enabled for the
            page, AI generates the reply.
          </p>
          <p>
            3. If neither flow nor AI is active, no automated reply is sent.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meta Setup Checklist</CardTitle>
          <CardDescription>
            Verify your Facebook app setup before connecting pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            OAuth callback URL:
            <span className="ml-2 rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">
              {setupStatus?.facebook?.oauthCallbackUrl || "Loading..."}
            </span>
          </p>
          <p>
            Webhook callback URL:
            <span className="ml-2 rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">
              {setupStatus?.facebook?.webhookCallbackUrl || "Loading..."}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded px-2 py-1 text-xs ${
                setupStatus?.facebook?.oauthConfigured
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              OAuth credentials{" "}
              {setupStatus?.facebook?.oauthConfigured ? "ready" : "missing"}
            </span>
            <span
              className={`rounded px-2 py-1 text-xs ${
                setupStatus?.facebook?.webhookVerifyTokenConfigured
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              Webhook verify token{" "}
              {setupStatus?.facebook?.webhookVerifyTokenConfigured
                ? "ready"
                : "missing"}
            </span>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : !connected ? (
        /* Not Connected State */
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Connect Your Facebook Account
            </CardTitle>
            <CardDescription>
              Link your Facebook account to access and manage your Facebook
              Pages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You&apos;ll need to authorize ReplyBase to access your Facebook
              Pages and send messages on your behalf.
            </p>
            <Button
              onClick={() => signIn("facebook")}
              size="lg"
              className="w-full sm:w-auto"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Connect with Facebook
            </Button>
            <div className="text-xs text-muted-foreground pt-2">
              We only request permissions for pages you manage and messaging
              capabilities.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary Card */}
          {pages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Connection Summary</CardTitle>
                <CardDescription>
                  Overview of your Facebook Pages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <div className="text-2xl font-bold">{pages.length}</div>
                    <div className="text-sm text-muted-foreground">
                      Total Pages
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {connectedPagesCount}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Connected
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{activePagesCount}</div>
                    <div className="text-sm text-muted-foreground">
                      AI Enabled
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pages List */}
          <Card>
            <CardHeader>
              <CardTitle>Your Facebook Pages</CardTitle>
              <CardDescription>
                Connect pages, assign flows, and enable AI responses per page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No pages found</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-md">
                    We couldn&apos;t find any Facebook Pages associated with
                    your account. Make sure you&apos;re an admin of at least one
                    Facebook Page.
                  </p>
                  <Button variant="outline" onClick={() => signIn("facebook")}>
                    Re-connect Facebook Account
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {pages.map((page) => {
                    const isConnected = page.connected || page.engineConnected;
                    const isEngineConnected = page.engineConnected;
                    const isWebhookSubscribed = page.webhookSubscribed ?? false;
                    const isPageLoading = statusMap[page.id] === "loading";
                    const isError = statusMap[page.id] === "error";
                    const isAssigning = assigningMap[page.id] ?? false;
                    const isUnassigning = unassigningMap[page.id] ?? false;
                    const selectedFlowId = selectedFlowIdMap[page.id] ?? "";

                    return (
                      <div
                        key={page.id}
                        className="border rounded-lg p-4 space-y-4 hover:bg-muted/30 transition-colors"
                      >
                        {/* Page header row */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="mt-0.5">
                              {isEngineConnected ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                              ) : isConnected ? (
                                <CheckCircle2 className="h-5 w-5 text-blue-500" />
                              ) : (
                                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold">{page.name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {page.category}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                {isEngineConnected && (
                                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                    <CheckCircle2 className="h-3 w-3" />
                                    AI Enabled
                                  </span>
                                )}
                                {isConnected && !isEngineConnected && (
                                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                    Connected
                                  </span>
                                )}
                                {page.assignedFlow && (
                                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                    <Zap className="h-3 w-3" />
                                    Flow: {page.assignedFlow.name}
                                  </span>
                                )}
                                {isConnected && (
                                  <span
                                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                                      isWebhookSubscribed
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                                    }`}
                                  >
                                    {isWebhookSubscribed ? (
                                      <>
                                        <CheckCircle2 className="h-3 w-3" />
                                        Receiving messages
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="h-3 w-3" />
                                        Not receiving messages
                                      </>
                                    )}
                                  </span>
                                )}
                                {isError && (
                                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                                    <XCircle className="h-3 w-3" />
                                    Connection Failed
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="shrink-0">
                            {isPageLoading ? (
                              <Button disabled size="sm">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Connecting...
                              </Button>
                            ) : statusMap[page.id] === "unlinking" ? (
                              <Button disabled size="sm">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Unlinking...
                              </Button>
                            ) : isEngineConnected ? (
                              <div className="flex gap-2">
                                <Link href="/ai-status">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs"
                                  >
                                    Manage AI
                                    <ExternalLink className="ml-1 h-3 w-3" />
                                  </Button>
                                </Link>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUnlinkPage(page)}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : isConnected ? (
                              <div className="flex gap-2">
                                <Link href="/ai-status">
                                  <Button variant="default" size="sm">
                                    Enable AI
                                  </Button>
                                </Link>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUnlinkPage(page)}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleConnectPage(page)}
                                disabled={isPageLoading}
                              >
                                Connect
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Flow assignment section — only for connected pages */}
                        {isConnected && (
                          <div className="border-t pt-3 space-y-2">
                            <div className="text-xs font-medium text-muted-foreground">
                              Flow Assignment
                            </div>
                            {page.assignedFlow ? (
                              <div className="flex items-center gap-3">
                                <div className="flex-1 text-sm">
                                  <span className="text-muted-foreground">
                                    Active flow:
                                  </span>{" "}
                                  <span className="font-medium">
                                    {page.assignedFlow.name}
                                  </span>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnassignFlow(page)}
                                  disabled={isUnassigning}
                                >
                                  {isUnassigning ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    "Remove flow"
                                  )}
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Select
                                  value={selectedFlowId}
                                  onValueChange={(val) =>
                                    setSelectedFlowIdMap((prev) => ({
                                      ...prev,
                                      [page.id]: val,
                                    }))
                                  }
                                  disabled={
                                    isFlowsLoading || flows.length === 0
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs flex-1">
                                    <SelectValue
                                      placeholder={
                                        isFlowsLoading
                                          ? "Loading flows..."
                                          : flows.length === 0
                                            ? "No active flows available"
                                            : "Select a flow..."
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {flows.map((flow) => (
                                      <SelectItem key={flow.id} value={flow.id}>
                                        {flow.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  onClick={() => handleAssignFlow(page)}
                                  disabled={
                                    !selectedFlowId ||
                                    isAssigning ||
                                    isFlowsLoading
                                  }
                                >
                                  {isAssigning ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  ) : (
                                    <Zap className="mr-1 h-3 w-3" />
                                  )}
                                  Assign
                                </Button>
                              </div>
                            )}
                            {flows.length === 0 && !isFlowsLoading && (
                              <p className="text-xs text-muted-foreground">
                                No active flows found. Flows must be set to{" "}
                                <strong>Active</strong> before they can be
                                assigned.{" "}
                                <Link
                                  href="/flows"
                                  className="underline hover:text-foreground"
                                >
                                  Go to Flows
                                </Link>{" "}
                                and activate or create one.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-sm">Next Steps</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                After connecting a page, assign a <strong>Flow</strong> to
                handle automated conversations, or go to{" "}
                <strong>AI Status</strong> to enable AI replies.
              </p>
              <p>
                A flow takes priority over AI. If a flow is assigned and active,
                it handles messages first.
              </p>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              variant="destructive"
              onClick={handleUnlinkAllPages}
              disabled={!connected}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Disconnect All
            </Button>
            <Button variant="outline" onClick={() => signIn("facebook")}>
              Re-connect Facebook Account
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
