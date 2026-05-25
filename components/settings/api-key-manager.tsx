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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsed: string | null;
  isActive: boolean;
  createdAt: string;
}

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const res = await fetch("/api/settings/api-keys");
      if (res.status === 403) {
        setError("API access is not available on your plan.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setKeys(data);
    } catch (err) {
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });

      const data = await res.json();
      if (res.ok) {
        setNewKey(data.key);
        setNewKeyName("");
        fetchKeys();
        toast.success("API key created");
      } else {
        toast.error(data.error || "Failed to create API key");
      }
    } catch (err) {
      toast.error("Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this API key? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/settings/api-keys/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setKeys(keys.filter((k) => k.id !== id));
        toast.success("API key revoked");
      } else {
        toast.error("Failed to revoke API key");
      }
    } catch (err) {
      toast.error("Failed to revoke API key");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("API key copied to clipboard");
  };

  if (error) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <CardTitle className="text-yellow-800">Plan Restriction</CardTitle>
          </div>
          <CardDescription className="text-yellow-700">
            {error}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-yellow-700 mb-4">
            API access is exclusively available for Scale and Business subscribers.
            Upgrade your plan to start building custom integrations.
          </p>
          <Button onClick={() => window.location.href = "/settings?tab=billing"}>
            Upgrade Plan
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Manage your API keys to access the ReplyBase Public API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {newKey ? (
            <Alert className="bg-green-50 border-green-200">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">New API Key Created</AlertTitle>
              <AlertDescription className="text-green-700 space-y-2">
                <p>
                  Please copy your API key now. For your security, we won&apos;t show it again.
                </p>
                <div className="flex gap-2 items-center">
                  <code className="bg-white p-2 rounded border border-green-200 flex-1 font-mono text-xs break-all">
                    {newKey}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(newKey)}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  size="sm"
                  className="mt-2"
                  variant="ghost"
                  onClick={() => setNewKey(null)}
                >
                  I have saved this key
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={createKey} className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="keyName">New Key Name</Label>
                <Input
                  id="keyName"
                  placeholder="e.g., Production CRM Integration"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  disabled={creating}
                />
              </div>
              <Button type="submit" disabled={creating || !newKeyName.trim()}>
                {creating ? "Creating..." : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Key
                  </>
                )}
              </Button>
            </form>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Loading API keys...
                    </TableCell>
                  </TableRow>
                ) : keys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No API keys found. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  keys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                          {key.prefix}••••••••
                        </code>
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {key.lastUsed
                          ? new Date(key.lastUsed).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteKey(key.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documentation</CardTitle>
          <CardDescription>
            Learn how to use the ReplyBase API and webhooks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid gap-4 md:grid-cols-2">
            <a
              href="https://replybase.co.uk/docs/api/reference"
              target="_blank"
              className="flex items-center p-4 border rounded-lg hover:bg-muted transition-colors"
            >
              <div className="mr-4 p-2 bg-primary/10 rounded-full">
                <ExternalLink className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm">API Reference</div>
                <div className="text-xs text-muted-foreground">Explore all available endpoints</div>
              </div>
            </a>
            <a
              href="https://replybase.co.uk/docs/api/webhooks"
              target="_blank"
              className="flex items-center p-4 border rounded-lg hover:bg-muted transition-colors"
            >
              <div className="mr-4 p-2 bg-primary/10 rounded-full">
                <ExternalLink className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm">Webhooks Guide</div>
                <div className="text-xs text-muted-foreground">Sync data in real-time</div>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
