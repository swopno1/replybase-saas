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
  ExternalLink,
  Key,
} from "lucide-react";
import { toast } from "sonner";
import { ApiKeyManager } from "@/components/settings/api-key-manager";
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
  "developers",
] as const;

type SettingsTab = (typeof VALID_TABS)[number];

function SettingsTabsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, update } = useSession();
  const { confirm } = useConfirmation();

  const [activeTab, setActiveTab] = useState<SettingsTab>(
    (searchParams.get("tab") as SettingsTab) || "profile",
  );

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
  });

  const [aiLoading, setAiLoading] = useState(true);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSettings, setAiSettings] = useState({
    aiEnabled: false,
    aiProvider: "default",
    aiModel: "",
    aiApiKey: "",
  });

  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    const tab = searchParams.get("tab") as SettingsTab;
    if (tab && VALID_TABS.includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === "ai") {
      fetchAiSettings();
    }
  }, [activeTab]);

  const fetchAiSettings = async () => {
    try {
      const res = await fetch("/api/tenant/ai-settings");
      const data = await res.json();
      setAiSettings({
        aiEnabled: data.aiEnabled,
        aiProvider: data.aiProvider || "default",
        aiModel: data.aiModel || "",
        aiApiKey: data.aiApiKey || "",
      });
    } catch (err) {
      toast.error("Failed to load AI settings");
    } finally {
      setAiLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    const tab = value as SettingsTab;
    setActiveTab(tab);
    router.push(`/settings?tab=${tab}`, { scroll: false });
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
      });

      if (res.ok) {
        await update();
        toast.success("Profile updated successfully");
      } else {
        toast.error("Failed to update profile");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAiUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiSaving(true);

    try {
      const res = await fetch("/api/tenant/ai-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiSettings),
      });

      if (res.ok) {
        toast.success("AI settings updated");
      } else {
        toast.error("Failed to update AI settings");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setAiSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = await confirm({
      title: "Delete Account",
      message:
        "Are you sure you want to delete your account? This action is irreversible and all your data will be permanently removed.",
      confirmText: "Delete Account",
      variant: "destructive",
    });

    if (confirmed) {
      setIsDeletingAccount(true);
      try {
        const res = await fetch("/api/user/delete", { method: "DELETE" });
        if (res.ok) {
          toast.success("Account deleted");
          signOut({ callbackUrl: "/" });
        } else {
          toast.error("Failed to delete account");
        }
      } catch (err) {
        toast.error("Something went wrong");
      } finally {
        setIsDeletingAccount(false);
      }
    }
  };

  const handleDataDeletionRequest = async () => {
    try {
      const res = await fetch("/api/data-deletion", { method: "POST" });
      if (res.ok) {
        toast.success("Data deletion request submitted");
      } else {
        toast.error("Failed to submit request");
      }
    } catch (err) {
      toast.error("Something went wrong");
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-3 md:grid-cols-7 mb-8 h-auto p-1 bg-muted/50 rounded-xl">
        <TabsTrigger value="profile">
          <User className="h-4 w-4 mr-2" />
          Profile
        </TabsTrigger>
        <TabsTrigger value="security">
          <Lock className="h-4 w-4 mr-2" />
          Security
        </TabsTrigger>
        <TabsTrigger value="notifications">
          <Bell className="h-4 w-4 mr-2" />
          Alerts
        </TabsTrigger>
        <TabsTrigger value="privacy">
          <Shield className="h-4 w-4 mr-2" />
          Privacy
        </TabsTrigger>
        <TabsTrigger value="billing">
          <CreditCard className="h-4 w-4 mr-2" />
          Billing
        </TabsTrigger>
        <TabsTrigger value="ai">
          <Brain className="h-4 w-4 mr-2" />
          AI
        </TabsTrigger>
        <TabsTrigger value="developers">
          <Key className="h-4 w-4 mr-2" />
          Developers
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Update your account details and email address
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={profileData.name}
                  onChange={(e) =>
                    setProfileData({ ...profileData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  onChange={(e) =>
                    setProfileData({ ...profileData, email: e.target.value })
                  }
                />
              </div>
              <Button type="submit" disabled={profileLoading}>
                {profileLoading ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="security" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              Change your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input id="current-password" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" />
            </div>
            <Button>Update Password</Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="notifications" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Email Notifications</CardTitle>
            <CardDescription>
              Choose which notifications you want to receive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Security Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about unusual login activity
                </p>
              </div>
              <Button variant="outline" size="sm">
                Enabled
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Billing Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Receive invoices and payment confirmations
                </p>
              </div>
              <Button variant="outline" size="sm">
                Enabled
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="privacy" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>
              Control your data and how it&apos;s processed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Request Data Deletion</p>
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
              <a 
                href="https://replybase.co.uk/docs/platform/ai-workflows" 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-2 text-[10px] text-primary hover:underline flex items-center gap-1 font-bold"
              >
                Guide: Learn more about AI workflows <ExternalLink className="h-2 w-2" />
              </a>
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
                    <option value="digitalocean">DigitalOcean (High Performance)</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="gemini">Google Gemini (User Provided)</option>
                  </select>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      {aiSettings.aiProvider === "default"
                        ? "Uses Replybase-managed AI based on your plan. No configuration required."
                        : aiSettings.aiProvider === "digitalocean"
                        ? "Leverages high-performance models hosted on DigitalOcean Infrastructure."
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
                        placeholder={
                          aiSettings.aiProvider === "digitalocean" 
                            ? "DigitalOcean AI Key" 
                            : `Enter your ${aiSettings.aiProvider} API key`
                        }
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
                        {aiSettings.aiProvider === "digitalocean" && (
                          <>
                            <option value="openai-gpt-oss-120b">GPT-oss-120b (Premium)</option>
                            <option value="openai-gpt-oss-20b">GPT-oss-20b (Fast)</option>
                            <option value="llama3.3-70b-instruct">Llama 3.3 70B (State-of-the-Art)</option>
                            <option value="gemma-4-31B-it">Gemma 4 31B (Advanced)</option>
                          </>
                        )}
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
                            <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fast & Capable)</option>
                            <option value="gemini-2.0-pro-exp-02-05">Gemini 2.0 Pro (Experimental)</option>
                            <option value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy Fast)</option>
                            <option value="gemini-1.5-pro">Gemini 1.5 Pro (Legacy Advanced)</option>
                            <option value="gemma-2-27b-it">Gemma 2 27B</option>
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

      {/* DEVELOPERS TAB */}
      <TabsContent value="developers">
        <ApiKeyManager />
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
