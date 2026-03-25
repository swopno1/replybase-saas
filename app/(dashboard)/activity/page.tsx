"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import {
  AlertCircle,
  Bot,
  CreditCard,
  Loader2,
  LogIn,
  LogOut,
  MessageCircle,
  RefreshCw,
  Settings,
  Sparkles,
  User,
  UserPlus,
} from "lucide-react";

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  entityType?: string | null;
  entityId?: string | null;
  source: "logged" | "derived";
}

const activityTypeOptions = [
  { value: "all", label: "All activity types" },
  { value: "bot_created", label: "Bot created" },
  { value: "contact_created", label: "Contact added" },
  { value: "lead_created", label: "Lead captured" },
  { value: "conversation_created", label: "Conversation created" },
  { value: "subscription_updated", label: "Subscription updated" },
  { value: "settings_updated", label: "Settings updated" },
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
  { value: "onboarding_milestone", label: "Onboarding milestone" },
  { value: "system_event", label: "System event" },
] as const;

function getActivityIcon(type: string) {
  switch (type) {
    case "bot_created":
      return <Bot className="h-4 w-4" />;
    case "contact_created":
      return <UserPlus className="h-4 w-4" />;
    case "lead_created":
    case "onboarding_milestone":
      return <Sparkles className="h-4 w-4" />;
    case "conversation_created":
      return <MessageCircle className="h-4 w-4" />;
    case "subscription_updated":
      return <CreditCard className="h-4 w-4" />;
    case "settings_updated":
      return <Settings className="h-4 w-4" />;
    case "login":
      return <LogIn className="h-4 w-4" />;
    case "logout":
      return <LogOut className="h-4 w-4" />;
    default:
      return <User className="h-4 w-4" />;
  }
}

function getActivityColor(type: string) {
  switch (type) {
    case "bot_created":
      return "bg-green-50 text-green-700";
    case "contact_created":
      return "bg-sky-50 text-sky-700";
    case "lead_created":
      return "bg-emerald-50 text-emerald-700";
    case "conversation_created":
      return "bg-yellow-50 text-yellow-700";
    case "subscription_updated":
      return "bg-violet-50 text-violet-700";
    case "settings_updated":
      return "bg-gray-50 text-gray-700";
    case "login":
      return "bg-green-50 text-green-700";
    case "logout":
      return "bg-gray-50 text-gray-700";
    case "onboarding_milestone":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-gray-50 text-gray-700";
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function humanizeMetadataKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (value) => value.toUpperCase());
}

function getMetadataEntries(metadata: Record<string, unknown> | undefined) {
  if (!metadata) {
    return [];
  }

  return Object.entries(metadata)
    .filter(([, value]) => {
      return (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      );
    })
    .slice(0, 4)
    .map(([key, value]) => ({
      key,
      label: humanizeMetadataKey(key),
      value: String(value),
    }));
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchActivities() {
      try {
        setError(null);
        setLoading(true);

        const searchParams = new URLSearchParams({
          limit: "100",
          days: "30",
        });

        if (selectedType !== "all") {
          searchParams.set("type", selectedType);
        }

        const response = await fetch(
          `/api/activities?${searchParams.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Failed to load activities");
        }

        const data = (await response.json()) as { activities?: Activity[] };
        setActivities(Array.isArray(data.activities) ? data.activities : []);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Failed to fetch activities:", fetchError);
        setError("Failed to load activity history.");
        setActivities([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void fetchActivities();

    return () => controller.abort();
  }, [selectedType]);

  async function handleRefresh() {
    try {
      setRefreshing(true);
      setError(null);

      const searchParams = new URLSearchParams({
        limit: "100",
        days: "30",
      });

      if (selectedType !== "all") {
        searchParams.set("type", selectedType);
      }

      const response = await fetch(
        `/api/activities?${searchParams.toString()}`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to refresh activities");
      }

      const data = (await response.json()) as { activities?: Activity[] };
      setActivities(Array.isArray(data.activities) ? data.activities : []);
    } catch (refreshError) {
      console.error("Failed to refresh activities:", refreshError);
      setError("Failed to refresh activity history.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
          <p className="text-muted-foreground">
            View recent tenant activity across bots, contacts, leads, and
            onboarding events
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-55">
              <SelectValue placeholder="Filter activity type" />
            </SelectTrigger>
            <SelectContent>
              {activityTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
          <CardDescription>
            All logged and derived events from the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Unable to load activity</p>
                <p>{error}</p>
              </div>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No activity found for the selected filter.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => {
                const metadataEntries = getMetadataEntries(activity.metadata);

                return (
                  <div
                    key={activity.id}
                    className="flex gap-4 border-b pb-4 last:border-b-0"
                  >
                    <div
                      className={`h-fit rounded-lg p-2 ${getActivityColor(activity.type)}`}
                    >
                      {getActivityIcon(activity.type)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-medium">{activity.title}</h4>
                            <Badge
                              variant={
                                activity.source === "logged"
                                  ? "default"
                                  : "outline"
                              }
                            >
                              {activity.source === "logged"
                                ? "Logged"
                                : "Derived"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {activity.description}
                          </p>
                        </div>
                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(activity.createdAt)}
                        </span>
                      </div>

                      {metadataEntries.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {metadataEntries.map((entry) => (
                            <span
                              key={`${activity.id}-${entry.key}`}
                              className="inline-flex items-center rounded bg-muted px-2 py-1"
                            >
                              {entry.label}: {entry.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/40">
        <CardHeader>
          <CardTitle className="text-sm">How This Feed Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            The feed combines explicit activity records with derived recent
            events from existing tenant data, so it is useful immediately after
            rollout.
          </p>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>
              <span className="font-medium text-foreground">Logged events</span>{" "}
              - stored via the activities API or helper
            </li>
            <li>
              <span className="font-medium text-foreground">
                Derived events
              </span>{" "}
              - recent bots, contacts, leads, and onboarding milestones
            </li>
            <li>
              Logged events take precedence so newly instrumented write paths do
              not show duplicate entries.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
