"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { Loader2, MessageSquare, CheckCircle2, XCircle, Trash2, Zap } from "lucide-react";
import { FacebookLogo } from "@/components/icons/MetaIcons";
import { toast } from "sonner";
import { useConfirmation } from "@/components/ui/confirmation-provider";

export function FacebookConfig({ botId }: { botId: string }) {
  const { confirm } = useConfirmation();
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => { fetchPages(); }, [botId]);

  async function fetchPages() {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/facebook/pages");
      const data = await res.json();
      setConnected(data.connected);
      setPages(data.pages || []);
    } finally { setLoading(setLoading(false)); }
  }

  return (
    <div className="space-y-6">
      {!connected ? (
        <Card><CardHeader><CardTitle>Connect Facebook</CardTitle></CardHeader><CardContent><Button onClick={() => signIn("facebook", { callbackUrl: "/bots/" + botId })}>Continue with Facebook</Button></CardContent></Card>
      ) : (
        <Card><CardHeader><CardTitle>Facebook Pages</CardTitle></CardHeader><CardContent><div className="grid gap-4">{pages.map(p => <div key={p.id} className="border p-4 rounded flex justify-between items-center"><span>{p.name}</span><Badge>{p.connected ? "Connected" : "Disconnected"}</Badge></div>)}</div></CardContent></Card>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="bg-slate-100 px-2 py-1 rounded text-xs">{children}</span>;
}
