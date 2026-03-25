"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { isChannelVisibleInUi } from "@/lib/channel-config";

export const dynamic = 'force-dynamic';

const showFacebookAssignment = isChannelVisibleInUi("facebook");

interface Flow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  language: string;
  fallbackMessage: string | null;
  maxTimeout: number;
  assignments?: FlowAssignment[];
  channelAssignments?: FlowChannelAssignment[];
}

interface FacebookPage {
  id: string;
  name: string;
  facebookId: string;
}

interface FlowAssignment {
  id: string;
  flowId: string;
  pageId: string;
  isActive: boolean;
}

interface ChannelOption {
  id: string;
  name: string;
  type: string;
  bot: {
    id: string;
    name: string;
  };
}

interface FlowChannelAssignment {
  id: string;
  flowId: string;
  channelId: string;
  isActive: boolean;
  channel: ChannelOption;
}

export default function FlowSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const flowId = params.id as string;

  const [flow, setFlow] = useState<Flow | null>(null);
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [currentAssignment, setCurrentAssignment] =
    useState<FlowAssignment | null>(null);
  const [currentChannelAssignment, setCurrentChannelAssignment] =
    useState<FlowChannelAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [language, setLanguage] = useState("en");
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [maxTimeout, setMaxTimeout] = useState(300);
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [flowResponse, pagesResponse, botsResponse] = await Promise.all([
        fetch(`/api/flows/${flowId}`),
        showFacebookAssignment
          ? fetch("/api/facebook/pages")
          : Promise.resolve(null),
        fetch("/api/bots"),
      ]);

      if (flowResponse.ok) {
        const flowData = await flowResponse.json();
        const flowInfo = flowData.flow;
        setFlow(flowInfo);
        setName(flowInfo.name);
        setDescription(flowInfo.description || "");
        setIsActive(flowInfo.isActive);
        setLanguage(flowInfo.language);
        setFallbackMessage(flowInfo.fallbackMessage || "");
        setMaxTimeout(flowInfo.maxTimeout);
        setCurrentAssignment(null);
        setCurrentChannelAssignment(null);
        setSelectedPageId("");
        setSelectedChannelId("");

        // Get current assignment
        if (flowInfo.assignments && flowInfo.assignments.length > 0) {
          const activeAssignment = flowInfo.assignments.find(
            (a: FlowAssignment) => a.isActive,
          );
          if (activeAssignment) {
            setCurrentAssignment(activeAssignment);
            setSelectedPageId(activeAssignment.pageId);
          }
        }

        if (
          flowInfo.channelAssignments &&
          flowInfo.channelAssignments.length > 0
        ) {
          const activeChannelAssignment = flowInfo.channelAssignments.find(
            (assignment: FlowChannelAssignment) => assignment.isActive,
          );
          if (activeChannelAssignment) {
            setCurrentChannelAssignment(activeChannelAssignment);
            setSelectedChannelId(activeChannelAssignment.channelId);
          }
        }
      }

      if (showFacebookAssignment && pagesResponse?.ok) {
        const pagesData = await pagesResponse.json();
        setPages(pagesData.pages || []);
      } else {
        setPages([]);
      }

      if (botsResponse.ok) {
        const botsData = await botsResponse.json();
        const botList: Array<{
          id: string;
          name: string;
          channels?: Array<{
            id: string;
            name: string;
            type: string;
          }>;
        }> = Array.isArray(botsData.bots)
          ? botsData.bots
          : Array.isArray(botsData.projects)
            ? botsData.projects.flatMap(
                (project: {
                  bots?: Array<{
                    id: string;
                    name: string;
                    channels?: Array<{
                      id: string;
                      name: string;
                      type: string;
                    }>;
                  }>;
                }) => (Array.isArray(project.bots) ? project.bots : []),
              )
            : [];

        const availableChannels: ChannelOption[] = botList.flatMap((bot) =>
          (bot.channels || [])
            .filter(
              (channel) =>
                !["facebook", "whatsapp"].includes(channel.type.toLowerCase()),
            )
            .map((channel) => ({
              id: channel.id,
              name: channel.name,
              type: channel.type,
              bot: {
                id: bot.id,
                name: bot.name,
              },
            })),
        );

        setChannels(availableChannels);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to load flow settings");
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/flows/${flowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          isActive,
          language,
          fallbackMessage,
          maxTimeout,
        }),
      });

      if (response.ok) {
        toast.success("Settings saved successfully");
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignToPage = async () => {
    if (!selectedPageId) {
      toast.error("Please select a page");
      return;
    }

    try {
      const response = await fetch(`/api/flows/${flowId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: selectedPageId }),
      });

      if (response.ok) {
        toast.success("Flow assigned to page successfully");
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to assign flow");
      }
    } catch (error) {
      console.error("Failed to assign flow:", error);
      toast.error("Failed to assign flow");
    }
  };

  const handleUnassignFromPage = async () => {
    if (!currentAssignment) return;

    try {
      const response = await fetch(
        `/api/flows/${flowId}/assign?pageId=${currentAssignment.pageId}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        toast.success("Flow unassigned successfully");
        setCurrentAssignment(null);
        setSelectedPageId("");
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to unassign flow");
      }
    } catch (error) {
      console.error("Failed to unassign flow:", error);
      toast.error("Failed to unassign flow");
    }
  };

  const handleAssignToChannel = async () => {
    if (!selectedChannelId) {
      toast.error("Please select a channel");
      return;
    }

    try {
      const response = await fetch(`/api/flows/${flowId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: selectedChannelId }),
      });

      if (response.ok) {
        toast.success("Flow assigned to channel successfully");
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to assign flow");
      }
    } catch (error) {
      console.error("Failed to assign flow:", error);
      toast.error("Failed to assign flow");
    }
  };

  const handleUnassignFromChannel = async () => {
    if (!currentChannelAssignment) return;

    try {
      const response = await fetch(
        `/api/flows/${flowId}/assign?channelId=${currentChannelAssignment.channelId}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        toast.success("Flow unassigned from channel successfully");
        setCurrentChannelAssignment(null);
        setSelectedChannelId("");
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to unassign flow");
      }
    } catch (error) {
      console.error("Failed to unassign flow:", error);
      toast.error("Failed to unassign flow");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!flow) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/flows")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Flow Settings</h1>
            <p className="text-muted-foreground">
              Configure {flow.name} settings
            </p>
          </div>
        </div>
        <Button onClick={handleSaveSettings} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Basic Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Settings</CardTitle>
            <CardDescription>
              Configure flow name and description
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Flow Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter flow name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this flow does..."
                rows={3}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="active">Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  Enable or disable this flow
                </p>
              </div>
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </CardContent>
        </Card>

        {/* Flow Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Flow Configuration</CardTitle>
            <CardDescription>
              Configure language and timeout settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="language">Default Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="pt">Portuguese</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fallback">Fallback Message</Label>
              <Textarea
                id="fallback"
                value={fallbackMessage}
                onChange={(e) => setFallbackMessage(e.target.value)}
                placeholder="Message to send when user input is not understood"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This message will be sent when the flow doesn&apos;t understand
                the user&apos;s response
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeout">Max Response Timeout (seconds)</Label>
              <Input
                id="timeout"
                type="number"
                value={maxTimeout}
                onChange={(e) => setMaxTimeout(parseInt(e.target.value) || 300)}
                min={60}
                max={3600}
              />
              <p className="text-xs text-muted-foreground">
                Maximum time to wait for user response before timing out
                (60-3600 seconds)
              </p>
            </div>
          </CardContent>
        </Card>

        {showFacebookAssignment && (
          <Card>
            <CardHeader>
              <CardTitle>Page Assignment</CardTitle>
              <CardDescription>
                Assign this flow to a Facebook page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pages.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground mb-4">
                    No Facebook pages connected
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/integrations/facebook")}
                  >
                    Connect Facebook Page
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="page">Select Page</Label>
                    <Select
                      value={selectedPageId}
                      onValueChange={setSelectedPageId}
                    >
                      <SelectTrigger id="page">
                        <SelectValue placeholder="Choose a page..." />
                      </SelectTrigger>
                      <SelectContent>
                        {pages.map((page) => (
                          <SelectItem key={page.id} value={page.id}>
                            {page.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Only one flow can be active per page at a time
                    </p>
                  </div>

                  {currentAssignment ? (
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">Currently Assigned</p>
                        <p className="text-sm text-muted-foreground">
                          {pages.find((p) => p.id === currentAssignment.pageId)
                            ?.name || "Unknown page"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleUnassignFromPage}
                      >
                        Unassign
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={handleAssignToPage}
                      disabled={!selectedPageId}
                    >
                      Assign to Page
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Channel Assignment */}
        <Card>
          <CardHeader>
            <CardTitle>Channel Assignment</CardTitle>
            <CardDescription>
              Assign this flow to a Telegram or Webchat channel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {channels.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground mb-2">
                  No Telegram or Webchat channels found
                </p>
                <p className="text-xs text-muted-foreground">
                  Create Telegram or Webchat channels in Integrations first.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="channel">Select Channel</Label>
                  <Select
                    value={selectedChannelId}
                    onValueChange={setSelectedChannelId}
                  >
                    <SelectTrigger id="channel">
                      <SelectValue placeholder="Choose a channel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          {channel.bot.name} - {channel.name} ({channel.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Only one flow can be active per channel at a time
                  </p>
                </div>

                {currentChannelAssignment ? (
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">Currently Assigned</p>
                      <p className="text-sm text-muted-foreground">
                        {currentChannelAssignment.channel.bot.name} -{" "}
                        {currentChannelAssignment.channel.name} ({" "}
                        {currentChannelAssignment.channel.type})
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleUnassignFromChannel}
                    >
                      Unassign
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleAssignToChannel}
                    disabled={!selectedChannelId}
                  >
                    Assign to Channel
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
