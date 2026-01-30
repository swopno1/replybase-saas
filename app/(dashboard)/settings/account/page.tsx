"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
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
import { User, Lock, Bell, Shield, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export default function AccountSettingsPage() {
  const { data: session, update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
  });

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
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

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
        body: JSON.stringify({
          email: session.user.email,
          source: "account",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to subscribe to newsletter");
      }

      toast.success("Subscribed to newsletter");
    } catch (error) {
      console.error("Newsletter subscribe error:", error);
      toast.error("Failed to subscribe to newsletter");
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
        body: JSON.stringify({
          email: session.user.email,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to unsubscribe from newsletter");
      }

      toast.success("Unsubscribed from newsletter");
    } catch (error) {
      console.error("Newsletter unsubscribe error:", error);
      toast.error("Failed to unsubscribe from newsletter");
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

      if (!response.ok) {
        throw new Error("Failed to submit deletion request");
      }

      const data = await response.json();
      toast.success("Data deletion request submitted");
      if (data.statusUrl) {
        window.location.href = data.statusUrl;
      }
    } catch (error) {
      console.error("Data deletion request error:", error);
      toast.error("Failed to submit deletion request");
    }
  };

  const handleDeleteAccount = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/users/account", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete account");
      }

      const data = await response.json();
      toast.success("Deletion request submitted");
      if (data.statusUrl) {
        window.location.href = data.statusUrl;
      } else {
        window.location.href = "/data-deletion-status";
      }
    } catch (error) {
      console.error("Account deletion error:", error);
      toast.error("Failed to delete account");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account information, security, and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
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
        </TabsList>

        {/* PROFILE TAB */}
        <TabsContent value="profile" className="space-y-6">
          {/* User Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information
              </CardDescription>
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

          {/* Account ID Card */}
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
          {/* Password Card */}
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

          {/* Two-Factor Authentication Card */}
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

          {/* Connected Devices Card */}
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
          {/* Email Notifications Card */}
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
              </div>

              <Separator />
              <Button>Save Preferences</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRIVACY TAB */}
        <TabsContent value="privacy" className="space-y-6">
          {/* Data Management Card */}
          <Card>
            <CardHeader>
              <CardTitle>Data & Privacy</CardTitle>
              <CardDescription>
                Manage your personal data and privacy settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="p-3 border rounded-md">
                  <h4 className="font-medium text-sm mb-2">
                    Download Your Data
                  </h4>
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

          {/* Danger Zone Card */}
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-900">Danger Zone</CardTitle>
              <CardDescription className="text-red-800">
                Irreversible actions that affect your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!showDeleteConfirm ? (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="gap-2"
                >
                  Delete Account
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-red-900">
                    Are you sure? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={handleDeleteAccount}
                      disabled={isLoading}
                    >
                      {isLoading ? "Deleting..." : "Yes, Delete My Account"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
