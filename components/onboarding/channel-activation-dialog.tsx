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
import { Loader2, Globe, MessageSquare, Zap, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [botName, setBotName] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");
  const [selectedFlow, setSelectedFlow] = useState("");
  const [flows, setFlows] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchFlows();
    }
  }, [isOpen]);

  const fetchFlows = async () => {
    try {
      const res = await fetch("/api/flows");
      const data = await res.json();
      if (res.ok) {
        setFlows(data.data || []);
        // Set default flow if available
        if (data.data && data.data.length > 0) {
          setSelectedFlow(data.data[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch flows", error);
    }
  };

  const handleActivate = async () => {
    if (!botName || !selectedChannel || !selectedFlow) {
      toast.error("Please complete all fields");
      return;
    }

    setLoading(true);
    try {
      // 1. Create/Update Bot
      const botRes = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: botName,
          channel: selectedChannel === "webchat" ? "web" : selectedChannel,
          entryFlow: selectedFlow,
        }),
      });

      if (!botRes.ok) throw new Error("Failed to create bot");
      const botData = await botRes.json();
      const botId = botData.bot.id;

      // 2. Redirect to specific channel setup
      toast.success("Bot created! Redirecting to channel setup...");
      
      if (selectedChannel === "webchat") {
        router.push(`/integrations/webchat?botId=${botId}`);
      } else if (selectedChannel === "telegram") {
        router.push(`/integrations/telegram?botId=${botId}`);
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
      <DialogContent className="sm:max-w-[500px] border-primary/20 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Connect Your First Lead Channel
          </DialogTitle>
          <DialogDescription>
            Let's get your AI assistant live on your preferred platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Bot Name */}
          <div className="space-y-2">
            <Label htmlFor="bot-name" className="text-xs uppercase tracking-widest text-primary/70">
              Give your Assistant a Name
            </Label>
            <Input
              id="bot-name"
              placeholder="e.g. Sales Concierge"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              className="bg-background/50 border-primary/20"
            />
          </div>

          {/* Channel Selection */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-primary/70">
              Select Your First Channel
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
                onClick={() => setSelectedChannel("telegram")}
                className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${
                  selectedChannel === "telegram"
                    ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                    : "border-primary/10 hover:border-primary/30"
                }`}
              >
                <MessageSquare className={`h-6 w-6 ${selectedChannel === "telegram" ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-bold">Telegram</span>
              </button>
            </div>
          </div>

          {/* Flow Selection */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-primary/70">
              Select Start Flow
            </Label>
            <Select value={selectedFlow} onValueChange={setSelectedFlow}>
              <SelectTrigger className="bg-background/50 border-primary/20">
                <SelectValue placeholder="Choose a flow" />
              </SelectTrigger>
              <SelectContent>
                {flows.map((flow) => (
                  <SelectItem key={flow.id} value={flow.id}>
                    {flow.name}
                  </SelectItem>
                ))}
                <SelectItem value="new">Create New Flow...</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2">
            <a 
              href="https://replybase.co.uk/docs/get-started#connecting-channels" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              How do channels work? <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-primary/10">
          <Button variant="ghost" onClick={onClose} className="flex-1 rounded-xl">
            Cancel
          </Button>
          <Button 
            onClick={handleActivate} 
            disabled={loading || !botName || !selectedChannel || !selectedFlow}
            className="flex-1 rounded-xl font-bold shadow-[0_0_20px_-5px_rgba(var(--primary),0.5)]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start Activation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
