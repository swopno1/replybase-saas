"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Database, Brain, Network, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InspectorPanelProps {
  variables: Record<string, unknown>;
  onExport: (format: "json" | "markdown") => void;
}

export function InspectorPanel({ variables, onExport }: InspectorPanelProps) {
  // Filter variables to show relevant lead data vs internal state
  const leadData = Object.entries(variables).filter(([key]) =>
    !key.startsWith("__") && !["session_id", "sync_hash", "last_node_id"].includes(key)
  );

  const internalState = Object.entries(variables).filter(([key]) =>
    key.startsWith("__") || ["session_id", "sync_hash", "last_node_id"].includes(key)
  );

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-medium">System Inspector</CardTitle>
          <CardDescription className="text-[10px]">Real-time simulation state</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onExport("json")}>
            <Download className="h-3 w-3 mr-1" /> JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExport("markdown")}>
            <Download className="h-3 w-3 mr-1" /> MD
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <Tabs defaultValue="crm" className="h-full flex flex-col">
          <div className="px-4 border-b">
            <TabsList className="w-full justify-start bg-transparent h-10 p-0 gap-4">
              <TabsTrigger value="crm" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-10">
                <Database className="h-4 w-4 mr-2" /> CRM
              </TabsTrigger>
              <TabsTrigger value="memory" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-10">
                <Network className="h-4 w-4 mr-2" /> Memory
              </TabsTrigger>
              <TabsTrigger value="ai" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-10">
                <Brain className="h-4 w-4 mr-2" /> AI Trace
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="flex-1 overflow-hidden">
            <TabsContent value="crm" className="h-full m-0 p-4">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">Extracted Lead Data</div>
                  {leadData.length === 0 && (
                    <div className="text-xs text-muted-foreground italic">No data captured yet.</div>
                  )}
                  {leadData.map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-1 border-b border-dashed last:border-0">
                      <span className="text-xs font-mono">{key}</span>
                      <span className="text-xs font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="memory" className="h-full m-0 p-4">
              <ScrollArea className="h-full">
                <div className="space-y-1">
                   <div className="text-xs font-semibold text-muted-foreground mb-2">Internal State Variables</div>
                   {internalState.map(([key, value]) => (
                    <div key={key} className="py-2 border-b last:border-0">
                      <div className="text-[10px] font-mono text-muted-foreground mb-1">{key}</div>
                      <div className="text-xs font-mono break-all bg-muted/30 p-1 rounded">
                        {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="ai" className="h-full m-0 p-4">
               <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
                  <Brain className="h-8 w-8 text-muted-foreground/30" />
                  <div className="text-xs text-muted-foreground">AI Reasoning Trace will appear when fallback is triggered.</div>
                  <Badge variant="secondary" className="text-[10px]">Ready</Badge>
               </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
