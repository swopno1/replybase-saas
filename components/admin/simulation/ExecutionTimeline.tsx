"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, SkipForward, ArrowDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";

interface ExecutionTraceStep {
  nodeId: string;
  type: string;
  status: "success" | "failure" | "skipped";
  variablesBefore: Record<string, unknown>;
  variablesAfter: Record<string, unknown>;
  responses: any[];
  error?: string;
  durationMs?: number;
}

interface ExecutionTimelineProps {
  trace: ExecutionTraceStep[];
}

export function ExecutionTimeline({ trace }: ExecutionTimelineProps) {
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});

  const toggleNode = (index: number) => {
    setExpandedNodes(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="py-3 border-b">
        <CardTitle className="text-sm font-medium">Execution Timeline</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-4">
        <ScrollArea className="h-full">
          <div className="space-y-4">
            {trace.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                No execution steps captured yet.
              </div>
            )}
            {trace.map((step, i) => (
              <div key={i} className="relative">
                <div className="flex gap-4 items-start">
                  <div className="mt-1">
                    {step.status === "success" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    {step.status === "failure" && <XCircle className="h-5 w-5 text-red-500" />}
                    {step.status === "skipped" && <SkipForward className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div
                      className="flex items-center justify-between cursor-pointer hover:bg-muted/30 p-1 rounded transition-colors"
                      onClick={() => toggleNode(i)}
                    >
                      <span className="text-sm font-semibold capitalize">{step.type} Node</span>
                      <Badge variant="outline" className="text-[10px]">
                        ID: {step.nodeId}
                      </Badge>
                    </div>

                    {expandedNodes[i] && (
                      <div className="text-[10px] bg-black/5 text-slate-600 font-mono p-2 rounded border overflow-x-auto whitespace-pre">
                        {JSON.stringify({
                          variablesBefore: step.variablesBefore,
                          variablesAfter: step.variablesAfter,
                          responses: step.responses
                        }, null, 2)}
                      </div>
                    )}

                    {step.responses && step.responses.length > 0 && !expandedNodes[i] && (
                      <div className="text-xs bg-muted/50 rounded p-2 border">
                        <div className="font-medium mb-1">Bot Response:</div>
                        {step.responses.map((r, ri) => (
                          <div key={ri}>{r.text}</div>
                        ))}
                      </div>
                    )}
                    {step.error && (
                      <div className="text-xs text-red-500 font-mono bg-red-50 p-2 rounded border border-red-100">
                        {step.error}
                      </div>
                    )}
                  </div>
                </div>
                {i < trace.length - 1 && (
                  <div className="flex justify-center my-2">
                    <ArrowDown className="h-4 w-4 text-muted-foreground/30" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
