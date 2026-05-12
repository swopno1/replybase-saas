"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SimulationLab } from "@/components/admin/simulation/SimulationLab";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  ArrowLeft,
  Save,
  User,
  Bot,
  Activity,
  CreditCard,
  History, Flask,
  Shield,
  ExternalLink,
  Plus,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirmation } from "@/components/ui/confirmation-provider";

interface Plan {
  id: string;
  name: string;
  price: number;
}

interface UserData {
  id: string;
  name: string | null;
  email: string | null;
  isAdmin: boolean;
  createdAt: string;
}

interface BotData {
  id: string;
  name: string;
  enabled: boolean;
  entryFlow: string | null;
  channels: Array<{
    id: string;
    type: string;
    isActive: boolean;
    flowAssignments: {
      flowId: string;
      flow: { name: string };
    } | null;
  }>;
}

interface FlowData {
  id: string;
  name: string;
  isActive: boolean;
  _count: {
    sessions: number;
    leads: number;
  };
}

interface LogData {
  id: string;
  type: string;
  title: string;
  description: string;
  createdAt: string;
  user?: {
    name: string | null;
    email: string | null;
  };
}

interface ExecutionLogData {
  id: string;
  bot: { name: string };
  user: { name: string | null; email: string | null };
  direction: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface SubscriberData {
  id: string;
  status: string;
  currentPeriodEnd: string | null;
  stripeId: string | null;
  plan: Plan;
  tenant: {
    id: string;
    name: string;
    users: UserData[];
    bots: BotData[];
    flows: FlowData[];
    activityLogs: LogData[];
  };
}

export default function SubscriberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const { id } = use(params);
  const { confirm } = useConfirmation();
  const [data, setData] = useState<{
    subscription: SubscriberData;
    executionLogs: ExecutionLogData[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingFlow, setCreatingFlow] = useState(false);
  const [createFlowDialogOpen, setCreateFlowDialogOpen] = useState(false);
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowDescription, setNewFlowDescription] = useState("");

  const [creatingBot, setCreatingBot] = useState(false);
  const [createBotDialogOpen, setCreateBotDialogOpen] = useState(false);
  const [newBotName, setNewBotName] = useState("");
  const [editingBot, setEditingBot] = useState<BotData | null>(null);
  const [editBotDialogOpen, setEditBotDialogOpen] = useState(false);

  const [plans, setPlans] = useState<Plan[]>([]);

  // Form states
  const [status, setStatus] = useState("");
  const [planId, setPlanId] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  useEffect(() => {
    fetchData();
    fetchPlans();
  }, [id]);

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/admin/subscribers/${id}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setStatus(result.subscription.status);
        setPlanId(result.subscription.plan.id);
        setPeriodEnd(
          result.subscription.currentPeriodEnd
            ? new Date(result.subscription.currentPeriodEnd)
              .toISOString()
              .split("T")[0]
            : "",
        );
      } else {
        toast.error("Failed to fetch subscriber data");
      }
    } catch (error) {
      console.error("Error fetching subscriber:", error);
      toast.error("Error loading subscriber");
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await fetch("/api/admin/plans");
      if (response.ok) {
        const result = await response.json();
        setPlans(result.plans);
      }
    } catch (error) {
      console.error("Error fetching plans:", error);
    }
  };

  const handleUpdateSubscription = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/subscribers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          planId,
          currentPeriodEnd: periodEnd ? new Date(periodEnd).toISOString() : null,
        }),
      });

      if (response.ok) {
        toast.success("Subscription updated successfully");
        fetchData();
      } else {
        toast.error("Failed to update subscription");
      }
    } catch (error) {
      console.error("Error updating subscription:", error);
      toast.error("Error updating subscription");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUserAdmin = async (userId: string, currentStatus: boolean) => {
    const confirmed = await confirm({
      title: currentStatus ? "Revoke Admin Privileges" : "Grant Admin Privileges",
      description: `Are you sure you want to ${currentStatus ? "revoke" : "grant"
        } admin privileges for this user?`,
      confirmText: currentStatus ? "Revoke" : "Grant",
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: !currentStatus }),
      });

      if (response.ok) {
        toast.success("User updated successfully");
        fetchData();
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to update user");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Error updating user");
    }
  };

  const handleCreateBot = async () => {
    if (!data?.subscription) return;

    setCreatingBot(true);
    try {
      const response = await fetch("/api/admin/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: data.subscription.tenant.id,
          name: newBotName,
        }),
      });

      if (response.ok) {
        toast.success("Bot created successfully");
        setCreateBotDialogOpen(false);
        setNewBotName("");
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create bot");
      }
    } catch (error) {
      console.error("Error creating bot:", error);
      toast.error("Error creating bot");
    } finally {
      setCreatingBot(false);
    }
  };

  const handleUpdateBot = async () => {
    if (!editingBot) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/bots/${editingBot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingBot.name,
          enabled: editingBot.enabled,
        }),
      });

      if (response.ok) {
        toast.success("Bot updated successfully");
        setEditBotDialogOpen(false);
        setEditingBot(null);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update bot");
      }
    } catch (error) {
      console.error("Error updating bot:", error);
      toast.error("Error updating bot");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBotStatus = async (botId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/bots/${botId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentStatus }),
      });

      if (response.ok) {
        toast.success(`Bot ${!currentStatus ? "enabled" : "disabled"} successfully`);
        fetchData();
      } else {
        toast.error("Failed to update bot status");
      }
    } catch (error) {
      console.error("Error toggling bot status:", error);
      toast.error("Error toggling bot status");
    }
  };

  const handleToggleChannelStatus = async (channelId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/channels/${channelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (response.ok) {
        toast.success(`Channel ${!currentStatus ? "activated" : "deactivated"} successfully`);
        fetchData();
      } else {
        toast.error("Failed to update channel status");
      }
    } catch (error) {
      console.error("Error toggling channel status:", error);
      toast.error("Error toggling channel status");
    }
  };

  const handleAssignChannelFlow = async (channelId: string, flowId: string) => {
    try {
      const response = await fetch(`/api/admin/channels/${channelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowId }),
      });

      if (response.ok) {
        toast.success("Flow assigned to channel successfully");
        fetchData();
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to assign flow");
      }
    } catch (error) {
      console.error("Error assigning flow:", error);
      toast.error("Error assigning flow");
    }
  };

  const handleCreateFlow = async () => {
    if (!data?.subscription) return;

    setCreatingFlow(true);
    try {
      const response = await fetch("/api/admin/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: data.subscription.tenant.id,
          name: newFlowName,
          description: newFlowDescription,
        }),
      });

      if (response.ok) {
        toast.success("Flow created successfully");
        setCreateFlowDialogOpen(false);
        setNewFlowName("");
        setNewFlowDescription("");
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create flow");
      }
    } catch (error) {
      console.error("Error creating flow:", error);
      toast.error("Error creating flow");
    } finally {
      setCreatingFlow(false);
    }
  };


  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Subscriber not found</h2>
        <Button
          variant="link"
          onClick={() => router.push("/admin/subscribers")}
          className="mt-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to list
        </Button>
      </div>
    );
  }

  const { subscription, executionLogs } = data;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/admin/subscribers")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              {subscription.tenant.name}
              <span className="text-muted-foreground/40 font-normal">/</span>
              <span className="text-indigo-600 capitalize font-medium">{activeTab.replace("-", " ")}</span>
            </h1>
            <p className="text-muted-foreground text-sm">Subscriber Account & Configuration Management</p>
          </div>
        </div>
        <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
          {subscription.status.toUpperCase()}
        </Badge>
      </div>

      <div className="flex items-center gap-4 bg-blue-50 border border-blue-100 rounded-lg p-4 justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-blue-600" />
          <div>
            <h4 className="font-bold text-blue-900 text-sm">Tenant Access Control</h4>
            <p className="text-blue-800 text-xs mt-0.5">
              Switch your context to this tenant to configure their bots, flows, and channels directly.
            </p>
          </div>
        </div>
        <Button 
          size="sm" 
          className="bg-blue-600 hover:bg-blue-700"
          onClick={async () => {
            try {
              const res = await fetch("/api/admin/impersonate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tenantId: subscription.tenant.id }),
              });
              if (res.ok) {
                toast.success(`Now impersonating ${subscription.tenant.name}`);
                // Find the first bot to redirect to, or just root
                const targetBot = subscription.tenant.bots[0]?.id || "";
                window.location.href = targetBot ? `/${targetBot}` : "/";
              } else {
                toast.error("Failed to start impersonation");
              }
            } catch (err) {
              toast.error("An error occurred");
            }
          }}
        >
          <ExternalLink className="mr-2 h-4 w-4" /> Impersonate Tenant
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("tab", value);
          router.push(`/admin/subscribers/${id}?${params.toString()}`);
        }}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-6 h-auto">
          <TabsTrigger value="overview" className="flex items-center gap-2 py-2">
            <User className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-2 py-2">
            <CreditCard className="h-4 w-4" /> Subscription
          </TabsTrigger>
          <TabsTrigger value="bots" className="flex items-center gap-2 py-2">
            <Bot className="h-4 w-4" /> Bots & Channels
          </TabsTrigger>
          <TabsTrigger value="flows" className="flex items-center gap-2 py-2">
            <Activity className="h-4 w-4" /> Flows
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2 py-2">
            <History className="h-4 w-4" /> Logs & Activity
          </TabsTrigger>
          <TabsTrigger value="simulation" className="flex items-center gap-2 py-2 text-primary font-semibold">
            <Flask className="h-4 w-4" /> Simulation Lab
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tenant ID</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold truncate">{subscription.tenant.id}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Plan</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{subscription.plan.name}</div>
                <p className="text-xs text-muted-foreground">
                  ${subscription.plan.price}/month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Users</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{subscription.tenant.users.length}</div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <Card className="border-indigo-100 bg-indigo-50/30 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-indigo-900">
                  <ShieldAlert className="h-4 w-4 text-indigo-600" />
                  Quick Navigation
                </CardTitle>
                <CardDescription className="text-indigo-800/70">Jump directly to common management screens</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start h-9 text-xs bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("tab", "bots");
                    router.push(`/admin/subscribers/${id}?${params.toString()}`);
                  }}
                >
                  <Bot className="mr-2 h-3.5 w-3.5" /> Manage Bots
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start h-9 text-xs bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("tab", "flows");
                    router.push(`/admin/subscribers/${id}?${params.toString()}`);
                  }}
                >
                  <Activity className="mr-2 h-3.5 w-3.5" /> Manage Flows
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start h-9 text-xs bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("tab", "subscription");
                    router.push(`/admin/subscribers/${id}?${params.toString()}`);
                  }}
                >
                  <CreditCard className="mr-2 h-3.5 w-3.5" /> Billing Info
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start h-9 text-xs bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("tab", "logs");
                    router.push(`/admin/subscribers/${id}?${params.toString()}`);
                  }}
                >
                  <History className="mr-2 h-3.5 w-3.5" /> Audit Logs
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Tenant Details</CardTitle>
                <CardDescription>Primary account information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Tenant Name:</span>
                  <span className="font-medium">{subscription.tenant.name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Admin User:</span>
                  <span className="font-medium truncate max-w-[150px]">{subscription.tenant.users[0]?.email || "N/A"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">{new Date(subscription.tenant.users[0]?.createdAt || Date.now()).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>Manage users and permissions for this tenant</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscription.tenant.users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name || "N/A"}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.isAdmin ? "default" : "secondary"}>
                          {user.isAdmin ? "Admin" : "User"}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleUserAdmin(user.id, user.isAdmin)}
                        >
                          {user.isAdmin ? "Revoke Admin" : "Make Admin"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Management</CardTitle>
              <CardDescription>Modify plan, status, and billing details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="plan">Plan</Label>
                  <Select value={planId} onValueChange={setPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} - ${p.price}/mo
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="trialing">Trialing</SelectItem>
                      <SelectItem value="canceled">Canceled</SelectItem>
                      <SelectItem value="incomplete">Incomplete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="periodEnd">Current Period End</Label>
                  <Input
                    id="periodEnd"
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stripe ID</Label>
                  <div className="flex items-center gap-2">
                    <Input value={subscription.stripeId || "No Stripe ID"} readOnly />
                    {subscription.stripeId && (
                      <Button variant="outline" size="icon" asChild>
                        <a
                          href={`https://dashboard.stripe.com/subscriptions/${subscription.stripeId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleUpdateSubscription} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bots">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Bots & Channels</CardTitle>
                <CardDescription>View and manage connected bots and communication channels</CardDescription>
              </div>
              <Dialog open={createBotDialogOpen} onOpenChange={setCreateBotDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Create New Bot
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Bot</DialogTitle>
                    <DialogDescription>
                      Provision a new bot for this tenant.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="botName">Bot Name</Label>
                      <Input
                        id="botName"
                        placeholder="e.g. Sales Assistant"
                        value={newBotName}
                        onChange={(e) => setNewBotName(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateBotDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateBot} disabled={creatingBot || !newBotName}>
                      {creatingBot && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Bot
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {subscription.tenant.bots.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No bots configured</p>
              ) : (
                <div className="space-y-6">
                      {subscription.tenant.bots.map((bot) => (
                        <div key={bot.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Bot className="h-5 w-5 text-blue-500" />
                              <h3 className="font-bold">{bot.name}</h3>
                              <Badge variant={bot.enabled ? "default" : "secondary"}>
                                {bot.enabled ? "Enabled" : "Disabled"}
                              </Badge>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px]"
                                onClick={() => {
                                  setEditingBot(bot);
                                  setEditBotDialogOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant={bot.enabled ? "outline" : "default"}
                                size="sm"
                                className="h-7 text-[10px]"
                                onClick={() => handleToggleBotStatus(bot.id, bot.enabled)}
                              >
                                {bot.enabled ? "Disable" : "Enable"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px]"
                                onClick={async () => {
                                  const res = await fetch("/api/admin/impersonate", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ tenantId: subscription.tenant.id }),
                                  });
                                  if (res.ok) {
                                    window.location.href = `/${bot.id}`;
                                  }
                                }}
                              >
                                <ExternalLink className="mr-1 h-3 w-3" /> Dashboard
                              </Button>
                            </div>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                            {bot.channels.map((channel) => (
                              <div key={channel.id} className="flex flex-col gap-2 p-3 bg-muted/40 rounded-lg border">
                                <div className="flex items-center justify-between">
                                  <Badge variant={channel.isActive ? "outline" : "secondary"}>
                                    {channel.type}
                                  </Badge>
                                  <Switch
                                    checked={channel.isActive}
                                    onCheckedChange={() => handleToggleChannelStatus(channel.id, channel.isActive)}
                                    className="scale-75"
                                  />
                                </div>

                                <div className="space-y-1 mt-2">
                                  <Label className="text-[10px] text-muted-foreground uppercase font-bold">Assigned Flow</Label>
                                  <Select
                                    value={channel.flowAssignments?.flowId || "none"}
                                    onValueChange={(val) => handleAssignChannelFlow(channel.id, val)}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Select Flow" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Use Global Default</SelectItem>
                                      {subscription.tenant.flows.map((flow) => (
                                        <SelectItem key={flow.id} value={flow.id}>
                                          {flow.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            ))}
                            {bot.channels.length === 0 && (
                              <p className="text-xs text-muted-foreground">No channels assigned</p>
                            )}
                          </div>
                        </div>
                      ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={editBotDialogOpen} onOpenChange={setEditBotDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Bot Settings</DialogTitle>
                <DialogDescription>
                  Modify bot configuration for this tenant.
                </DialogDescription>
              </DialogHeader>
              {editingBot && (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="editBotName">Bot Name</Label>
                    <Input
                      id="editBotName"
                      value={editingBot.name}
                      onChange={(e) => setEditingBot({ ...editingBot, name: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <Label>Bot Enabled</Label>
                    <Switch
                      checked={editingBot.enabled}
                      onCheckedChange={(checked) => setEditingBot({ ...editingBot, enabled: checked })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Global Entry Flow</Label>
                    <Select
                      value={editingBot.entryFlow || "none"}
                      onValueChange={(val) => setEditingBot({ ...editingBot, entryFlow: val === "none" ? null : val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a global entry flow" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Entry Flow</SelectItem>
                        {subscription.tenant.flows.map((flow) => (
                          <SelectItem key={flow.id} value={flow.id}>
                            {flow.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      This flow will be the default for all channels unless overridden.
                    </p>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditBotDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateBot} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="flows">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Conversational Flows</CardTitle>
                <CardDescription>View and manage flows assigned to this subscriber</CardDescription>
              </div>
              <Dialog open={createFlowDialogOpen} onOpenChange={setCreateFlowDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Create New Flow
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Flow</DialogTitle>
                    <DialogDescription>
                      Create a new conversational flow for this tenant.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Flow Name</Label>
                      <Input
                        id="name"
                        placeholder="e.g. Master Orchestrator"
                        value={newFlowName}
                        onChange={(e) => setNewFlowName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description (Optional)</Label>
                      <Input
                        id="description"
                        placeholder="Describe the purpose of this flow"
                        value={newFlowDescription}
                        onChange={(e) => setNewFlowDescription(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateFlowDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateFlow} disabled={creatingFlow || !newFlowName}>
                      {creatingFlow && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Flow
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Flow Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscription.tenant.flows.map((flow) => (
                    <TableRow key={flow.id}>
                      <TableCell className="font-medium">{flow.name}</TableCell>
                      <TableCell>
                        <Badge variant={flow.isActive ? "default" : "secondary"}>
                          {flow.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{flow._count.sessions}</TableCell>
                      <TableCell>{flow._count.leads}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/admin/flows/${flow.id}/edit`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {subscription.tenant.flows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No flows created
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Audit trail of actions taken by users</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscription.tenant.activityLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {log.type.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{log.title}</div>
                          <div className="text-xs text-muted-foreground">{log.description}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.user?.name || log.user?.email || "System"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {subscription.tenant.activityLogs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No recent activity
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Execution Logs</CardTitle>
                <CardDescription>Recent bot executions and interactions</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Bot</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executionLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{log.bot.name}</TableCell>
                        <TableCell>
                          <Badge variant={log.status === "success" ? "default" : "destructive"}>
                            {log.status}
                          </Badge>
                          {log.errorMessage && (
                            <div className="text-[10px] text-red-500 mt-1 max-w-[200px] truncate">
                              {log.errorMessage}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs capitalize">{log.direction}</TableCell>
                        <TableCell className="text-sm">
                          {log.user?.name || log.user?.email || "Anonymous"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {executionLogs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No recent executions
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      <TabsContent value="simulation">
          <SimulationLab subscriberId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
