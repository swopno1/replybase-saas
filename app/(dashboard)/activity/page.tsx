"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  Bot,
  MessageCircle,
  Settings,
  CreditCard,
  LogIn,
  LogOut,
  User,
} from "lucide-react";

interface Activity {
  id: string;
  type:
    | "bot_created"
    | "bot_updated"
    | "bot_deleted"
    | "conversation"
    | "subscription"
    | "login"
    | "settings";
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case "bot_created":
    case "bot_updated":
    case "bot_deleted":
      return <Bot className="h-4 w-4" />;
    case "conversation":
      return <MessageCircle className="h-4 w-4" />;
    case "subscription":
      return <CreditCard className="h-4 w-4" />;
    case "settings":
      return <Settings className="h-4 w-4" />;
    case "login":
      return <LogIn className="h-4 w-4" />;
    case "logout":
      return <LogOut className="h-4 w-4" />;
    default:
      return <User className="h-4 w-4" />;
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case "bot_created":
      return "bg-green-50 text-green-700";
    case "bot_updated":
      return "bg-blue-50 text-blue-700";
    case "bot_deleted":
      return "bg-red-50 text-red-700";
    case "subscription":
      return "bg-purple-50 text-purple-700";
    case "conversation":
      return "bg-yellow-50 text-yellow-700";
    case "settings":
      return "bg-gray-50 text-gray-700";
    case "login":
      return "bg-green-50 text-green-700";
    case "logout":
      return "bg-gray-50 text-gray-700";
    default:
      return "bg-gray-50 text-gray-700";
  }
};

const formatDate = (dateString: string) => {
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
};

// Mock data - in production, this would come from an API
const getMockActivities = (): Activity[] => [
  {
    id: "1",
    type: "login",
    title: "Account Login",
    description: "You logged in to your account",
    timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
  },
  {
    id: "2",
    type: "subscription",
    title: "Plan Upgrade",
    description: "Upgraded from Free plan to Pro plan",
    timestamp: new Date(Date.now() - 1 * 3600000).toISOString(),
    metadata: { from: "free", to: "pro" },
  },
  {
    id: "3",
    type: "bot_created",
    title: "Bot Created",
    description: "Created new bot: Customer Support Bot",
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    metadata: { botName: "Customer Support Bot", botId: "bot_123" },
  },
  {
    id: "4",
    type: "conversation",
    title: "Conversation Activity",
    description: "5 new conversations in Customer Support Bot",
    timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
    metadata: { botName: "Customer Support Bot", count: 5 },
  },
  {
    id: "5",
    type: "settings",
    title: "Settings Updated",
    description: "Updated account settings",
    timestamp: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

export default function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with actual API call
    // const fetchActivities = async () => {
    //   try {
    //     const response = await fetch("/api/activities");
    //     if (response.ok) {
    //       const data = await response.json();
    //       setActivities(data.activities);
    //     }
    //   } catch (error) {
    //     console.error("Failed to fetch activities:", error);
    //   } finally {
    //     setLoading(false);
    //   }
    // };
    // fetchActivities();

    // For now, use mock data
    setTimeout(() => {
      setActivities(getMockActivities());
      setLoading(false);
    }, 500);
  }, []);

  const filteredActivities = activities;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-muted-foreground">
          View all actions and events related to your account and bots
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
          <CardDescription>
            All actions performed on your account and bots in the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No activities yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Timeline View */}
              <div className="space-y-4">
                {filteredActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex gap-4 border-b pb-4 last:border-b-0"
                  >
                    {/* Icon */}
                    <div
                      className={`p-2 rounded-lg h-fit ${getActivityColor(activity.type)}`}
                    >
                      {getActivityIcon(activity.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium">{activity.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {activity.description}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(activity.timestamp)}
                        </span>
                      </div>

                      {/* Metadata */}
                      {activity.metadata && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {activity.metadata.botName && (
                            <span className="inline-block bg-muted px-2 py-1 rounded">
                              Bot: {activity.metadata.botName}
                            </span>
                          )}
                          {activity.metadata.from && activity.metadata.to && (
                            <span className="inline-block bg-muted px-2 py-1 rounded ml-2">
                              {activity.metadata.from} → {activity.metadata.to}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note about Activity API */}
      <Card className="bg-muted">
        <CardHeader>
          <CardTitle className="text-sm">Implementation Note</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            The Activity Log currently displays mock data. To enable real
            activity tracking, implement:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>
              <code className="bg-background px-1 rounded">
                POST /api/activities
              </code>{" "}
              - Log activity events
            </li>
            <li>
              <code className="bg-background px-1 rounded">
                GET /api/activities
              </code>{" "}
              - Fetch activity history
            </li>
            <li>
              Database table to store activity records (type, title,
              description, metadata, timestamp)
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
