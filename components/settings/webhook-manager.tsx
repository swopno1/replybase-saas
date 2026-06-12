"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Webhook,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

const SUPPORTED_EVENTS = [
  { value: "lead.created", label: "Lead Created", description: "Fired when a new lead is captured" },
  { value: "lead.updated", label: "Lead Updated", description: "Fired when a lead status changes" },
  { value: "conversation.new_message", label: "New Message", description: "Fired when a new conversation message is sent" },
  { value: "contact.updated", label: "Contact Updated", description: "Fired when a contact record is updated" },
  { value: "bot.flow_completed", label: "Flow Completed", description: "Fired when a bot flow reaches an end node" },
] as const;

interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  eventTypes: string[];
  secret: string | null;
  isActive: boolean;
  failureCount: number;
  lastDeliveredAt: string | null;
  createdAt: string;
}

interface DeliveryLog {
  id: string;
  eventType: string;
  statusCode: number | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

interface FormState {
  name: string;
  url: string;
  secret: string;
  eventTypes: string[];
}

const emptyForm: FormState = { name: "", url: "", secret: "", eventTypes: [] };

export function WebhookManager() {
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<Record<string, DeliveryLog[]>>({});
  const [loadingLogs, setLoadingLogs] = useState<string | null>(null);

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const res = await fetch("/api/settings/webhooks");
      if (res.status === 403) {
        const data = await res.json();
        setPlanError(data.error || "Webhooks require Scale or Business plan.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setWebhooks(data);
    } catch {
      toast.error("Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  };

  const createWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.url || form.eventTypes.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/settings/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          url: form.url,
          eventTypes: form.eventTypes,
          secret: form.secret || null,
          isActive: true,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setWebhooks((prev) => [data, ...prev]);
        setShowCreateDialog(false);
        setForm(emptyForm);
        toast.success("Webhook endpoint created");
      } else {
        toast.error(data.error || "Failed to create webhook");
      }
    } catch {
      toast.error("Failed to create webhook");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (webhook: WebhookSubscription) => {
    try {
      const res = await fetch("/api/settings/webhooks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: webhook.id, isActive: !webhook.isActive }),
      });

      if (res.ok) {
        setWebhooks((prev) =>
          prev.map((w) => (w.id === webhook.id ? { ...w, isActive: !w.isActive, failureCount: 0 } : w))
        );
        toast.success(webhook.isActive ? "Webhook disabled" : "Webhook re-enabled");
      } else {
        toast.error("Failed to update webhook");
      }
    } catch {
      toast.error("Failed to update webhook");
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm("Delete this webhook endpoint? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/settings/webhooks?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setWebhooks((prev) => prev.filter((w) => w.id !== id));
        if (expandedLogs === id) setExpandedLogs(null);
        toast.success("Webhook deleted");
      } else {
        toast.error("Failed to delete webhook");
      }
    } catch {
      toast.error("Failed to delete webhook");
    }
  };

  const toggleDeliveryLogs = async (id: string) => {
    if (expandedLogs === id) {
      setExpandedLogs(null);
      return;
    }

    setExpandedLogs(id);

    if (deliveryLogs[id]) return;

    setLoadingLogs(id);
    try {
      const res = await fetch(`/api/settings/webhooks/${id}/deliveries`);
      if (res.ok) {
        const data = await res.json();
        setDeliveryLogs((prev) => ({ ...prev, [id]: data }));
      }
    } catch {
      toast.error("Failed to load delivery logs");
    } finally {
      setLoadingLogs(null);
    }
  };

  const toggleEventType = (event: string) => {
    setForm((prev) => ({
      ...prev,
      eventTypes: prev.eventTypes.includes(event)
        ? prev.eventTypes.filter((e) => e !== event)
        : [...prev.eventTypes, event],
    }));
  };

  if (planError) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <CardTitle className="text-yellow-800">Plan Restriction</CardTitle>
          </div>
          <CardDescription className="text-yellow-700">{planError}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-yellow-700 mb-4">
            Outgoing webhooks are available on Scale and Business plans. Receive real-time events
            in Zapier, Make, your CRM, or any custom endpoint.
          </p>
          <Button onClick={() => (window.location.href = "/settings?tab=billing")}>
            Upgrade Plan
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Outgoing Webhooks</CardTitle>
            <CardDescription>
              Push real-time events to your endpoints when things happen in ReplyBase.
            </CardDescription>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Endpoint
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Delivered</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Loading webhooks...
                    </TableCell>
                  </TableRow>
                ) : webhooks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No webhook endpoints yet. Add one to start receiving events.
                    </TableCell>
                  </TableRow>
                ) : (
                  webhooks.map((webhook) => (
                    <>
                      <TableRow key={webhook.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Webhook className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {webhook.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded max-w-[200px] block truncate">
                            {webhook.url}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(webhook.eventTypes as string[]).map((e) => (
                              <Badge key={e} variant="secondary" className="text-xs font-mono">
                                {e}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {webhook.isActive ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                          ) : (
                            <Badge variant="destructive">
                              {webhook.failureCount >= 10 ? "Auto-disabled" : "Inactive"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {webhook.lastDeliveredAt
                            ? new Date(webhook.lastDeliveredAt).toLocaleString()
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title={expandedLogs === webhook.id ? "Hide logs" : "View delivery logs"}
                              onClick={() => toggleDeliveryLogs(webhook.id)}
                            >
                              {expandedLogs === webhook.id ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            {!webhook.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-blue-600 hover:text-blue-700"
                                title="Re-enable endpoint"
                                onClick={() => toggleActive(webhook)}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {webhook.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground"
                                title="Disable endpoint"
                                onClick={() => toggleActive(webhook)}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Delete endpoint"
                              onClick={() => deleteWebhook(webhook.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {expandedLogs === webhook.id && (
                        <TableRow key={`${webhook.id}-logs`}>
                          <TableCell colSpan={6} className="bg-muted/30 p-0">
                            <div className="p-4">
                              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                                Recent Deliveries (last 50)
                              </p>
                              {loadingLogs === webhook.id ? (
                                <p className="text-xs text-muted-foreground">Loading logs...</p>
                              ) : (deliveryLogs[webhook.id] || []).length === 0 ? (
                                <p className="text-xs text-muted-foreground">No delivery attempts yet.</p>
                              ) : (
                                <div className="rounded border overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead className="bg-muted">
                                      <tr>
                                        <th className="text-left p-2 font-medium">Time</th>
                                        <th className="text-left p-2 font-medium">Event</th>
                                        <th className="text-left p-2 font-medium">Status</th>
                                        <th className="text-left p-2 font-medium">Result</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(deliveryLogs[webhook.id] || []).map((log) => (
                                        <tr key={log.id} className="border-t">
                                          <td className="p-2 text-muted-foreground">
                                            {new Date(log.createdAt).toLocaleString()}
                                          </td>
                                          <td className="p-2 font-mono">{log.eventType}</td>
                                          <td className="p-2">
                                            {log.statusCode ? (
                                              <span
                                                className={
                                                  log.success ? "text-green-600" : "text-red-600"
                                                }
                                              >
                                                {log.statusCode}
                                              </span>
                                            ) : (
                                              <span className="text-muted-foreground">—</span>
                                            )}
                                          </td>
                                          <td className="p-2">
                                            {log.success ? (
                                              <span className="flex items-center gap-1 text-green-600">
                                                <CheckCircle2 className="h-3 w-3" /> OK
                                              </span>
                                            ) : (
                                              <span className="flex items-center gap-1 text-red-600" title={log.errorMessage || ""}>
                                                <XCircle className="h-3 w-3" /> {log.errorMessage || "Failed"}
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {webhooks.some((w) => w.failureCount >= 10) && (
            <Alert className="mt-4 border-orange-200 bg-orange-50">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-orange-800">Endpoint auto-disabled</AlertTitle>
              <AlertDescription className="text-orange-700">
                One or more endpoints were automatically disabled after 10 consecutive delivery failures.
                Fix the target URL and use the re-enable button to resume delivery.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supported Events</CardTitle>
          <CardDescription>Events you can subscribe to.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {SUPPORTED_EVENTS.map((event) => (
              <div key={event.value} className="flex items-start gap-3 p-3 rounded-lg border">
                <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded shrink-0">
                  {event.value}
                </code>
                <p className="text-xs text-muted-foreground">{event.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Webhook Endpoint</DialogTitle>
            <DialogDescription>
              We&apos;ll send a signed POST request to your URL whenever selected events occur.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={createWebhook} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wh-name">Name</Label>
              <Input
                id="wh-name"
                placeholder="e.g., Production CRM Sync"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wh-url">Endpoint URL</Label>
              <Input
                id="wh-url"
                type="url"
                placeholder="https://your-app.com/webhooks/replybase"
                value={form.url}
                onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wh-secret">
                Signing Secret <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="wh-secret"
                type="password"
                placeholder="Used to verify the X-ReplyBase-Signature header"
                value={form.secret}
                onChange={(e) => setForm((p) => ({ ...p, secret: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Events to subscribe</Label>
              <div className="space-y-2 rounded-lg border p-3">
                {SUPPORTED_EVENTS.map((event) => (
                  <div key={event.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`evt-${event.value}`}
                      checked={form.eventTypes.includes(event.value)}
                      onCheckedChange={() => toggleEventType(event.value)}
                    />
                    <label htmlFor={`evt-${event.value}`} className="text-sm cursor-pointer">
                      <span className="font-mono text-xs">{event.value}</span>
                      <span className="text-muted-foreground ml-2">— {event.description}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !form.name || !form.url || form.eventTypes.length === 0}
              >
                {saving ? "Creating..." : "Create Endpoint"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
