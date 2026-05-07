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
  ShieldCheck,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { FacebookLogo } from "@/components/icons/MetaIcons";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { isChannelVisibleInUi } from "@/lib/channel-config";
import { useConfirmation } from "@/components/ui/confirmation-provider";
import { BotSelector } from "@/components/bot-selector";

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
  botId?: string | null;
}

interface Bot {
  id: string;
  name: string;
}

export default function FacebookIntegrationPage() {
  const router = useRouter();
  const { confirm } = useConfirmation();
  const channelVisible = isChannelVisibleInUi("facebook");
  const [isLoading, setIsLoading] = useState(true);
  const [pages, setPages] = useState<FBPage[]>([]);
  const [accountConnected, setAccountConnected] = useState(false);
  const [statusMap, setStatusMap] = useState<
    Record<string, string | undefined>
  >({});

  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);

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
  const [checkingMap, setCheckingMap] = useState<Record<string, boolean>>({});
  const [diagnosticResult, setDiagnosticResult] = useState<Record<string, any>>(
    {},
  );

  useEffect(() => {
    if (!channelVisible) {
      router.replace("/");
      return;
    }
    loadBots();
    fetchPages();
  }, [channelVisible, router]);

  const loadBots = async () => {
    try {
      const res = await fetch("/api/bots");
      const data = await res.json();
      if (data.bots && data.bots.length > 0) {
        setBots(data.bots);
        setSelectedBotId(data.bots[0].id);
      }
    } catch (e) {
      console.error("Failed to load bots", e);
    }
  };

  const fetchPages = async () => {
    try {
      setIsLoading(true);
      const pagesResponse = await fetch("/api/facebook/user-pages");

      const data = await pagesResponse.json();
      if (!pagesResponse.ok) {
        const errMsg =
          typeof data?.error === "string"
            ? data.error
            : "Failed to fetch Facebook pages";
        throw new Error(errMsg);
      }

      setPages(data.pages || []);
      setAccountConnected(data.connected || false);

      if (data.reason === "stale_token") {
        toast.error("Facebook connection expired. Please reconnect.");
      }
    } catch (error) {
      console.error("Error fetching pages:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load pages",
      );
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
    } catch (error) {
      console.error("Error fetching flows:", error);
    } finally {
      setIsFlowsLoading(false);
    }
  };

  useEffect(() => {
    if (accountConnected) {
      loadFlows();
    }
  }, [accountConnected]);

  const handleConnectPage = async (page: FBPage) => {
    if (!selectedBotId) {
      toast.error("Please select a bot first");
      return;
    }

    setStatusMap((prev) => ({ ...prev, [page.id]: "loading" }));
    try {
      const res = await fetch(`/api/bots/${selectedBotId}/channels/facebook`, {
        method: "POST",
        body: JSON.stringify({
          pageId: page.id,
          pageName: page.name,
          accessToken: page.access_token,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to connect page");
      }

      toast.success(\`Connected \${page.name}\`);
      fetchPages();
    } catch (error) {
      console.error("Error connecting page:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to connect page",
      );
    } finally {
      setStatusMap((prev) => ({ ...prev, [page.id]: undefined }));
    }
  };

  const handleUnlinkPage = async (page: FBPage) => {
    const internalPageId = page.internalId;
    const botIdOfPage = page.botId || selectedBotId;

    if (!internalPageId || !botIdOfPage) return;

    const confirmed = await confirm({
      title: "Unlink Facebook Page",
      description: \`Are you sure you want to unlink \"\${page.name}\"? This will delete all conversation history and leads associated with this page.\`,
      confirmText: "Unlink Page",
      variant: "destructive",
    });

    if (!confirmed) return;

    setStatusMap((prev) => ({ ...prev, [page.id]: "unlinking" }));
    try {
      const res = await fetch(
        \`/api/bots/\${botIdOfPage}/channels/facebook/\${page.id}\`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        },
      );
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to unlink page");
      }

      toast.success(\`Unlinked \${page.name}\`);
      fetchPages();
    } catch (error) {
      console.error("Error unlinking page:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to unlink page",
      );
    } finally {
      setStatusMap((prev) => ({ ...prev, [page.id]: undefined }));
    }
  };

  const handleDisconnect = async () => {
    const confirmed = await confirm({
      title: "Disconnect Facebook",
      description:
        "This will disconnect your Facebook account and UNLINK ALL pages. All Facebook conversation history will be deleted.",
      confirmText: "Disconnect Account",
      variant: "destructive",
    });
    if (!confirmed) return;

    try {
      setIsLoading(true);
      const res = await fetch("/api/facebook/disconnect", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to disconnect Facebook account");
      }

      toast.success("Facebook account disconnected");
      fetchPages();
    } catch (error) {
      console.error("Error disconnecting:", error);
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
    const flowId = selectedFlowIdMap[page.id];

    if (!internalPageId) return;
    if (!flowId) {
      toast.error("Select a flow to assign");
      return;
    }
    setAssigningMap((prev) => ({ ...prev, [page.id]: true }));
    try {
      const res = await fetch(\`/api/flows/\${flowId}/assign\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: internalPageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign flow");

      toast.success(\`Flow assigned to \${page.name}\`);
      fetchPages();
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
    const assignedFlowId = page.assignedFlow?.id;

    if (!internalPageId) return;
    if (!assignedFlowId) {
      toast.error("No assigned flow found");
      return;
    }
    setUnassigningMap((prev) => ({ ...prev, [page.id]: true }));
    try {
      const res = await fetch(
        \`/api/flows/\${assignedFlowId}/assign?pageId=\${encodeURIComponent(internalPageId)}\`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to unassign flow");

      toast.success(\`Flow unassigned from \${page.name}\`);
      fetchPages();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to unassign flow",
      );
    } finally {
      setUnassigningMap((prev) => ({ ...prev, [page.id]: false }));
    }
  };

  const handleCheckConnection = async (page: FBPage) => {
    const botIdOfPage = page.botId || selectedBotId;
    if (!botIdOfPage) return;

    setCheckingMap((prev) => ({ ...prev, [page.id]: true }));
    setDiagnosticResult((prev) => ({ ...prev, [page.id]: undefined }));
    try {
      const res = await fetch(
        \`/api/bots/\${botIdOfPage}/channels/facebook/\${page.id}/check-connection\`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to check connection");

      setDiagnosticResult((prev) => ({ ...prev, [page.id]: data }));
      toast.success("Diagnostics complete");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to run diagnostics",
      );
    } finally {
      setCheckingMap((prev) => ({ ...prev, [page.id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/bots">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Facebook Integration</h1>
        </div>
      </div>

      {!accountConnected ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FacebookLogo className="h-6 w-6" />
              Connect your Facebook Account
            </CardTitle>
            <CardDescription>
              Connect your Facebook account to manage your pages and automate
              your messages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">Requirements:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>You must have a Facebook Business Page</li>
                <li>You must be an admin of the page</li>
                <li>You must grant all requested permissions</li>
              </ul>
            </div>
            <Button
              className="w-full sm:w-auto"
              onClick={() => signIn("facebook")}
            >
              <FacebookLogo className="mr-2 h-4 w-4" />
              Sign in with Facebook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Connected Facebook Account
              </p>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleDisconnect}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Disconnect Account
              </Button>
            </div>

            <div className="w-full sm:w-64">
              <BotSelector
                bots={bots}
                selectedBotId={selectedBotId}
                onSelectBot={(id) => setSelectedBotId(id)}
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Your Facebook Pages</CardTitle>
              <CardDescription>
                Select which pages you want to connect to ReplyBase.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No Facebook pages found.</p>
                  <p className="text-sm">
                    Make sure you are an admin of at least one page.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {pages.map((page) => (
                    <div
                      key={page.id}
                      className="py-6 first:pt-0 last:pb-0 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            {page.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-semibold">{page.name}</h3>
                            <p className="text-xs text-muted-foreground font-mono">
                              ID: {page.id}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {page.connected ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-amber-600 hover:text-amber-700"
                                onClick={() => handleCheckConnection(page)}
                                disabled={checkingMap[page.id]}
                              >
                                {checkingMap[page.id] ? (
                                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                ) : (
                                  <ShieldCheck className="mr-2 h-3 w-3" />
                                )}
                                Diagnostics
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleUnlinkPage(page)}
                                disabled={statusMap[page.id] === "unlinking"}
                              >
                                {statusMap[page.id] === "unlinking" ? (
                                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="mr-2 h-3 w-3" />
                                )}
                                Unlink
                              </Button>
                              <Badge variant="secondary" className="gap-1">
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                                Connected
                                {page.botId && (
                                  <span className="opacity-70 ml-1">
                                    (Bot: {bots.find(b => b.id === page.botId)?.name || page.botId})
                                  </span>
                                )}
                              </Badge>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleConnectPage(page)}
                              disabled={
                                statusMap[page.id] === "loading" ||
                                !selectedBotId
                              }
                            >
                              {statusMap[page.id] === "loading" ? (
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              ) : (
                                <Zap className="mr-2 h-3 w-3" />
                              )}
                              Connect Page
                            </Button>
                          )}
                        </div>
                      </div>

                      {page.connected && (
                        <div className="grid gap-4 sm:grid-cols-2 mt-4 ml-13">
                          {/* Flow Assignment Section */}
                          <Card className="bg-slate-50 border-none shadow-none">
                            <CardContent className="pt-4 space-y-3">
                              <div className="space-y-1">
                                <Label className="text-xs">
                                  Page Flow Assignment
                                </Label>
                                <div className="flex gap-2">
                                  <Select
                                    value={
                                      selectedFlowIdMap[page.id] ||
                                      page.assignedFlow?.id ||
                                      ""
                                    }
                                    onValueChange={(val) =>
                                      setSelectedFlowIdMap((prev) => ({
                                        ...prev,
                                        [page.id]: val,
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs bg-white">
                                      <SelectValue placeholder="Select flow" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {flows.map((f) => (
                                        <SelectItem
                                          key={f.id}
                                          value={f.id}
                                          className="text-xs"
                                        >
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
                                      selectedFlowIdMap[page.id] ===
                                        page.assignedFlow?.id
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

                          {/* Diagnostics result if any */}
                          {diagnosticResult[page.id] && (
                            <Card className="bg-white border-none shadow-sm">
                              <CardContent className="pt-4 space-y-2 text-[10px]">
                                <div className="flex justify-between">
                                  <span>Token Valid:</span>
                                  <span
                                    className={
                                      diagnosticResult[page.id].tokenValid
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }
                                  >
                                    {diagnosticResult[page.id].tokenValid
                                      ? "Yes"
                                      : "No"}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Webhook Subscribed:</span>
                                  <span
                                    className={
                                      diagnosticResult[page.id]
                                        .webhookSubscribed
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }
                                  >
                                    {diagnosticResult[page.id].webhookSubscribed
                                      ? "Yes"
                                      : "No"}
                                  </span>
                                </div>
                                {diagnosticResult[page.id].missingPermissions
                                  ?.length > 0 && (
                                  <div className="text-red-600 pt-1">
                                    <p className="font-bold">
                                      Missing Permissions:
                                    </p>
                                    <ul className="list-disc pl-3">
                                      {diagnosticResult[page.id].missingPermissions.map(
                                        (p: string) => (
                                          <li key={p}>{p}</li>
                                        ),
                                      )}
                                    </ul>
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
        </div>
      )}
    </div>
  );
}

function Badge({
  children,
  variant = "default",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "outline" | "destructive";
  className?: string;
}) {
  const variants = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    outline: "text-foreground border border-input",
    destructive: "bg-destructive text-destructive-foreground",
  };

  return (
    <div
      className={\`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 \${variants[variant]} \${className}\`}
    >
      {children}
    </div>
  );
}

function Label({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return <label className={\`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 \${className}\`}>{children}</label>
}
