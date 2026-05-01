"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Globe, MessageSquare, Zap, ExternalLink, Plus, Bot as BotIcon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { FacebookLogo } from "@/components/icons/MetaIcons";

export function ChannelActivationDialog({
  isOpen,
  onClose,
  tenantId
}: {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"select" | "create">("select");
  const [selectedBotId, setSelectedBotId] = useState("");
  const [newBotName, setNewBotName] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("webchat");
  const [selectedFlowId, setSelectedFlowId] = useState("");
  
  const [bots, setBots] = useState<any[]>([]);
  const [flows, setFlows] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [botsRes, flowsRes] = await Promise.all([
        fetch("/api/bots"),
        fetch("/api/flows")
      ]);
      
      if (botsRes.ok) {
        const data = await botsRes.json();
        const extractedBots = data.projects?.[0]?.bots || [];
        setBots(extractedBots);
        if (extractedBots.length > 0) {
          setSelectedBotId(extractedBots[0].id);
          setMode("select");
        } else {
          setMode("create");
        }
      }

      if (flowsRes.ok) {
        const data = await flowsRes.json();
        const extractedFlows = data.flows || [];
        setFlows(extractedFlows);
        if (extractedFlows.length > 0) {
          setSelectedFlowId(extractedFlows[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch activation data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    if (mode === "create" && !newBotName) {
      toast.error("Please provide a bot name");
      return;
    }
    if (mode === "select" && !selectedBotId) {
      toast.error("Please select a bot");
      return;
    }
    if (!selectedChannel || !selectedFlowId) {
      toast.error("Please complete all fields");
      return;
    }

    setLoading(true);
    try {
      let botId = selectedBotId;

      // 1. Create Bot if needed
      if (mode === "create") {
        const botRes = await fetch("/api/bots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newBotName,
            channel: selectedChannel === "webchat" ? "web" : selectedChannel,
            entryFlow: selectedFlowId,
          }),
        });

        if (!botRes.ok) throw new Error("Failed to create bot");
        const botData = await botRes.json();
        botId = botData.bot.id;
      } else {
        // Update existing bot's entry flow
        await fetch(`/api/bots/${botId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entryFlow: selectedFlowId,
          }),
        });
      }

      // 2. Redirect to specific channel setup
      toast.success("Bot ready! Redirecting to channel setup...");
      
      if (selectedChannel === "webchat") {
        router.push(`/integrations/webchat?botId=${botId}`);
      } else if (selectedChannel === "facebook") {
        router.push(`/integrations/facebook?botId=${botId}`);
      } else {
        router.push("/integrations");
      }
      
      onClose();
    } catch (error) {
      console.error("Activation error:", error);
      toast.error("Failed to activate channel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] border-primary/20 bg-background/95 backdrop-blur-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Connect Your First Lead Channel
          </DialogTitle>
          <DialogDescription>
            Go live on Facebook or Web Chat with your AI assistant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Bot Selection/Creation */}
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-widest text-primary/70">
              AI Assistant
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={mode === "select" ? "default" : "outline"}
                size="sm"
                className="rounded-lg h-10"
                onClick={() => setMode("select")}
                disabled={bots.length === 0}
              >
                <BotIcon className="mr-2 h-4 w-4" />
                Select Existing
              </Button>
              <Button
                type="button"
                variant={mode === "create" ? "default" : "outline"}
                size="sm"
                className="rounded-lg h-10"
                onClick={() => setMode("create")}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Assistant
              </Button>
            </div>

            {mode === "select" ? (
              <Select value={selectedBotId} onValueChange={setSelectedBotId}>
                <SelectTrigger className="bg-background/50 border-primary/20 rounded-xl">
                  <SelectValue placeholder="Choose an assistant" />
                </SelectTrigger>
                <SelectContent>
                  {bots.map((bot) => (
                    <SelectItem key={bot.id} value={bot.id}>
                      {bot.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="e.g. Sales Concierge"
                value={newBotName}
                onChange={(e) => setNewBotName(e.target.value)}
                className="bg-background/50 border-primary/20 rounded-xl h-11"
              />
            )}
          </div>

          {/* Channel Selection */}
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-widest text-primary/70">
              Target Channel
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setSelectedChannel("webchat")}
                className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${
                  selectedChannel === "webchat"
                    ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                    : "border-primary/10 hover:border-primary/30"
                }`}
              >
                <Globe className={`h-6 w-6 ${selectedChannel === "webchat" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-bold">Web Chat</span>
              </button>
              <button
                onClick={() => setSelectedChannel("facebook")}
                className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${
                  selectedChannel === "facebook"
                    ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                    : "border-primary/10 hover:border-primary/30"
                }`}
              >
                <FacebookLogo className={`h-6 w-6 ${selectedChannel === "facebook" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-bold">Facebook</span>
              </button>
            </div>
          </div>

          {/* Flow Selection */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-primary/70">
              Intelligence Flow
            </Label>
            <Select value={selectedFlowId} onValueChange={setSelectedFlowId}>
              <SelectTrigger className="bg-background/50 border-primary/20 rounded-xl h-11">
                <SelectValue placeholder="Choose a flow" />
              </SelectTrigger>
              <SelectContent>
                {flows.map((flow) => (
                  <SelectItem key={flow.id} value={flow.id}>
                    {flow.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2">
            <a 
              href="https://replybase.co.uk/docs/get-started#connecting-channels" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            >
              How do channels work? <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-primary/10">
          <Button variant="ghost" onClick={onClose} className="flex-1 rounded-xl h-11">
            Cancel
          </Button>
          <Button 
            onClick={handleActivate} 
            disabled={loading || (mode === "create" && !newBotName) || (mode === "select" && !selectedBotId) || !selectedFlowId}
            className="flex-1 rounded-xl h-11 font-bold shadow-[0_0_20px_-5px_rgba(var(--primary),0.5)]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete Setup"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
