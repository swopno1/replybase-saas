"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  History,
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
  channels: Array<{
    id: string;
    type: string;
    isActive: boolean;
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
            <h1 className="text-3xl font-bold tracking-tight">
              {subscription.tenant.name}
            </h1>
            <p className="text-muted-foreground">Manage subscriber account and configurations</p>
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
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="bots">Bots & Channels</TabsTrigger>
          <TabsTrigger value="flows">Flows</TabsTrigger>
          <TabsTrigger value="logs">Logs & Activity</TabsTrigger>
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
            <CardHeader>
              <CardTitle>Bots & Channels</CardTitle>
              <CardDescription>View connected bots and communication channels</CardDescription>
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
                                <ExternalLink className="mr-1 h-3 w-3" /> Manage Dashboard
                              </Button>
                            </div>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                            {bot.channels.map((channel) => (
                              <div key={channel.id} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                                <Badge variant={channel.isActive ? "outline" : "secondary"}>
                                  {channel.type}
                                </Badge>
                                <span className={channel.isActive ? "text-foreground" : "text-muted-foreground"}>
                                  {channel.isActive ? "Active" : "Inactive"}
                                </span>
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
      </Tabs>
    </div>
  );
}
