"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface FBPage {
  id: string;
  name: string;
  access_token: string;
  category: string;
  connected?: boolean;
  engineConnected?: boolean;
}

export default function FacebookIntegrationPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [pages, setPages] = useState<FBPage[]>([]);
  const [connected, setConnected] = useState(false);
  const [statusMap, setStatusMap] = useState<
    Record<string, string | undefined>
  >({});

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/integrations/facebook/pages");
      const data = await res.json();
      if (data.connected) {
        setConnected(true);
        setPages(data.pages || []);
      } else {
        setConnected(false);
        setPages([]);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load Facebook pages");
    } finally {
      setIsLoading(false);
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
    if (
      !confirm(
        `Are you sure you want to unlink "${page.name}"? You can reconnect it later.`,
      )
    ) {
      return;
    }

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
    if (
      !confirm(
        "Are you sure you want to disconnect your Facebook account? All linked pages will be unlinked. You can reconnect them later.",
      )
    ) {
      return;
    }

    try {
      setIsLoading(true);
      // Unlink all connected pages
      const connectedPageIds = pages
        .filter((p) => p.connected || p.engineConnected)
        .map((p) => p.id);

      for (const pageId of connectedPageIds) {
        const res = await fetch(`/api/integrations/facebook/pages/${pageId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          throw new Error("Failed to unlink one or more pages");
        }
      }

      toast.success("Facebook account disconnected successfully");
      setConnected(false);
      setPages([]);
    } catch (error) {
      console.error("Error disconnecting Facebook account:", error);
      toast.error("Failed to disconnect Facebook account");
      setIsLoading(false);
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
          Connect your Facebook Pages to enable AI auto-replies
        </p>
      </div>

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
                Select pages to connect with ReplyBase. After connecting, enable
                AI replies in the AI Status page.
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
                <div className="space-y-3">
                  {pages.map((page) => {
                    const isConnected = page.connected || page.engineConnected;
                    const isEngineConnected = page.engineConnected;
                    const isLoading = statusMap[page.id] === "loading";
                    const isError = statusMap[page.id] === "error";

                    return (
                      <div
                        key={page.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
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
                            <div className="flex items-center gap-2 mt-2">
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
                              {isError && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                                  <XCircle className="h-3 w-3" />
                                  Connection Failed
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 shrink-0">
                          {isLoading ? (
                            <Button disabled>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Connecting...
                            </Button>
                          ) : statusMap[page.id] === "unlinking" ? (
                            <Button disabled>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Unlinking...
                            </Button>
                          ) : isEngineConnected ? (
                            <div className="flex flex-col items-end gap-2">
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
                            </div>
                          ) : isConnected ? (
                            <div className="flex gap-2">
                              <Link href="/ai-status">
                                <Button variant="default">Enable AI</Button>
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
                              onClick={() => handleConnectPage(page)}
                              disabled={isLoading}
                            >
                              Connect
                            </Button>
                          )}
                        </div>
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
                After connecting a page, go to the <strong>AI Status</strong>{" "}
                page to enable automatic replies.
              </p>
              <p>
                You can manage which pages have AI enabled and monitor activity
                in the <strong>Activity</strong> page.
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
