"use client";

import { useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  ArrowLeft,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

export const dynamic = "force-dynamic";

interface FlowButton {
  type: "postback" | "url";
  title: string;
  payload?: string;
  url?: string;
}

interface FlowCondition {
  variableName: string;
  operator: "equals" | "contains" | "greater_than" | "less_than";
  value: string;
  nextNodeOrder?: number;
}

interface FlowReference {
  id: string;
  name: string;
  isActive: boolean;
}

interface FlowNodeContent {
  text?: string;
  buttons?: FlowButton[];
  variableName?: string;
  inputType?: string;
  validationMessage?: string;
  conditions?: FlowCondition[];
  action?: string;
  targetFlowId?: string;
  targetFlowName?: string;
  nextNodeOrder?: number;
  tags?: string[];
  status?: string;
  delayMs?: number;
  waitMs?: number;
  typingDurationMs?: number;
  typingEnabled?: boolean;
}

interface FlowNode {
  type: string;
  content: FlowNodeContent;
  order?: number;
}

interface Flow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  tenantId: string;
  nodes: FlowNode[];
}

import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, ListTree, PlayCircle, Settings } from "lucide-react";

export default function AdminFlowEditorPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const params = use(paramsPromise);
  const flowId = params.id;

  const [flow, setFlow] = useState<Flow | null>(null);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addNodeDialogOpen, setAddNodeDialogOpen] = useState(false);
  const [editingNodeIndex, setEditingNodeIndex] = useState<number | null>(null);
  const [newNodeType, setNewNodeType] = useState("message");
  const [nodeContent, setNodeContent] = useState<FlowNodeContent>({});
  const [activeTab, setActiveTab] = useState("steps");
  const [jsonValue, setJsonValue] = useState("");
  const [flowName, setFlowName] = useState("");
  const [flowDescription, setFlowDescription] = useState("");
  const [flowIsActive, setFlowIsActive] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchFlow = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/flows/${flowId}`);

      if (response.ok) {
        const data = await response.json();
        setFlow(data.flow);
        setFlowName(data.flow.name);
        setFlowDescription(data.flow.description || "");
        setFlowIsActive(data.flow.isActive);
        const flowNodes = data.flow.nodes || [];
        setNodes(flowNodes);
        setJsonValue(JSON.stringify(flowNodes, null, 2));
      } else {
        toast.error("Failed to load flow");
        router.push("/admin/subscribers");
      }
    } catch (error) {
      console.error("Failed to fetch flow:", error);
      toast.error("Failed to load flow");
    } finally {
      setLoading(false);
    }
  }, [flowId, router]);

  useEffect(() => {
    fetchFlow();
  }, [fetchFlow]);

  const handleUpdateSettings = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/admin/flows/${flowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: flowName,
          description: flowDescription,
          isActive: flowIsActive,
        }),
      });

      if (response.ok) {
        toast.success("Flow settings updated");
        fetchFlow();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update settings");
      }
    } catch (error) {
      console.error("Failed to update settings:", error);
      toast.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFlow = async () => {
    if (!confirm("Are you sure you want to delete this flow? This action cannot be undone.")) {
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch(`/api/admin/flows/${flowId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Flow deleted successfully");
        router.push("/admin/subscribers");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete flow");
      }
    } catch (error) {
      console.error("Failed to delete flow:", error);
      toast.error("Failed to delete flow");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveFlow = async () => {
    try {
      setSaving(true);
      let nodesToSave = nodes;

      if (activeTab === "json") {
        try {
          nodesToSave = JSON.parse(jsonValue);
        } catch (e) {
          toast.error("Invalid JSON format. Please fix it before saving.");
          setSaving(false);
          return;
        }
      }

      const response = await fetch(`/api/admin/flows/${flowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes: nodesToSave }),
      });

      if (response.ok) {
        toast.success("Flow nodes saved successfully");
        fetchFlow();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save flow");
      }
    } catch (error) {
      console.error("Failed to save flow:", error);
      toast.error("Failed to save flow");
    } finally {
      setSaving(false);
    }
  };

  const handleAddNode = () => {
    const newNode: FlowNode = {
      type: newNodeType,
      content: {},
    };

    let updatedNodes = [...nodes];
    if (editingNodeIndex !== null) {
      updatedNodes[editingNodeIndex] = { ...newNode, content: nodeContent };
    } else {
      updatedNodes = [...nodes, { ...newNode, content: nodeContent }];
    }

    setNodes(updatedNodes);
    setJsonValue(JSON.stringify(updatedNodes, null, 2));
    setAddNodeDialogOpen(false);
    setNewNodeType("message");
    setNodeContent({});
    setEditingNodeIndex(null);
  };

  const handleDeleteNode = (index: number) => {
    const updatedNodes = nodes.filter((_, i) => i !== index);
    setNodes(updatedNodes);
    setJsonValue(JSON.stringify(updatedNodes, null, 2));
  };

  const handleMoveNode = (index: number, direction: "up" | "down") => {
    const newNodes = [...nodes];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex >= 0 && targetIndex < nodes.length) {
      [newNodes[index], newNodes[targetIndex]] = [
        newNodes[targetIndex],
        newNodes[index],
      ];
      setNodes(newNodes);
      setJsonValue(JSON.stringify(newNodes, null, 2));
    }
  };

  const handleEditNode = (index: number) => {
    setEditingNodeIndex(index);
    setNewNodeType(nodes[index].type);
    setNodeContent(nodes[index].content);
    setAddNodeDialogOpen(true);
  };

  const syncNodesFromJson = () => {
    try {
      const parsedNodes = JSON.parse(jsonValue);
      if (Array.isArray(parsedNodes)) {
        setNodes(parsedNodes);
        toast.success("JSON synced to Steps view");
      } else {
        toast.error("JSON must be an array of nodes");
      }
    } catch (e) {
      toast.error("Invalid JSON format");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!flow) return null;

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5" />
        <div>
          <h3 className="font-bold text-amber-900 text-sm">Admin Flow Editor</h3>
          <p className="text-amber-800 text-xs mt-1">
            You are editing this flow on behalf of <strong>Tenant ID: {flow.tenantId}</strong>.
            Changes will take effect immediately for the user&apos;s bot.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{flow.name}</h1>
              <Badge variant={flow.isActive ? "default" : "secondary"}>
                {flow.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-muted-foreground">{flow.description || "Flow Editor"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {activeTab === "steps" && (
            <Button variant="outline" onClick={() => setAddNodeDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Step
            </Button>
          )}
          {activeTab === "json" && (
            <Button variant="outline" onClick={syncNodesFromJson}>
              <PlayCircle className="mr-2 h-4 w-4" /> Sync to Steps
            </Button>
          )}
          {activeTab !== "settings" && (
            <Button onClick={handleSaveFlow} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Flow
            </Button>
          )}
          {activeTab === "settings" && (
             <Button variant="destructive" onClick={handleDeleteFlow} disabled={deleting}>
               {deleting ? (
                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
               ) : (
                 <Trash2 className="mr-2 h-4 w-4" />
               )}
               Delete Flow
             </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[500px]">
          <TabsTrigger value="steps" className="flex items-center gap-2">
            <ListTree className="h-4 w-4" /> Steps
          </TabsTrigger>
          <TabsTrigger value="json" className="flex items-center gap-2">
            <Code className="h-4 w-4" /> JSON Editor
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" /> Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="steps" className="mt-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {nodes.map((node, index) => (
              <Card key={index} className="relative border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs uppercase">
                        Step {index + 1}
                      </Badge>
                      <CardTitle className="text-base capitalize">
                        {node.type.replace("_", " ")}
                      </CardTitle>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveNode(index, "up")}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveNode(index, "down")}
                        disabled={index === nodes.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditNode(index)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteNode(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                    {JSON.stringify(node.content, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            ))}

            {nodes.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/30">
                <p className="text-muted-foreground">No steps in this flow yet.</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setAddNodeDialogOpen(true)}
                >
                  Add your first step
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="json" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Code className="h-4 w-4" /> Raw Flow JSON
              </CardTitle>
              <CardDescription>
                Paste or edit the full flow node array here. Format must be an array of FlowNode objects.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                className="font-mono text-xs min-h-[500px] resize-y"
                value={jsonValue}
                onChange={(e) => setJsonValue(e.target.value)}
                placeholder="[ { 'type': 'message', 'content': { 'text': 'Hello' } } ]"
              />
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <p>Ensure valid JSON structure. Use &quot;Sync to Steps&quot; to update the visual view.</p>
                <Badge variant="outline">{nodes.length} Nodes detected</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" /> Flow Settings
              </CardTitle>
              <CardDescription>
                Manage general information and status for this conversational flow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 max-w-2xl">
                <div className="space-y-2">
                  <Label htmlFor="flowName">Flow Name</Label>
                  <Input
                    id="flowName"
                    value={flowName}
                    onChange={(e) => setFlowName(e.target.value)}
                    placeholder="e.g. Master Orchestrator"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flowDescription">Description</Label>
                  <Textarea
                    id="flowDescription"
                    value={flowDescription}
                    onChange={(e) => setFlowDescription(e.target.value)}
                    placeholder="Describe the purpose of this flow"
                    rows={3}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-base">Active Status</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable or disable this flow for the user&apos;s bot.
                    </p>
                  </div>
                  <Switch
                    checked={flowIsActive}
                    onCheckedChange={setFlowIsActive}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t">
                <Button onClick={handleUpdateSettings} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6 border-destructive/20 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Permanently delete this flow and all associated data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={handleDeleteFlow} disabled={deleting}>
                {deleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete Flow Permanently
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={addNodeDialogOpen} onOpenChange={setAddNodeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingNodeIndex !== null ? "Edit Step" : "Add New Step"}
            </DialogTitle>
            <DialogDescription>
              Configure the behavior of this flow step.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Node Type</Label>
              <Select
                value={newNodeType}
                onValueChange={setNewNodeType}
                disabled={editingNodeIndex !== null}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="message">Send Message</SelectItem>
                  <SelectItem value="input">Collect Input</SelectItem>
                  <SelectItem value="condition">Condition</SelectItem>
                  <SelectItem value="action">Action</SelectItem>
                  <SelectItem value="wait">Wait</SelectItem>
                  <SelectItem value="typing">Typing Effect</SelectItem>
                  <SelectItem value="end">End Flow</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newNodeType === "message" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Message Text</Label>
                  <Textarea
                    placeholder="Enter your message..."
                    value={nodeContent.text || ""}
                    onChange={(e) =>
                      setNodeContent({ ...nodeContent, text: e.target.value })
                    }
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Buttons (Titles separated by newline)</Label>
                  <Textarea
                    placeholder="Button 1\nButton 2"
                    value={nodeContent.buttons?.map(b => b.title).join("\n") || ""}
                    onChange={(e) => {
                      const titles = e.target.value.split("\n").filter(Boolean);
                      setNodeContent({
                        ...nodeContent,
                        buttons: titles.map(title => ({ type: "postback", title, payload: title }))
                      });
                    }}
                  />
                </div>
              </div>
            )}

            {/* Basic Support for other types in admin editor */}
            {newNodeType !== "message" && (
              <div className="space-y-2">
                <Label>Raw Content (JSON)</Label>
                <Textarea
                  placeholder="{}"
                  value={JSON.stringify(nodeContent, null, 2)}
                  onChange={(e) => {
                    try {
                      setNodeContent(JSON.parse(e.target.value));
                    } catch (err) {}
                  }}
                  rows={8}
                  className="font-mono text-xs"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddNodeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNode}>
              {editingNodeIndex !== null ? "Update Step" : "Add Step"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
