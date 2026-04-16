"use client";

import { Clock, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FlowOption = {
  id: string;
  name: string;
};

type ActivityLogItem = {
  id: string;
  event: string;
  createdAt: string;
  type?: string;
};

type ChannelFlowAssignmentCardProps = {
  title: string;
  description: string;
  selectLabel: string;
  selectId: string;
  flows: FlowOption[];
  isFlowsLoading: boolean;
  selectedFlowId: string;
  onSelectFlow: (value: string) => void;
  selectDisabled?: boolean;
  assignedFlowName?: string | null;
  unassignedDescription: string;
  assignLabel?: string;
  unassignLabel?: string;
  onAssign: () => void;
  onUnassign: () => void;
  isAssigning: boolean;
  isUnassigning: boolean;
  assignDisabled: boolean;
  unassignDisabled: boolean;
};

export function ChannelFlowAssignmentCard({
  title,
  description,
  selectLabel,
  selectId,
  flows,
  isFlowsLoading,
  selectedFlowId,
  onSelectFlow,
  selectDisabled = false,
  assignedFlowName,
  unassignedDescription,
  assignLabel = "Assign Flow",
  unassignLabel = "Unassign Flow",
  onAssign,
  onUnassign,
  isAssigning,
  isUnassigning,
  assignDisabled,
  unassignDisabled,
}: ChannelFlowAssignmentCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-w-lg space-y-2">
          <Label htmlFor={selectId}>{selectLabel}</Label>
          {isFlowsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading flows...
            </div>
          ) : flows.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No active flows available. Activate a flow in Flow Builder first.
            </div>
          ) : (
            <Select
              value={selectedFlowId || "none"}
              onValueChange={(value) => onSelectFlow(value === "none" ? "" : value)}
              disabled={selectDisabled}
            >
              <SelectTrigger id={selectId}>
                <SelectValue placeholder="Select a flow" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No flow selected</SelectItem>
                {flows.map((flow) => (
                  <SelectItem key={flow.id} value={flow.id}>
                    {flow.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          {assignedFlowName ? (
            <span>
              Currently assigned: <strong>{assignedFlowName}</strong>
            </span>
          ) : (
            <span>{unassignedDescription}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onAssign} disabled={assignDisabled}>
            {isAssigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {assignLabel}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onUnassign}
            disabled={unassignDisabled}
          >
            {isUnassigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {unassignLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type ChannelActivityLogCardProps = {
  title?: string;
  description?: string;
  logs: ActivityLogItem[];
  isLoading: boolean;
  onRefresh: () => void;
  emptyText: string;
};

export function ChannelActivityLogCard({
  title = "Recent Webhook Activity",
  description = "Last 15 events logged for this channel",
  logs,
  isLoading,
  onRefresh,
  emptyText,
}: ChannelActivityLogCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              {title}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading activity...
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between border-b py-1.5 text-xs last:border-0"
              >
                <div className="flex items-center gap-2">
                  {log.type ? (
                    <Badge
                      variant={log.type === "delivery_error" ? "destructive" : "secondary"}
                      className="px-1.5 py-0 text-[10px]"
                    >
                      {log.type}
                    </Badge>
                  ) : null}
                  <span className="max-w-xs truncate font-mono text-muted-foreground">
                    {log.event}
                  </span>
                </div>
                <span className="ml-4 shrink-0 text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
