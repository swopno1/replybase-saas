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
  const [selectedTemplate, setSelectedTemplate] = useState<"services" | "agencies" | "booking" | null>(null);

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Flow Builder</h1>
          <p className="text-muted-foreground">
            Create and manage conversational flows for your pages
          </p>
        </div>
         <div className="flex gap-2">
           <Button onClick={() => setTemplateDialogOpen(true)} variant="outline">
             <Wrench className="h-4 w-4 mr-2" />
             Use Template
           </Button>
           <Button onClick={() => setCreateDialogOpen(true)}>
             <Plus className="h-4 w-4 mr-2" />
             Create Flow
           </Button>
         </div>
      </div>

      <Tabs defaultValue="my" className="space-y-4">
        <TabsList>
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
            <CardContent>
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
                          <div>
                            <div className="font-medium">{flow.name}</div>
                            {flow.description && (
                              <div className="text-sm text-muted-foreground">
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
            <CardContent>
              {globalFlows.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    No global flows available
                  </p>
                </div>
              ) : (
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
                        <TableCell className="font-medium">
                          {flow.name}
                        </TableCell>
                        <TableCell className="max-w-md">
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
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Flow Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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
               {selectedTemplate ? "Create Flow from Template" : "Create New Flow"}
             </DialogTitle>
             <DialogDescription>
               {selectedTemplate
                 ? `Use our ${selectedTemplate} template as a starting point and customize it for your needs`
                 : "Create a new conversational flow for your channels"}
             </DialogDescription>
           </DialogHeader>
           {selectedTemplate && (
             <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
               <div className="text-sm text-blue-900">
                 <strong>Template selected:</strong>{" "}
                 {selectedTemplate === "services"
                   ? "Services: Qualification & Booking"
                   : selectedTemplate === "agencies"
                     ? "Agencies: Project Discovery"
                     : "Booking: Appointments & Reservations"}
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
                 {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                 {selectedTemplate ? "Create from Template" : "Create Flow"}
               </Button>
             </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>

               {/* Template Selection Dialog */}
               <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
                       <Dialog
                         open={templateDialogOpen}
                         onOpenChange={(open) => {
                           setTemplateDialogOpen(open);
                           if (!open) {
                             setSelectedTemplate(null);
                           }
                         }}
                       >
                 <DialogContent className="max-w-2xl">
                   <DialogHeader>
                     <DialogTitle>Choose a Template</DialogTitle>
                     <DialogDescription>
                       Start with a pre-built template for your business type
                     </DialogDescription>
                   </DialogHeader>
                   <div className="space-y-4 py-4">
                     <div className="grid grid-cols-1 gap-4">
                       {/* Services Template */}
                       <div
                         className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                           selectedTemplate === "services"
                             ? "border-blue-500 bg-blue-50"
                             : "border-gray-200 hover:border-gray-300"
                         }`}
                         onClick={() => setSelectedTemplate("services")}
                       >
                         <div className="flex items-start gap-3">
                           <Wrench className="h-5 w-5 text-blue-600 mt-1" />
                           <div>
                             <div className="font-medium">Services: Qualification & Booking</div>
                             <div className="text-sm text-muted-foreground">
                               Perfect for consultants, plumbers, IT support, and other service providers.
                               Qualifies leads and captures booking requests.
                             </div>
                             <div className="text-xs text-muted-foreground mt-2">
                               6 conversation nodes • Multi-channel ready
                             </div>
                           </div>
                         </div>
                       </div>

                       {/* Agencies Template */}
                       <div
                         className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                           selectedTemplate === "agencies"
                             ? "border-blue-500 bg-blue-50"
                             : "border-gray-200 hover:border-gray-300"
                         }`}
                         onClick={() => setSelectedTemplate("agencies")}
                       >
                         <div className="flex items-start gap-3">
                           <Users className="h-5 w-5 text-blue-600 mt-1" />
                           <div>
                             <div className="font-medium">Agencies: Project Discovery</div>
                             <div className="text-sm text-muted-foreground">
                               Built for marketing, digital, and design agencies. Discovers project scope,
                               budget, and timeline before human handoff.
                             </div>
                             <div className="text-xs text-muted-foreground mt-2">
                               8 conversation nodes • Multi-channel ready
                             </div>
                           </div>
                         </div>
                       </div>

                       {/* Booking Template */}
                       <div
                         className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                           selectedTemplate === "booking"
                             ? "border-blue-500 bg-blue-50"
                             : "border-gray-200 hover:border-gray-300"
                         }`}
                         onClick={() => setSelectedTemplate("booking")}
                       >
                         <div className="flex items-start gap-3">
                           <Calendar className="h-5 w-5 text-blue-600 mt-1" />
                           <div>
                             <div className="font-medium">Booking: Appointments & Reservations</div>
                             <div className="text-sm text-muted-foreground">
                               Ideal for salons, gyms, restaurants, and clinics. Confirms service, collects
                               contact info, and suggests available times.
                             </div>
                             <div className="text-xs text-muted-foreground mt-2">
                               7 conversation nodes • Multi-channel ready
                             </div>
                           </div>
                         </div>
                       </div>
                     </div>
                   </div>
                   <DialogFooter>
                     <Button
                       variant="outline"
                       onClick={() => {
                         setTemplateDialogOpen(false);
                         setSelectedTemplate(null);
                       }}
                     >
                       Cancel
                     </Button>
                     <Button onClick={() => setCreateDialogOpen(true)} disabled={!selectedTemplate}>
                       Next
                     </Button>
                   </DialogFooter>
                 </DialogContent>
               </Dialog>
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
