"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Lock,
  Bell,
  Shield,
  Copy,
  Check,
  CreditCard,
  Brain,
} from "lucide-react";
import { toast } from "sonner";
import BillingTabContent from "@/components/settings/billing-tab";
import { useConfirmation } from "@/components/ui/confirmation-provider";
import { trackEvent } from "@/lib/client-analytics";

const VALID_TABS = [
  "profile",
  "security",
  "notifications",
  "privacy",
  "billing",
  "ai",
] as const;

type SettingsTab = (typeof VALID_TABS)[number];

function SettingsTabsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, update } = useSession();
  const { confirm } = useConfirmation();

  const rawTab = searchParams.get("tab");
  const activeTab: SettingsTab = VALID_TABS.includes(rawTab as SettingsTab)
    ? (rawTab as SettingsTab)
    : "profile";

  const handleTabChange = (value: string) => {
    router.push(`/settings?tab=${value}`, { scroll: false });
  };

  const [isLoading, setIsLoading] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [notificationDestinations, setNotificationDestinations] = useState({
    emailRecipients: "",
    telegramChatIds: "",
  });
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [notificationsTesting, setNotificationsTesting] = useState(false);
  const [formData, setFormData] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
  });

  const [aiSettings, setAiSettings] = useState({
    aiProvider: "default",
    aiModel: "",
    aiApiKey: "",
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;

    const loadLeadNotificationSettings = async () => {
      setNotificationsLoading(true);
      try {
        const response = await fetch("/api/tenant/lead-notifications");
        if (!response.ok)
          throw new Error("Failed to load lead notification settings");

        const data = (await response.json()) as {
          emailRecipients?: string[];
          telegramChatIds?: string[];
        };

        if (cancelled) return;

        setNotificationDestinations({
          emailRecipients: (data.emailRecipients || []).join(", "),
          telegramChatIds: (data.telegramChatIds || []).join(", "),
        });
      } catch (error) {
        console.error("Lead notification settings load error:", error);
        if (!cancelled)
          toast.error("Failed to load lead notification settings");
      } finally {
        if (!cancelled) setNotificationsLoading(false);
      }
    };

    const loadAiSettings = async () => {
      setAiLoading(true);
      try {
        const response = await fetch("/api/tenant/ai-settings");
        if (!response.ok) throw new Error("Failed to load AI settings");
        const data = await response.json();
        if (cancelled) return;
        setAiSettings({
          aiProvider: data.aiProvider || "default",
          aiModel: data.aiModel || "",
          aiApiKey: data.hasApiKey ? "********" : "",
        });
      } catch (error) {
        console.error("AI settings load error:", error);
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    };

    void loadLeadNotificationSettings();
    void loadAiSettings();
    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  if (!session?.user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Not authenticated</p>
      </div>
    );
  }

  const handleCopyUserId = () => {
    if (session?.user?.id) {
      navigator.clipboard.writeText(session.user.id);
      setCopied(true);
      toast.success("User ID copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name, email: formData.email }),
      });
      if (!response.ok) throw new Error("Failed to update profile");
      await update();
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const formDataObj = new FormData(e.currentTarget);
      const response = await fetch("/api/users/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: formDataObj.get("currentPassword"),
          newPassword: formDataObj.get("newPassword"),
          confirmPassword: formDataObj.get("confirmPassword"),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to change password");
      }
      toast.success("Password changed successfully");
      e.currentTarget.reset();
    } catch (error) {
      console.error("Password change error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to change password",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewsletterSubscribe = async () => {
    if (!session?.user?.email) return;
    setNewsletterLoading(true);
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: session.user.email, source: "account" }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Failed to subscribe to newsletter");
      }
      const data = (await response.json().catch(() => null)) as {
        alreadySubscribed?: boolean;
        message?: string;
      } | null;

      if (data?.alreadySubscribed) {
        toast.info(
          data.message || "You are already subscribed to the newsletter",
        );
      } else {
        trackEvent("newsletter_signup", {
          properties: {
            source: "account",
          },
        });
        toast.success(data?.message || "Subscribed to newsletter");
      }
    } catch (error) {
      console.error("Newsletter subscribe error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to subscribe to newsletter",
      );
    } finally {
      setNewsletterLoading(false);
    }
  };

  const handleNewsletterUnsubscribe = async () => {
    if (!session?.user?.email) return;
    setNewsletterLoading(true);
    try {
      const response = await fetch("/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: session.user.email }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Failed to unsubscribe from newsletter");
      }
      const data = (await response.json().catch(() => null)) as {
        alreadyUnsubscribed?: boolean;
        message?: string;
      } | null;

      if (data?.alreadyUnsubscribed) {
        toast.info(
          data.message || "You are already unsubscribed from the newsletter",
        );
      } else {
        toast.success(data?.message || "Unsubscribed from newsletter");
      }
    } catch (error) {
      console.error("Newsletter unsubscribe error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to unsubscribe from newsletter",
      );
    } finally {
      setNewsletterLoading(false);
    }
  };

  const handleDataDeletionRequest = async () => {
    try {
      const response = await fetch("/api/data-deletion/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session?.user?.email,
          source: "account",
        }),
      });
      if (!response.ok) throw new Error("Failed to submit deletion request");
      const data = await response.json();
      toast.success("Data deletion request submitted");
      if (data.statusUrl) window.location.href = data.statusUrl;
    } catch (error) {
      console.error("Data deletion request error:", error);
      toast.error("Failed to submit deletion request");
    }
  };

  const handleSaveLeadNotificationDestinations = async () => {
    setNotificationsSaving(true);
    try {
      const emailRecipients = notificationDestinations.emailRecipients
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      const telegramChatIds = notificationDestinations.telegramChatIds
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      const response = await fetch("/api/tenant/lead-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailRecipients, telegramChatIds }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Failed to save lead destinations");
      }
      toast.success("Lead notification destinations saved");
    } catch (error) {
      console.error("Lead notification settings save error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save lead notification settings",
      );
    } finally {
      setNotificationsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = await confirm({
      title: "Delete Account",
      description:
        "This action is permanent. Type DELETE to confirm account deletion.",
      confirmText: "Delete Account",
      variant: "destructive",
      requireText: "DELETE",
      requireTextPlaceholder: "Type DELETE",
    });

    if (!confirmed) {
      return;
    }

    setIsDeletingAccount(true);
    try {
      const response = await fetch("/api/users/account", { method: "DELETE" });
      const data = (await response.json().catch(() => null)) as {
        redirectTo?: string;
        deletedScope?: "user" | "tenant";
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete account");
      }

      const deletedScope = data?.deletedScope;
      toast.success(
        deletedScope === "tenant"
          ? "Your account and workspace have been deleted"
          : "Your account has been deleted",
      );

      await signOut({ redirect: false });
      window.location.href = data?.redirectTo || "/auth/login?accountDeleted=1";
    } catch (error) {
      console.error("Account deletion error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete account",
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleAiUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiSaving(true);
    try {
      const response = await fetch("/api/tenant/ai-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiSettings),
      });
      if (!response.ok) throw new Error("Failed to update AI settings");
      toast.success("AI settings updated successfully");
    } catch (error) {
      console.error("AI update error:", error);
      toast.error("Failed to update AI settings");
    } finally {
      setAiSaving(false);
    }
  };

  const handleSendTestNotification = async () => {
    setNotificationsTesting(true);
    try {
      const response = await fetch("/api/tenant/lead-notifications/test", {
        method: "POST",
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        results?: {
          telegram?: {
            delivered: number;
            failed: number;
            attempted: boolean;
            errors?: string[];
          };
          email?: {
            delivered: number;
            failed: number;
            attempted: boolean;
            errors?: string[];
          };
        };
      } | null;

      if (!response.ok)
        throw new Error(data?.error || "Failed to send test notification");

      const tg = data?.results?.telegram;
      const em = data?.results?.email;
      const telegramDelivered = tg?.delivered ?? 0;
      const emailDelivered = em?.delivered ?? 0;
      const telegramAttempted = tg?.attempted ?? false;
      const emailAttempted = em?.attempted ?? false;

      const allErrors = [...(tg?.errors ?? []), ...(em?.errors ?? [])];

      if (!telegramAttempted && !emailAttempted) {
        // Nothing is configured at all
        toast.warning(
          "No notification destinations configured. Add your email or Telegram chat ID in Notification Settings.",
        );
      } else if (telegramDelivered + emailDelivered === 0) {
        // Attempted but everything failed — show the actual reason
        const reason = allErrors.length
          ? allErrors.join(" | ")
          : "Check your configured recipients and Telegram channel connection.";
        toast.error(`Test delivery failed: ${reason}`);
      } else {
        const parts: string[] = [];
        if (emailAttempted)
          parts.push(
            `Email: ${emailDelivered} delivered${em?.failed ? `, ${em.failed} failed` : ""}`,
          );
        if (telegramAttempted)
          parts.push(
            `Telegram: ${telegramDelivered} delivered${tg?.failed ? `, ${tg.failed} failed` : ""}`,
          );
        toast.success(`Test notification sent — ${parts.join(" · ")}`);
      }
    } catch (error) {
      console.error("Lead notification test error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to send test notification",
      );
    } finally {
      setNotificationsTesting(false);
    }
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="space-y-6"
    >
      <TabsList className="w-full flex justify-start overflow-x-auto overflow-y-hidden no-scrollbar flex-nowrap whitespace-nowrap">
        <TabsTrigger value="profile">
          <User className="mr-2 h-4 w-4" />
          Profile
        </TabsTrigger>
        <TabsTrigger value="security">
          <Lock className="mr-2 h-4 w-4" />
          Security
        </TabsTrigger>
        <TabsTrigger value="notifications">
          <Bell className="mr-2 h-4 w-4" />
          Notifications
        </TabsTrigger>
        <TabsTrigger value="privacy">
          <Shield className="mr-2 h-4 w-4" />
          Privacy
        </TabsTrigger>
        <TabsTrigger value="billing">
          <CreditCard className="mr-2 h-4 w-4" />
          Billing
        </TabsTrigger>
        <TabsTrigger value="ai">
          <Brain className="mr-2 h-4 w-4" />
          AI
        </TabsTrigger>
      </TabsList>

      {/* PROFILE TAB */}
      <TabsContent value="profile" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Used for login and notifications
                </p>
              </div>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account ID</CardTitle>
            <CardDescription>
              Your unique account identifier (for support inquiries)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <code className="flex-1 text-sm font-mono break-all">
                {session?.user?.id}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyUserId}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* SECURITY TAB */}
      <TabsContent value="security" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  placeholder="Enter your current password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  placeholder="Enter a new password"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use at least 8 characters with a mix of letters and numbers
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm your new password"
                  required
                />
              </div>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Two-Factor Authentication</CardTitle>
            <CardDescription>
              Add an extra layer of security to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Two-factor authentication is coming soon. Protect your account
              with a second verification method.
            </p>
            <Button disabled>Enable 2FA</Button>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Connected Devices</CardTitle>
            <CardDescription>
              Manage devices that have access to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Device management is coming soon. You&apos;ll be able to see and
              revoke access from devices here.
            </p>
            <Button disabled>View Devices</Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* NOTIFICATIONS TAB */}
      <TabsContent value="notifications" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Email Notifications</CardTitle>
            <CardDescription>
              Choose what updates you&apos;d like to receive via email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-md">
                <div>
                  <p className="font-medium text-sm">Billing Updates</p>
                  <p className="text-xs text-muted-foreground">
                    Invoice and payment notifications
                  </p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-md">
                <div>
                  <p className="font-medium text-sm">Feature Updates</p>
                  <p className="text-xs text-muted-foreground">
                    New features and improvements
                  </p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-md">
                <div>
                  <p className="font-medium text-sm">Security Alerts</p>
                  <p className="text-xs text-muted-foreground">
                    Login attempts and security issues
                  </p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-md">
                <div>
                  <p className="font-medium text-sm">Product News</p>
                  <p className="text-xs text-muted-foreground">
                    Tips, tricks, and general announcements
                  </p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>

              <div className="p-3 border rounded-md space-y-2">
                <div>
                  <p className="font-medium text-sm">Marketing Newsletter</p>
                  <p className="text-xs text-muted-foreground">
                    Receive product updates and growth tips
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleNewsletterSubscribe}
                    disabled={newsletterLoading}
                  >
                    Subscribe
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleNewsletterUnsubscribe}
                    disabled={newsletterLoading}
                  >
                    Unsubscribe
                  </Button>
                </div>
              </div>

              <div className="p-3 border rounded-md space-y-3">
                <div>
                  <p className="font-medium text-sm">Lead Alert Destinations</p>
                  <p className="text-xs text-muted-foreground">
                    These destinations receive instant notifications when a new
                    website lead is captured.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leadNotificationEmails">
                    Destination emails (comma-separated)
                  </Label>
                  <Input
                    id="leadNotificationEmails"
                    placeholder="owner@company.com, sales@company.com"
                    value={notificationDestinations.emailRecipients}
                    onChange={(event) =>
                      setNotificationDestinations((prev) => ({
                        ...prev,
                        emailRecipients: event.target.value,
                      }))
                    }
                    disabled={notificationsLoading || notificationsSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leadNotificationTelegram">
                    Telegram chat IDs (comma-separated)
                  </Label>
                  <Input
                    id="leadNotificationTelegram"
                    placeholder="123456789, -1009876543210"
                    value={notificationDestinations.telegramChatIds}
                    onChange={(event) =>
                      setNotificationDestinations((prev) => ({
                        ...prev,
                        telegramChatIds: event.target.value,
                      }))
                    }
                    disabled={notificationsLoading || notificationsSaving}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use chat IDs from your own Telegram destinations. ReplyBase
                    will send notifications using your tenant Telegram channel.
                  </p>
                </div>
              </div>
            </div>

            <Separator />
            <Button
              onClick={handleSaveLeadNotificationDestinations}
              disabled={
                notificationsLoading ||
                notificationsSaving ||
                notificationsTesting
              }
            >
              {notificationsSaving ? "Saving..." : "Save Preferences"}
            </Button>
            <Button
              variant="outline"
              onClick={handleSendTestNotification}
              disabled={
                notificationsLoading ||
                notificationsSaving ||
                notificationsTesting
              }
            >
              {notificationsTesting
                ? "Sending Test..."
                : "Send Test Notification"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* PRIVACY TAB */}
      <TabsContent value="privacy" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Data &amp; Privacy</CardTitle>
            <CardDescription>
              Manage your personal data and privacy settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="p-3 border rounded-md">
                <h4 className="font-medium text-sm mb-2">Download Your Data</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Get a copy of all your personal data in a portable format
                </p>
                <Button variant="outline" size="sm">
                  Download as JSON
                </Button>
              </div>
              <div className="p-3 border rounded-md">
                <h4 className="font-medium text-sm mb-2">Delete Your Data</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Remove all your personal information from our servers
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDataDeletionRequest}
                >
                  Request Deletion
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Danger Zone</CardTitle>
            <CardDescription className="text-red-800">
              Irreversible actions that affect your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              className="gap-2"
              disabled={isDeletingAccount}
            >
              {isDeletingAccount ? "Submitting..." : "Delete Account"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* BILLING TAB */}
      <TabsContent value="billing">
        <BillingTabContent />
      </TabsContent>

      {/* AI SETTINGS TAB */}
      <TabsContent value="ai" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>AI Provider Settings</CardTitle>
            <CardDescription>
              Configure your preferred AI engine for fallback messaging and bot
              responses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {aiLoading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Loading AI settings...
              </div>
            ) : (
              <form onSubmit={handleAiUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="aiProvider">AI Provider</Label>
                  <select
                    id="aiProvider"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={aiSettings.aiProvider}
                    onChange={(e) =>
                      setAiSettings({
                        ...aiSettings,
                        aiProvider: e.target.value,
                        aiModel: "",
                      })
                    }
                  >
                    <option value="default">Default (Replybase Managed)</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="gemini">Google Gemini (User Provided)</option>
                  </select>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      {aiSettings.aiProvider === "default"
                        ? "Uses Replybase-managed Gemini 1.5 Flash/Pro based on your plan. No configuration required."
                        : "Configure your own API credentials and model selection below."}
                    </p>
                  </div>
                </div>

                {aiSettings.aiProvider !== "default" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="aiApiKey">API Key</Label>
                      <Input
                        id="aiApiKey"
                        type="password"
                        placeholder={`Enter your ${aiSettings.aiProvider} API key`}
                        value={aiSettings.aiApiKey}
                        onChange={(e) =>
                          setAiSettings({
                            ...aiSettings,
                            aiApiKey: e.target.value,
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Your API key is stored securely and never exposed to the
                        client.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="aiModel">Model Selection</Label>
                      <select
                        id="aiModel"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        value={aiSettings.aiModel}
                        onChange={(e) =>
                          setAiSettings({
                            ...aiSettings,
                            aiModel: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="" disabled>
                          Select a model
                        </option>
                        {aiSettings.aiProvider === "openai" && (
                          <>
                            <option value="gpt-4o">GPT-4o (Advanced)</option>
                            <option value="gpt-4o-mini">
                              GPT-4o mini (Fast & Economical)
                            </option>
                          </>
                        )}
                        {aiSettings.aiProvider === "anthropic" && (
                          <>
                            <option value="claude-3-5-sonnet-latest">
                              Claude 3.5 Sonnet (Advanced)
                            </option>
                            <option value="claude-3-haiku-latest">
                              Claude 3 Haiku (Fast)
                            </option>
                          </>
                        )}
                        {aiSettings.aiProvider === "gemini" && (
                          <>
                            <option value="gemini-3-flash-preview">
                              Gemini 3 Flash (Premium)
                            </option>
                            <option value="gemini-3.1-flash-lite-preview">
                              Gemini 3.1 Flash Lite (Main)
                            </option>
                            <option value="gemini-2.5-flash-lite">
                              Gemini 2.5 Flash Lite (Fallback)
                            </option>
                            <option value="gemma-2-27b-it">
                              Gemma 2 27B
                            </option>
                          </>
                        )}
                      </select>
                      <p className="text-xs text-muted-foreground">
                        Choose from our curated list of high-performance models.
                      </p>
                    </div>
                  </>
                )}

                <Button type="submit" disabled={aiSaving}>
                  {aiSaving ? "Saving..." : "Save AI Settings"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Usage Information</CardTitle>
            <CardDescription>
              Details about how AI is used in ReplyBase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              ReplyBase uses AI to provide fallback responses when your flows
              don&apos;t have a match for a user&apos;s message.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Free/Starter:</strong> Uses cost-effective models (Gemini
                3.1 Flash Lite, GPT-4o-mini).
              </li>
              <li>
                <strong>Pro/Business:</strong> Uses advanced models with more
                context (Gemini 3 Flash, GPT-4o, Claude 3.5 Sonnet).
              </li>
            </ul>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

export function SettingsTabs() {
  return (
    <Suspense
      fallback={<div className="h-12 bg-muted rounded-lg animate-pulse" />}
    >
      <SettingsTabsInner />
    </Suspense>
  );
}
