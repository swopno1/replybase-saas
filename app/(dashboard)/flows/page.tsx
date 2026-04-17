"use client";

import { useEffect, useState } from "react";
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

export default function FlowsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;
  const [myFlows, setMyFlows] = useState<Flow[]>([]);
  const [globalFlows, setGlobalFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [flowToDelete, setFlowToDelete] = useState<Flow | null>(null);
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowDescription, setNewFlowDescription] = useState("");
  const [newFlowIsGlobal, setNewFlowIsGlobal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<
    | "welcome"
    | "lead-generation"
    | "lead-capture"
    | "real-estate"
    | "services"
    | "agencies"
    | "booking"
    | "boutique-gym"
    | "personal-training"
    | "crossfit-gym"
    | "boot-camp"
    | "yoga-studio"
    | "hair-salon"
    | "barbershop"
    | "day-spa"
    | "nail-salon"
    | "cleaning-services"
    | "landscaping"
    | "handyman"
    | "pet-care"
    | "care-services"
    | null
  >(null);

  useEffect(() => {
    fetchFlows();
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
    if (!selectedTemplate) {
      toast.error("Please select a template");
      return;
    }

    try {
      setCreating(true);
      const response = await fetch("/api/flows/from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateCategory: selectedTemplate,
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
        setSelectedTemplate(null);
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
                Manage your custom conversational flows
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
            setSelectedTemplate(null);
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
                ? `Use our ${selectedTemplate} template as a starting point and customize it for your needs`
                : "Create a new conversational flow for your channels"}
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="text-sm text-blue-900">
                <strong>Template selected:</strong>{" "}
                {selectedTemplate === "welcome"
                  ? "Welcome Flow: Triage & Routing"
                  : selectedTemplate === "lead-generation"
                    ? "Lead Generation: Qualification Funnel"
                    : selectedTemplate === "lead-capture"
                      ? "Lead Capture: Quick Contact Micro-Flow"
                      : selectedTemplate === "real-estate"
                        ? "Real Estate: Buyer & Seller Leads"
                        : selectedTemplate === "services"
                          ? "Services: Qualification & Booking"
                          : selectedTemplate === "agencies"
                            ? "Agencies: Project Discovery"
                            : selectedTemplate === "booking"
                              ? "Booking: Appointments & Reservations"
                              : selectedTemplate === "boutique-gym"
                                ? "Boutique Gym: Membership Enquiry"
                                : selectedTemplate === "personal-training"
                                  ? "Personal Training: Client Intake"
                                  : selectedTemplate === "crossfit-gym"
                                    ? "CrossFit Gym: Trial & Membership"
                                    : selectedTemplate === "boot-camp"
                                      ? "Boot Camp: Programme Enquiry"
                                      : selectedTemplate === "yoga-studio"
                                        ? "Yoga Studio: Class Booking & Membership"
                                        : selectedTemplate === "hair-salon"
                                          ? "Hair Salon: Booking & Service Enquiry"
                                          : selectedTemplate === "barbershop"
                                            ? "Barbershop: Appointment Booking"
                                            : selectedTemplate === "day-spa"
                                              ? "Day Spa: Treatment Booking"
                                              : selectedTemplate ===
                                                  "nail-salon"
                                                ? "Nail Salon: Appointment Booking"
                                                : selectedTemplate ===
                                                    "cleaning-services"
                                                  ? "Cleaning Services: Quote & Booking"
                                                  : selectedTemplate ===
                                                      "landscaping"
                                                    ? "Landscaping & Gardening: Quote Request"
                                                    : selectedTemplate ===
                                                        "handyman"
                                                      ? "Handyman & Repair: Job Booking"
                                                      : selectedTemplate ===
                                                          "pet-care"
                                                        ? "Pet Care: Booking & Service Enquiry"
                                                        : "Child & Elder Care: Service Enquiry"}
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
                    setSelectedTemplate(null);
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
            setSelectedTemplate(null);
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
              {/* ── Universal ─────────────────────────────────────── */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Universal
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    {
                      id: "welcome" as const,
                      icon: <Globe className="mt-1 h-5 w-5 text-blue-600" />,
                      title: "Welcome Flow: Triage & Routing",
                      desc: "A fast starting point for greeting visitors, capturing intent, and routing them to pricing, booking, or support.",
                      meta: "6 nodes • Branching ready",
                    },
                    {
                      id: "lead-generation" as const,
                      icon: <Users className="mt-1 h-5 w-5 text-blue-600" />,
                      title: "Lead Generation: Qualification Funnel",
                      desc: "Captures contact details, intent, budget, and timeline for inbound campaigns. Tags qualified leads automatically.",
                      meta: "9 nodes • Sales-ready",
                    },
                    {
                      id: "lead-capture" as const,
                      icon: <Users className="mt-1 h-5 w-5 text-green-600" />,
                      title: "Lead Capture: Quick Contact Micro-Flow",
                      desc: "Minimal 5-step micro-flow for fast lead capture. Collect name, email, phone, and one qualifying question. Ideal for any business.",
                      meta: "7 nodes • Micro-flow",
                    },
                  ].map((t) => (
                    <div
                      key={t.id}
                      className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                        selectedTemplate === t.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setSelectedTemplate(t.id)}
                    >
                      <div className="flex items-start gap-3">
                        {t.icon}
                        <div>
                          <div className="font-medium">{t.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {t.desc}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {t.meta}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Professional / B2B ────────────────────────────── */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Professional &amp; B2B
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    {
                      id: "real-estate" as const,
                      icon: <Calendar className="mt-1 h-5 w-5 text-blue-600" />,
                      title: "Real Estate: Buyer & Seller Leads",
                      desc: "Qualifies buyer, seller, rental, or viewing enquiries and routes each request into the right follow-up path.",
                      meta: "7 nodes • Multi-branch ready",
                    },
                    {
                      id: "services" as const,
                      icon: <Wrench className="mt-1 h-5 w-5 text-blue-600" />,
                      title: "Services: Qualification & Booking",
                      desc: "Perfect for consultants, plumbers, IT support, and other service providers. Qualifies leads and captures booking requests.",
                      meta: "7 nodes • Multi-channel ready",
                    },
                    {
                      id: "agencies" as const,
                      icon: <Users className="mt-1 h-5 w-5 text-blue-600" />,
                      title: "Agencies: Project Discovery",
                      desc: "Built for marketing, digital, and design agencies. Discovers project scope, budget, and timeline before human handoff.",
                      meta: "7 nodes • Multi-channel ready",
                    },
                    {
                      id: "booking" as const,
                      icon: <Calendar className="mt-1 h-5 w-5 text-blue-600" />,
                      title: "Booking: Appointments & Reservations",
                      desc: "Ideal for any booking-heavy business. Confirms service, collects contact info, and captures preferred time.",
                      meta: "7 nodes • Multi-channel ready",
                    },
                  ].map((t) => (
                    <div
                      key={t.id}
                      className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                        selectedTemplate === t.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setSelectedTemplate(t.id)}
                    >
                      <div className="flex items-start gap-3">
                        {t.icon}
                        <div>
                          <div className="font-medium">{t.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {t.desc}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {t.meta}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Fitness ───────────────────────────────────────── */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Fitness
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    {
                      id: "boutique-gym" as const,
                      title: "Boutique Gym: Membership Enquiry",
                      desc: "Qualifies new membership, class, or tour enquiries. Captures fitness goal, schedule preference, and contact details.",
                      meta: "8 nodes • Membership-ready",
                    },
                    {
                      id: "personal-training" as const,
                      title: "Personal Training: Client Intake",
                      desc: "Captures fitness goals, experience, health notes, and availability before the first session.",
                      meta: "9 nodes • Client intake",
                    },
                    {
                      id: "crossfit-gym" as const,
                      title: "CrossFit Gym: Trial & Membership",
                      desc: "Warms up new visitors, assesses experience, and drives them toward a free intro session or membership.",
                      meta: "8 nodes • Intro session ready",
                    },
                    {
                      id: "boot-camp" as const,
                      title: "Boot Camp: Programme Enquiry",
                      desc: "Captures programme interest, fitness level, and contact info for outdoor or indoor boot camp programmes.",
                      meta: "7 nodes • Programme-ready",
                    },
                    {
                      id: "yoga-studio" as const,
                      title: "Yoga Studio: Class Booking & Membership",
                      desc: "Captures class preferences, yoga experience level, and schedule to confirm bookings or memberships.",
                      meta: "8 nodes • Booking-ready",
                    },
                  ].map((t) => (
                    <div
                      key={t.id}
                      className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                        selectedTemplate === t.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setSelectedTemplate(t.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Wrench className="mt-1 h-5 w-5 text-orange-500" />
                        <div>
                          <div className="font-medium">{t.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {t.desc}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {t.meta}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Beauty & Wellness ─────────────────────────────── */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Beauty &amp; Wellness
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    {
                      id: "hair-salon" as const,
                      title: "Hair Salon: Booking & Service Enquiry",
                      desc: "Captures service type, stylist preference, and booking time to confirm hair appointments.",
                      meta: "8 nodes • Booking-ready",
                    },
                    {
                      id: "barbershop" as const,
                      title: "Barbershop: Appointment Booking",
                      desc: "Quick booking flow for cuts, beard trims, and shaves. Captures service, barber preference, and time.",
                      meta: "8 nodes • Booking-ready",
                    },
                    {
                      id: "day-spa" as const,
                      title: "Day Spa: Treatment Booking",
                      desc: "Captures treatment type, booking purpose (self/gift/group), date preference, and special requests.",
                      meta: "9 nodes • Booking-ready",
                    },
                    {
                      id: "nail-salon" as const,
                      title: "Nail Salon: Appointment Booking",
                      desc: "Fast appointment booking for gel, acrylic, pedicures, and nail art. Captures service, name, and time.",
                      meta: "7 nodes • Booking-ready",
                    },
                  ].map((t) => (
                    <div
                      key={t.id}
                      className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                        selectedTemplate === t.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setSelectedTemplate(t.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Calendar className="mt-1 h-5 w-5 text-pink-500" />
                        <div>
                          <div className="font-medium">{t.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {t.desc}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {t.meta}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Home Services ─────────────────────────────────── */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Home Services
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    {
                      id: "cleaning-services" as const,
                      title: "Cleaning Services: Quote & Booking",
                      desc: "Qualifies property type, clean type, and size. Captures location and contact details for a fast quote.",
                      meta: "10 nodes • Quote-ready",
                    },
                    {
                      id: "landscaping" as const,
                      title: "Landscaping & Gardening: Quote Request",
                      desc: "Captures service needed, garden size, postcode, and preferred visit date to prepare a no-obligation quote.",
                      meta: "9 nodes • Quote-ready",
                    },
                    {
                      id: "handyman" as const,
                      title: "Handyman & Repair: Job Booking",
                      desc: "Quickly captures job description, urgency, address, and contact info for fast dispatch or scheduling.",
                      meta: "8 nodes • Job-ready",
                    },
                  ].map((t) => (
                    <div
                      key={t.id}
                      className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                        selectedTemplate === t.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setSelectedTemplate(t.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Wrench className="mt-1 h-5 w-5 text-emerald-600" />
                        <div>
                          <div className="font-medium">{t.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {t.desc}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {t.meta}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Personal Services ─────────────────────────────── */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Personal Services
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    {
                      id: "pet-care" as const,
                      title: "Pet Care: Booking & Service Enquiry",
                      desc: "For dog walkers, groomers, boarders, and pet sitters. Captures pet details, service dates, and owner contact.",
                      meta: "8 nodes • Booking-ready",
                    },
                    {
                      id: "care-services" as const,
                      title: "Child & Elder Care: Service Enquiry",
                      desc: "Sensitively captures care type, recipient details, schedule needs, and contact info for childcare or eldercare.",
                      meta: "8 nodes • Enquiry-ready",
                    },
                  ].map((t) => (
                    <div
                      key={t.id}
                      className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                        selectedTemplate === t.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setSelectedTemplate(t.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Users className="mt-1 h-5 w-5 text-violet-600" />
                        <div>
                          <div className="font-medium">{t.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {t.desc}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {t.meta}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <Button
              variant="outline"
              onClick={() => {
                setTemplateDialogOpen(false);
                setSelectedTemplate(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              disabled={!selectedTemplate}
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
