"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
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
  Loader2,
  ArrowLeft,
  Save,
  User,
  Bot,
  CreditCard,
  Shield,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

interface Plan {
  id: string;
  name: string;
  price: number;
}

interface TenantData {
  id: string;
  name: string;
  users: Array<{
    id: string;
    name: string | null;
    email: string | null;
    isAdmin: boolean;
    createdAt: string;
  }>;
  subscriptions: {
    id: string;
    status: string;
    currentPeriodEnd: string | null;
    stripeId: string | null;
    plan: Plan;
  } | null;
  bots: Array<{
    id: string;
    name: string;
    enabled: boolean;
    channels: Array<{ id: string; type: string; isActive: boolean }>;
  }>;
}

export default function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id: tenantId } = use(params);
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Subscription form states
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [status, setStatus] = useState("active");
  const [periodEnd, setPeriodEnd] = useState("");

  useEffect(() => {
    fetchTenant();
    fetchPlans();
  }, [tenantId]);

  const fetchTenant = async () => {
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setTenant(data.tenant);
        if (data.tenant.subscriptions) {
          setSelectedPlanId(data.tenant.subscriptions.plan.id);
          setStatus(data.tenant.subscriptions.status);
          setPeriodEnd(
            data.tenant.subscriptions.currentPeriodEnd
              ? new Date(data.tenant.subscriptions.currentPeriodEnd).toISOString().split("T")[0]
              : ""
          );
        }
      } else {
        toast.error("Tenant not found");
      }
    } catch (error) {
      toast.error("Error loading tenant");
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/admin/plans");
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans);
      }
    } catch (error) {
      console.error("Error fetching plans:", error);
    }
  };

  const handleGrantSubscription = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlanId,
          status,
          currentPeriodEnd: periodEnd ? new Date(periodEnd).toISOString() : null,
        }),
      });

      if (res.ok) {
        toast.success("Subscription granted/updated successfully");
        fetchTenant();
      } else {
        toast.error("Failed to update subscription");
      }
    } catch (error) {
      toast.error("Error updating subscription");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tenant) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{tenant.name}</h1>
          <p className="text-muted-foreground text-xs font-mono">Tenant ID: {tenant.id}</p>
        </div>
      </div>

      <Tabs defaultValue="billing" className="space-y-4">
        <TabsList>
          <TabsTrigger value="billing">Billing & Plan</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="bots">Bots</TabsTrigger>
        </TabsList>

        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle>Manual Subscription Grant</CardTitle>
              <CardDescription>
                Directly manage this tenant's subscription status. Useful for gifted plans or direct billing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Select Plan</Label>
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} (£{p.price}/mo)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="trialing">Trialing</SelectItem>
                      <SelectItem value="canceled">Canceled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Expiration Date</Label>
                  <Input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Current Status</Label>
                  <div className="pt-2">
                    {tenant.subscriptions ? (
                      <Badge variant={tenant.subscriptions.status === "active" ? "default" : "secondary"}>
                        {tenant.subscriptions.plan.name.toUpperCase()} - {tenant.subscriptions.status.toUpperCase()}
                      </Badge>
                    ) : (
                      <Badge variant="outline">NO ACTIVE SUBSCRIPTION</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={handleGrantSubscription} disabled={saving || !selectedPlanId}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  {tenant.subscriptions ? "Update Subscription" : "Grant Subscription"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Tenant Users</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenant.users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name || "—"}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.isAdmin ? "default" : "secondary"}>
                          {u.isAdmin ? "ADMIN" : "USER"}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bots">
          <Card>
            <CardHeader>
              <CardTitle>Bots & Channels</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {tenant.bots.map((bot) => (
                  <div key={bot.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="font-bold">{bot.name}</div>
                      <Badge variant={bot.enabled ? "default" : "secondary"}>
                        {bot.enabled ? "ENABLED" : "DISABLED"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {bot.channels.map((c) => (
                        <Badge key={c.id} variant="outline" className="text-[10px]">
                          {c.type} {c.isActive ? "✓" : "✗"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {tenant.bots.length === 0 && (
                  <p className="text-muted-foreground text-sm py-4">No bots configured yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
