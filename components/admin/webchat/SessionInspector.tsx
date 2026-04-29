"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { fetchSessionHistory } from "@/app/(admin)/admin/webchat-monitoring/actions";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, AlertCircle } from "lucide-react";

export function SessionInspector({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistoryAsync = async () => {
      setLoading(true);
      try {
        const data = await fetchSessionHistory(sessionId);
        setHistory(data);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchHistoryAsync();
  }, [sessionId]);

  const sortedItems = history ? [...history.messages, ...history.events].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  ) : [];

  return (
    <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl w-full flex flex-col h-full">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle>Session Inspector</SheetTitle>
          <SheetDescription>
            ID: {sessionId}
          </SheetDescription>
          <div className="flex gap-2 mt-2">
             <Button variant="default" size="sm">
               <MessageSquare className="h-4 w-4 mr-2"/>
               Takeover Chat
             </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden mt-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="h-full pr-4 overflow-y-auto">
              <div className="space-y-4 pb-10">
                {sortedItems.length === 0 ? (
                  <div className="text-center text-muted-foreground">No history available for this session.</div>
                ) : (
                  sortedItems.map((item) => (
                    <div key={item.id} className="flex flex-col gap-1">
                      <div className="text-xs text-muted-foreground ml-1">
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </div>

                      {'content' in item ? (
                        // Message
                        <div className={`flex w-max max-w-[80%] flex-col gap-2 rounded-lg px-3 py-2 text-sm ${
                          item.direction === 'inbound'
                            ? 'bg-muted ml-auto rounded-tr-none'
                            : 'bg-primary text-primary-foreground mr-auto rounded-tl-none'
                        }`}>
                          {item.content}
                          {item.source && item.source !== 'human' && (
                             <Badge variant="secondary" className="w-fit text-[10px] mt-1 opacity-70">bot</Badge>
                          )}
                        </div>
                      ) : (
                        // Event
                        <div className="flex items-center gap-2 text-xs p-2 rounded bg-gray-50 border border-gray-100">
                           {item.type === 'ERROR' ? <AlertCircle className="h-3 w-3 text-red-500"/> : null}
                           <span className="font-semibold text-gray-700">{item.type}</span>
                           <span className="text-gray-500 font-mono break-all">{JSON.stringify(item.payload)}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
