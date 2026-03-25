"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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
} from "lucide-react";
import { toast } from "sonner";

export const dynamic = 'force-dynamic';

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
  nodes: FlowNode[];
}

export default function FlowEditorPage() {
  const router = useRouter();
  const params = useParams();
  const flowId = params.id as string;

  const [flow, setFlow] = useState<Flow | null>(null);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [availableFlows, setAvailableFlows] = useState<FlowReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addNodeDialogOpen, setAddNodeDialogOpen] = useState(false);
  const [editingNodeIndex, setEditingNodeIndex] = useState<number | null>(null);
  const [newNodeType, setNewNodeType] = useState("message");
  const [nodeContent, setNodeContent] = useState<FlowNodeContent>({});

  const fetchFlow = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/flows/${flowId}`);

      if (response.ok) {
        const data = await response.json();
        setFlow(data.flow);
        setNodes(data.flow.nodes || []);
      } else {
        toast.error("Failed to load flow");
        router.push("/flows");
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

  useEffect(() => {
    const loadAvailableFlows = async () => {
      try {
        const [myResponse, globalResponse] = await Promise.all([
          fetch("/api/flows?type=my"),
          fetch("/api/flows?type=global"),
        ]);

        const flowList: FlowReference[] = [];

        if (myResponse.ok) {
          const data = await myResponse.json();
          if (Array.isArray(data.flows)) {
            flowList.push(
              ...data.flows.map(
                (item: { id: string; name: string; isActive: boolean }) => ({
                  id: item.id,
                  name: item.name,
                  isActive: item.isActive,
                }),
              ),
            );
          }
        }

        if (globalResponse.ok) {
          const data = await globalResponse.json();
          if (Array.isArray(data.flows)) {
            flowList.push(
              ...data.flows.map(
                (item: { id: string; name: string; isActive: boolean }) => ({
                  id: item.id,
                  name: item.name,
                  isActive: item.isActive,
                }),
              ),
            );
          }
        }

        setAvailableFlows(flowList.filter((item) => item.id !== flowId));
      } catch (error) {
        console.error("Failed to load flows for references:", error);
      }
    };

    void loadAvailableFlows();
  }, [flowId]);

  const handleSaveFlow = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/flows/${flowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes }),
      });

      if (response.ok) {
        toast.success("Flow saved successfully");
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

    if (editingNodeIndex !== null) {
      // Update existing node
      const updatedNodes = [...nodes];
      updatedNodes[editingNodeIndex] = { ...newNode, content: nodeContent };
      setNodes(updatedNodes);
    } else {
      // Add new node
      setNodes([...nodes, { ...newNode, content: nodeContent }]);
    }

    setAddNodeDialogOpen(false);
    setNewNodeType("message");
    setNodeContent({});
    setEditingNodeIndex(null);
  };

  const handleDeleteNode = (index: number) => {
    setNodes(nodes.filter((_, i) => i !== index));
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
    }
  };

  const handleEditNode = (index: number) => {
    setEditingNodeIndex(index);
    setNewNodeType(nodes[index].type);
    setNodeContent(nodes[index].content);
    setAddNodeDialogOpen(true);
  };

  const renderNodeCard = (node: FlowNode, index: number) => {
    const getNodeIcon = (type: string) => {
      switch (type) {
        case "message":
          return "💬";
        case "input":
          return "✏️";
        case "condition":
          return "🔀";
        case "action":
          return "⚡";
        case "end":
          return "🏁";
        default:
          return "📝";
      }
    };

    const getNodeTitle = (type: string) => {
      switch (type) {
        case "message":
          return "Send Message";
        case "input":
          return "Collect Input";
        case "condition":
          return "Condition";
        case "action":
          return "Action";
        case "end":
          return "End Flow";
        default:
          return type;
      }
    };

    return (
      <Card key={index} className="relative">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{getNodeIcon(node.type)}</span>
              <div>
                <CardTitle className="text-base">
                  Step {index + 1}: {getNodeTitle(node.type)}
                </CardTitle>
                <Badge variant="outline" className="mt-1">
                  {node.type}
                </Badge>
              </div>
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
          {node.type === "message" && (
            <div className="space-y-2">
              <p className="text-sm">{node.content.text || "No message"}</p>
              {node.content.buttons && node.content.buttons.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {node.content.buttons?.map((btn: FlowButton, i: number) => (
                    <Badge key={i} variant="secondary">
                      {btn.title}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
          {node.type === "input" && (
            <div className="text-sm space-y-1">
              <p>
                <strong>Variable:</strong> {node.content.variableName || "N/A"}
              </p>
              <p>
                <strong>Type:</strong> {node.content.inputType || "text"}
              </p>
              {node.content.nextNodeOrder !== undefined && (
                <p>
                  <strong>Next Step:</strong> {node.content.nextNodeOrder + 1}
                </p>
              )}
            </div>
          )}
          {node.type === "condition" && (
            <div className="text-sm space-y-2">
              {(node.content.conditions || []).length > 0 ? (
                node.content.conditions?.map((condition, conditionIndex) => (
                  <p key={conditionIndex}>
                    <strong>Rule {conditionIndex + 1}:</strong>{" "}
                    {condition.variableName} {condition.operator}{" "}
                    {condition.value} → Step{" "}
                    {(condition.nextNodeOrder ?? 0) + 1}
                  </p>
                ))
              ) : (
                <p className="text-muted-foreground">
                  No condition rules configured
                </p>
              )}
              {node.content.nextNodeOrder !== undefined && (
                <p>
                  <strong>Fallback Step:</strong>{" "}
                  {node.content.nextNodeOrder + 1}
                </p>
              )}
            </div>
          )}
          {node.type === "action" && (
            <div className="text-sm space-y-1">
              <p>
                <strong>Action:</strong> {node.content.action || "N/A"}
              </p>
              {node.content.targetFlowName && (
                <p>
                  <strong>Calls Flow:</strong> {node.content.targetFlowName}
                </p>
              )}
              {node.content.nextNodeOrder !== undefined && (
                <p>
                  <strong>Next Step:</strong> {node.content.nextNodeOrder + 1}
                </p>
              )}
              {node.content.tags && (
                <p>
                  <strong>Tags:</strong> {node.content.tags.join(", ")}
                </p>
              )}
            </div>
          )}
          {node.type === "end" && (
            <p className="text-sm text-muted-foreground">
              This will end the conversation flow
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderNodeEditor = () => {
    return (
      <div className="space-y-4">
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
              <Label>Quick Reply Buttons (Optional)</Label>
              <p className="text-sm text-muted-foreground">
                Enter button titles, one per line
              </p>
              <Textarea
                placeholder="Button 1&#10;Button 2&#10;Button 3"
                value={
                  nodeContent.buttons
                    ?.map((b: FlowButton) => b.title)
                    .join("\n") || ""
                }
                onChange={(e) => {
                  const titles = e.target.value.split("\n").filter(Boolean);
                  setNodeContent({
                    ...nodeContent,
                    buttons: titles.map((title) => ({
                      type: "postback",
                      title,
                      payload: title,
                    })),
                  });
                }}
                rows={3}
              />
            </div>
          </div>
        )}

        {newNodeType === "input" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Prompt Message</Label>
              <Textarea
                placeholder="What should the user enter?"
                value={nodeContent.text || ""}
                onChange={(e) =>
                  setNodeContent({ ...nodeContent, text: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Variable Name</Label>
              <Input
                placeholder="e.g., user_email"
                value={nodeContent.variableName || ""}
                onChange={(e) =>
                  setNodeContent({
                    ...nodeContent,
                    variableName: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Input Type</Label>
              <Select
                value={nodeContent.inputType || "text"}
                onValueChange={(value) =>
                  setNodeContent({ ...nodeContent, inputType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Next Step Order (Optional)</Label>
              <Input
                type="number"
                min={0}
                placeholder="Leave blank to continue to the next step"
                value={
                  nodeContent.nextNodeOrder !== undefined
                    ? String(nodeContent.nextNodeOrder)
                    : ""
                }
                onChange={(e) =>
                  setNodeContent({
                    ...nodeContent,
                    nextNodeOrder:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
        )}

        {newNodeType === "condition" && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              Use conditions to branch the flow in multiple directions. Common
              variables: <strong>last_user_message</strong>,{" "}
              <strong>last_user_message_normalized</strong>, or any variable
              collected by an input node.
            </div>
            {(nodeContent.conditions || []).map((condition, index) => (
              <div key={index} className="rounded-lg border p-3 space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Variable</Label>
                    <Input
                      placeholder="e.g., last_user_message_normalized"
                      value={condition.variableName}
                      onChange={(e) => {
                        const conditions = [...(nodeContent.conditions || [])];
                        conditions[index] = {
                          ...conditions[index],
                          variableName: e.target.value,
                        };
                        setNodeContent({ ...nodeContent, conditions });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Operator</Label>
                    <Select
                      value={condition.operator}
                      onValueChange={(value) => {
                        const conditions = [...(nodeContent.conditions || [])];
                        conditions[index] = {
                          ...conditions[index],
                          operator: value as FlowCondition["operator"],
                        };
                        setNodeContent({ ...nodeContent, conditions });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">Equals</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="greater_than">
                          Greater Than
                        </SelectItem>
                        <SelectItem value="less_than">Less Than</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Value</Label>
                    <Input
                      placeholder="e.g., pricing"
                      value={condition.value}
                      onChange={(e) => {
                        const conditions = [...(nodeContent.conditions || [])];
                        conditions[index] = {
                          ...conditions[index],
                          value: e.target.value,
                        };
                        setNodeContent({ ...nodeContent, conditions });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Go To Step Order</Label>
                    <Input
                      type="number"
                      min={0}
                      value={
                        condition.nextNodeOrder !== undefined
                          ? String(condition.nextNodeOrder)
                          : ""
                      }
                      onChange={(e) => {
                        const conditions = [...(nodeContent.conditions || [])];
                        conditions[index] = {
                          ...conditions[index],
                          nextNodeOrder:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        };
                        setNodeContent({ ...nodeContent, conditions });
                      }}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const conditions = [...(nodeContent.conditions || [])];
                    conditions.splice(index, 1);
                    setNodeContent({ ...nodeContent, conditions });
                  }}
                >
                  Remove Rule
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setNodeContent({
                  ...nodeContent,
                  conditions: [
                    ...(nodeContent.conditions || []),
                    {
                      variableName: "last_user_message_normalized",
                      operator: "contains",
                      value: "",
                    },
                  ],
                })
              }
            >
              Add Condition Rule
            </Button>
            <div className="space-y-2">
              <Label>Fallback Step Order (Optional)</Label>
              <Input
                type="number"
                min={0}
                placeholder="Used when no rule matches"
                value={
                  nodeContent.nextNodeOrder !== undefined
                    ? String(nodeContent.nextNodeOrder)
                    : ""
                }
                onChange={(e) =>
                  setNodeContent({
                    ...nodeContent,
                    nextNodeOrder:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
        )}

        {newNodeType === "action" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select
                value={nodeContent.action || "tag_user"}
                onValueChange={(value) =>
                  setNodeContent({ ...nodeContent, action: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tag_user">Tag User</SelectItem>
                  <SelectItem value="update_status">Update Status</SelectItem>
                  <SelectItem value="call_flow">Call Another Flow</SelectItem>
                  <SelectItem value="end_flow">End Flow</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {nodeContent.action === "tag_user" && (
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input
                  placeholder="e.g., interested, qualified"
                  value={nodeContent.tags?.join(", ") || ""}
                  onChange={(e) =>
                    setNodeContent({
                      ...nodeContent,
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            )}

            {nodeContent.action === "update_status" && (
              <div className="space-y-2">
                <Label>New Status</Label>
                <Select
                  value={nodeContent.status || "contacted"}
                  onValueChange={(value) =>
                    setNodeContent({ ...nodeContent, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {nodeContent.action === "call_flow" && (
              <div className="space-y-2">
                <Label>Flow To Call</Label>
                <Select
                  value={nodeContent.targetFlowId || ""}
                  onValueChange={(value) => {
                    const selectedFlow = availableFlows.find(
                      (item) => item.id === value,
                    );
                    setNodeContent({
                      ...nodeContent,
                      targetFlowId: value,
                      targetFlowName: selectedFlow?.name,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a reusable subflow" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFlows.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} {item.isActive ? "" : "(inactive)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Next Step Order (Optional)</Label>
              <Input
                type="number"
                min={0}
                placeholder={
                  nodeContent.action === "call_flow"
                    ? "Where the parent flow should continue after the called flow finishes"
                    : "Leave blank to continue to the next step"
                }
                value={
                  nodeContent.nextNodeOrder !== undefined
                    ? String(nodeContent.nextNodeOrder)
                    : ""
                }
                onChange={(e) =>
                  setNodeContent({
                    ...nodeContent,
                    nextNodeOrder:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
        )}

        {newNodeType === "end" && (
          <p className="text-sm text-muted-foreground">
            This node will end the conversation flow. No configuration needed.
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!flow) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/flows")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{flow.name}</h1>
            {flow.description && (
              <p className="text-muted-foreground">{flow.description}</p>
            )}
          </div>
        </div>
        <Button onClick={handleSaveFlow} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          Save Flow
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flow Steps</CardTitle>
          <CardDescription>
            Build your flow with messages, input capture, branching conditions,
            and reusable subflows
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {nodes.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground mb-4">
                No steps added yet. Start building your flow!
              </p>
              <Button onClick={() => setAddNodeDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Step
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {nodes.map((node, index) => renderNodeCard(node, index))}
              </div>
              <Button
                onClick={() => setAddNodeDialogOpen(true)}
                variant="outline"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Step
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Node Dialog */}
      <Dialog
        open={addNodeDialogOpen}
        onOpenChange={(open) => {
          setAddNodeDialogOpen(open);
          if (!open) {
            setEditingNodeIndex(null);
            setNewNodeType("message");
            setNodeContent({});
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingNodeIndex !== null ? "Edit Step" : "Add New Step"}
            </DialogTitle>
            <DialogDescription>
              Configure the step for your flow
            </DialogDescription>
          </DialogHeader>
          {renderNodeEditor()}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddNodeDialogOpen(false)}
            >
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
