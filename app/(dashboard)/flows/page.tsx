"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  PlayCircle,
  PauseCircle,
  Settings,
  Globe,
  Wrench,
  Users,
  Calendar,
  UtensilsCrossed,
  Hotel,
  Trophy,
  ShoppingBag,
  Cpu,
  Activity,
  Scissors,
  Sparkles,
  Home,
  Dog,
  Heart,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

export const dynamic = "force-dynamic";

interface FlowNode {
  id: string;
  type: string;
  content: Record<string, unknown>;
  order: number;
}

interface Flow {
  id: string;
  name: string;
  description: string | null;
  isGlobal: boolean;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  nodes: FlowNode[];
  assignments: Array<{
    id: string;
    isActive: boolean;
    page: {
      id: string;
      name: string;
      facebookId: string;
    };
  }>;
  _count: {
    leads: number;
    sessions: number;
  };
}

interface Template {
  category: string;
  name: string;
  description: string;
  icon: string;
  group: string;
  nodeCount: number;
}

export default function FlowsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;
  const [myFlows, setMyFlows] = useState<Flow[]>([]);
  const [globalFlows, setGlobalFlows] = useState<Flow[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [flowToDelete, setFlowToDelete] = useState<Flow | null>(null);
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowDescription, setNewFlowDescription] = useState("");
  const [newFlowIsGlobal, setNewFlowIsGlobal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchFlows();
    fetchTemplates();
  }, []);

  const fetchFlows = async () => {
    try {
      setLoading(true);
      const [myResponse, globalResponse] = await Promise.all([
        fetch("/api/flows?type=my"),
        fetch("/api/flows?type=global"),
      ]);

      if (myResponse.ok) {
        const data = await myResponse.json();
        setMyFlows(data.flows);
      }

      if (globalResponse.ok) {
        const data = await globalResponse.json();
        setGlobalFlows(data.flows);
      }
    } catch (error) {
      console.error("Failed to fetch flows:", error);
      toast.error("Failed to load flows");
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/flows/from-template");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    }
  };

  const handleCreateFlow = async () => {
    if (!newFlowName.trim()) {
      toast.error("Flow name is required");
      return;
    }

    try {
      setCreating(true);
      const response = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFlowName,
          description: newFlowDescription,
          nodes: [],
          ...(isAdmin && newFlowIsGlobal ? { isGlobal: true } : {}),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("Flow created successfully");
        setCreateDialogOpen(false);
        setNewFlowName("");
        setNewFlowDescription("");
        setNewFlowIsGlobal(false);
        router.push(`/flows/${data.flow.id}/edit`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create flow");
      }
    } catch (error) {
      console.error("Failed to create flow:", error);
      toast.error("Failed to create flow");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplateCategory) {
      toast.error("Please select a template");
      return;
    }

    try {
      setCreating(true);
      const response = await fetch("/api/flows/from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateCategory: selectedTemplateCategory,
          flowName: newFlowName || undefined,
          flowDescription: newFlowDescription || undefined,
          isGlobal: newFlowIsGlobal,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("Flow created from template");
        setTemplateDialogOpen(false);
        setCreateDialogOpen(false);
        setNewFlowName("");
        setNewFlowDescription("");
        setNewFlowIsGlobal(false);
        setSelectedTemplateCategory(null);
        router.push(`/flows/${data.flow.id}/edit`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create flow");
      }
    } catch (error) {
      console.error("Failed to create flow from template:", error);
      toast.error("Failed to create flow");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteFlow = async () => {
    if (!flowToDelete) return;

    try {
      const response = await fetch(`/api/flows/${flowToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Flow deleted successfully");
        setDeleteDialogOpen(false);
        setFlowToDelete(null);
        fetchFlows();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete flow");
      }
    } catch (error) {
      console.error("Failed to delete flow:", error);
      toast.error("Failed to delete flow");
    }
  };

  const handleDuplicateFlow = async (flowId: string) => {
    try {
      const response = await fetch(`/api/flows/${flowId}/clone`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("Flow duplicated successfully");
        router.push(`/flows/${data.flow.id}/edit`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to duplicate flow");
      }
    } catch (error) {
      console.error("Failed to duplicate flow:", error);
      toast.error("Failed to duplicate flow");
    }
  };

  const handleToggleActive = async (flowId: string, currentState: boolean) => {
    try {
      const response = await fetch(`/api/flows/${flowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentState }),
      });

      if (response.ok) {
        toast.success(
          `Flow ${!currentState ? "activated" : "deactivated"} successfully`,
        );
        fetchFlows();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update flow");
      }
    } catch (error) {
      console.error("Failed to update flow:", error);
      toast.error("Failed to update flow");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const templatesByGroup = useMemo(() => {
    const groups: Record<string, Template[]> = {};
    templates.forEach((t) => {
      if (!groups[t.group]) groups[t.group] = [];
      groups[t.group].push(t);
    });
    return groups;
  }, [templates]);

  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.category === selectedTemplateCategory) || null;
  }, [templates, selectedTemplateCategory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">Flow Builder</h1>
          <p className="text-muted-foreground">
            Create and manage conversational flows for your pages
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
          <Button
            onClick={() => setTemplateDialogOpen(true)}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <Wrench className="h-4 w-4 mr-2" />
            Use Template
          </Button>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Flow
          </Button>
        </div>
      </div>

      {/* Partner Callout Banner */}
      <div className="relative overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-emerald-50/50 p-6 dark:border-indigo-950/40 dark:from-indigo-950/20 dark:via-zinc-900/50 dark:to-emerald-950/10">
        <div className="absolute top-0 right-0 h-40 w-40 -mr-10 -mt-10 rounded-full bg-gradient-to-tr from-indigo-200/20 to-emerald-200/20 blur-2xl" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                Partner Service
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                ReplyBase × ViveScript Solutions
              </span>
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              Pre-Engineered Flow Builder Packages
            </h3>
            <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
              Accelerate your automation setup with certified custom blueprints. Deploy pre-engineered lead capture pipelines, concierge appointment calendars, Stripe e-commerce checkout funnels, or custom AI support routing built directly into your ReplyBase workspace.
            </p>
          </div>
          <div className="flex shrink-0 items-center">
            <Button
              onClick={() => window.open("https://www.vivescriptsolutions.com/en/shop/product/partners", "_blank")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm dark:bg-indigo-500 dark:hover:bg-indigo-600 font-medium"
            >
              Explore Packages
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="my" className="min-w-0 space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-2 sm:inline-flex sm:w-auto sm:grid-cols-none">
          <TabsTrigger value="my">My Flows ({myFlows.length})</TabsTrigger>
          <TabsTrigger value="global">
            Global Flows ({globalFlows.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Flows</CardTitle>
              <CardDescription>
                Manage your custom conversational flows.
                <a 
                  href="https://replybase.co.uk/docs/platform/ai-workflows" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-2 text-[10px] text-primary hover:underline flex items-center gap-1 font-bold"
                >
                  Guide: Learn more about flows <ExternalLink className="h-2 w-2" />
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              {myFlows.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    No flows created yet
                  </p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Flow
                  </Button>
                </div>
              ) : (
                <div className="min-w-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Flow Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned Pages</TableHead>
                        <TableHead>Leads</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myFlows.map((flow) => (
                        <TableRow key={flow.id}>
                          <TableCell>
                            <div className="min-w-0">
                              <div className="font-medium wrap-break-word">
                                {flow.name}
                              </div>
                              {flow.description && (
                                <div className="text-sm text-muted-foreground whitespace-normal wrap-break-word">
                                  {flow.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={flow.isActive ? "default" : "secondary"}
                            >
                              {flow.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {flow.assignments.length > 0 ? (
                              <div className="space-y-1">
                                {flow.assignments.map((assignment) => (
                                  <div key={assignment.id} className="text-sm">
                                    {assignment.page.name}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                Not assigned
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{flow._count.leads}</TableCell>
                          <TableCell>{formatDate(flow.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(`/flows/${flow.id}/edit`)
                                  }
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleToggleActive(flow.id, flow.isActive)
                                  }
                                >
                                  {flow.isActive ? (
                                    <>
                                      <PauseCircle className="h-4 w-4 mr-2" />
                                      Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <PlayCircle className="h-4 w-4 mr-2" />
                                      Activate
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDuplicateFlow(flow.id)}
                                >
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(`/flows/${flow.id}/settings`)
                                  }
                                >
                                  <Settings className="h-4 w-4 mr-2" />
                                  Settings
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setFlowToDelete(flow);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="global" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Flows</CardTitle>
              <CardDescription>
                Pre-built flow templates you can duplicate and customize
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              {globalFlows.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    No global flows available
                  </p>
                </div>
              ) : (
                <div className="min-w-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Flow Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Nodes</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {globalFlows.map((flow) => (
                        <TableRow key={flow.id}>
                          <TableCell className="font-medium whitespace-normal wrap-break-word">
                            {flow.name}
                          </TableCell>
                          <TableCell className="max-w-md whitespace-normal wrap-break-word">
                            {flow.description || "No description"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {flow.nodes.length} nodes
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleDuplicateFlow(flow.id)}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Flow Dialog */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setSelectedTemplateCategory(null);
            setNewFlowName("");
            setNewFlowDescription("");
            setNewFlowIsGlobal(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate
                ? "Create Flow from Template"
                : "Create New Flow"}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate
                ? `Use our ${selectedTemplate.category} template as a starting point and customize it for your needs`
                : "Create a new conversational flow for your channels"}
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="text-sm text-blue-900">
                <strong>Template selected:</strong>{" "}
                {selectedTemplate.name}
              </div>
            </div>
          )}
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Flow Name</Label>
              <Input
                id="name"
                placeholder="e.g., Welcome Flow"
                value={newFlowName}
                onChange={(e) => setNewFlowName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {selectedTemplate
                  ? "Give your flow a custom name, or we'll use the template name"
                  : "Give your flow a name"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe what this flow does..."
                value={newFlowDescription}
                onChange={(e) => setNewFlowDescription(e.target.value)}
                rows={3}
              />
            </div>
            {isAdmin && (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Global Template</div>
                  <div className="text-xs text-muted-foreground">
                    Make this flow available to all tenants as a read-only
                    template
                  </div>
                </div>
                <input
                  type="checkbox"
                  id="isGlobal"
                  checked={newFlowIsGlobal}
                  onChange={(e) => setNewFlowIsGlobal(e.target.checked)}
                  className="h-4 w-4 cursor-pointer"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (selectedTemplate) {
                    setCreateDialogOpen(false);
                    setSelectedTemplateCategory(null);
                    setNewFlowName("");
                    setNewFlowDescription("");
                  } else {
                    setCreateDialogOpen(false);
                  }
                }}
              >
                {selectedTemplate ? "Back" : "Cancel"}
              </Button>
              <Button
                onClick={
                  selectedTemplate ? handleCreateFromTemplate : handleCreateFlow
                }
                disabled={creating}
              >
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedTemplate ? "Create from Template" : "Create Flow"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Selection Dialog */}
      <Dialog
        open={templateDialogOpen}
        onOpenChange={(open) => {
          setTemplateDialogOpen(open);
          if (!open) {
            setSelectedTemplateCategory(null);
          }
        }}
      >
        <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Choose a Template</DialogTitle>
            <DialogDescription>
              Start with a pre-built template for your business type
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-6">
              {Object.entries(templatesByGroup).map(([groupName, groupTemplates]) => (
                <div key={groupName}>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {groupName}
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {groupTemplates.map((t) => (
                      <div
                        key={t.category}
                        className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${selectedTemplateCategory === t.category
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                          }`}
                        onClick={() => setSelectedTemplateCategory(t.category)}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl mt-1">{t.icon}</span>
                          <div>
                            <div className="font-medium">{t.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {t.description}
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              {t.nodeCount} nodes
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <Button
              variant="outline"
              onClick={() => {
                setTemplateDialogOpen(false);
                setSelectedTemplateCategory(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              disabled={!selectedTemplateCategory}
            >
              Next
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Flow</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{flowToDelete?.name}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteFlow}>
              Delete Flow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
