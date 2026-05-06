"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Send, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useConfirmation } from "@/components/ui/confirmation-provider";
import { ChannelActivityLogCard, ChannelFlowAssignmentCard } from "@/components/channels/channel-sections";

interface FlowOption { id: string; name: string; isActive: boolean; }
interface TelegramStatus { connected: boolean; channel?: { id: string; name: string; channelId: string; updatedAt: string; }; botInfo?: { id: number; first_name: string; username: string; }; }
interface WebhookLogEntry { id: string; type: string; event: string; createdAt: string; }

export function TelegramConfig({ botId }: { botId: string }) {
  const { confirm } = useConfirmation();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [isFlowsLoading, setIsFlowsLoading] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [assignedFlow, setAssignedFlow] = useState<FlowOption | null>(null);
  const [logs, setLogs] = useState<WebhookLogEntry[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  useEffect(() => {
    if (!botId) return;
    loadStatus(botId);
    loadFlows();
    loadTelegramChannel(botId);
  }, [botId]);

  async function loadStatus(id: string) {
    setLoadingStatus(true);
    try {
      const res = await fetch(`/api/bots/${encodeURIComponent(id)}/channels/telegram/status`);
      const data = await res.json();
      setStatus(data);
      if (data.connected && data.channel?.id) loadLogs(id, data.channel.id);
    } finally { setLoadingStatus(false); }
  }

  async function loadFlows() {
    setIsFlowsLoading(true);
    try {
      const res = await fetch("/api/flows?isActive=true&type=my");
      const data = await res.json();
      setFlows(Array.isArray(data.flows) ? data.flows : []);
    } finally { setIsFlowsLoading(false); }
  }

  async function loadTelegramChannel(id: string) {
    try {
      const res = await fetch(`/api/bots/${id}/channels`);
      const data = await res.json();
      const channel = (data.channels || []).find((c: any) => c.type === "telegram");
      if (channel?.flowAssignments?.[0]) {
        setAssignedFlow(channel.flowAssignments[0].flow);
        setSelectedFlowId(channel.flowAssignments[0].flowId);
      }
    } catch {}
  }

  async function loadLogs(bId: string, cId: string) {
    setIsLogsLoading(true);
    try {
      const res = await fetch(`/api/bots/${encodeURIComponent(bId)}/channels/telegram/logs?channelId=${cId}`);
      const data = await res.json();
      setLogs(data.logs || []);
    } finally { setIsLogsLoading(false); }
  }

  async function handleConnect() {
    setIsConnecting(true);
    try {
      const res = await fetch(`/api/bots/${encodeURIComponent(botId)}/channels/telegram/${status?.connected ? 'reconnect' : 'connect'}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botToken })
      });
      if (res.ok) { toast.success("Telegram connected"); setBotToken(""); loadStatus(botId); }
    } finally { setIsConnecting(false); }
  }

  async function handleDisconnect() {
    if (!status?.channel?.id) return;
    if (await confirm({ title: "Disconnect", description: "Are you sure?", confirmText: "Disconnect", variant: "destructive" })) {
      setIsDisconnecting(true);
      try {
        await fetch(`/api/bots/${encodeURIComponent(botId)}/channels/telegram/disconnect`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId: status.channel.id })
        });
        loadStatus(botId);
      } finally { setIsDisconnecting(false); }
    }
  }

  return (
    <div className="space-y-6">
      {status?.connected ? (
        <>
          <Card><CardHeader><CardTitle>Bot: @{status.botInfo?.username}</CardTitle></CardHeader><CardContent><Button variant="destructive" onClick={handleDisconnect} disabled={isDisconnecting}>Disconnect</Button></CardContent></Card>
          <ChannelFlowAssignmentCard title="Flow" description="Assign" selectLabel="Flow" selectId="tg-flow" flows={flows} isFlowsLoading={isFlowsLoading} selectedFlowId={selectedFlowId} onSelectFlow={setSelectedFlowId} assignedFlowName={assignedFlow?.name} unassignedDescription="None" onAssign={async () => {}} onUnassign={async () => {}} isAssigning={false} isUnassigning={false} assignDisabled={true} unassignDisabled={true} />
          <ChannelActivityLogCard logs={logs} isLoading={isLogsLoading} onRefresh={() => status.channel?.id && loadLogs(botId, status.channel.id)} emptyText="No logs" />
        </>
      ) : (
        <Card><CardHeader><CardTitle>Connect Telegram</CardTitle></CardHeader><CardContent className="space-y-4"><Input type="password" value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="Bot Token" /><Button onClick={handleConnect} disabled={isConnecting}>Connect</Button></CardContent></Card>
      )}
    </div>
  );
}
