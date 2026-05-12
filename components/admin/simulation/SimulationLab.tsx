"use client";

import { useState } from "react";
import { ChatInterface } from "./ChatInterface";
import { ExecutionTimeline } from "./ExecutionTimeline";
import { InspectorPanel } from "./InspectorPanel";
import { exportSimulationReport } from "@/lib/simulation-export";
import { SIMULATION_SCENARIOS, SimulationScenario } from "@/lib/simulation-scenarios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface SimulationLabProps {
  subscriberId: string;
}

export function SimulationLab({ subscriberId }: SimulationLabProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [trace, setTrace] = useState<any[]>([]);
  const [variables, setVariables] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);

  const handleSendMessage = async (text: string) => {
    setLoading(true);
    setMessages(prev => [...prev, { role: "user", text, timestamp: new Date() }]);

    try {
      const response = await fetch(`/api/admin/subscribers/${subscriberId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          variables: variables,
          contactId: "sim-user-" + subscriberId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (result.responses) {
          result.responses.forEach((resp: any) => {
            if (resp.text) {
              setMessages(prev => [...prev, { role: "bot", text: resp.text, timestamp: new Date() }]);
            }
          });
        }

        if (result.executionTrace) {
          setTrace(prev => [...prev, ...result.executionTrace]);
        }

        // Merge variables
        setVariables(prev => ({ ...prev, ...(result.variables || {}) }));
      } else {
        toast.error(result.error || "Simulation failed");
      }
    } catch (error) {
      toast.error("Failed to connect to simulation engine");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setMessages([]);
    setTrace([]);
    setVariables({});
    setSelectedScenarioId(null);
    toast.success("Simulation session reset");
  };

  const handleScenarioSelect = (scenarioId: string) => {
    const scenario = SIMULATION_SCENARIOS.find(s => s.id === scenarioId);
    if (!scenario) return;

    handleReset();
    setSelectedScenarioId(scenarioId);
    setVariables(scenario.initialVariables);
    toast.info(`Loaded scenario: ${scenario.name}`);
  };

  const handleExport = (format: "json" | "markdown") => {
    const reportData = {
      messages,
      trace,
      variables,
      scenario: selectedScenarioId,
      subscriberId,
      timestamp: new Date().toISOString()
    };

    const content = exportSimulationReport(reportData, format);
    const mimeType = format === "json" ? "application/json" : "text/markdown";
    const extension = format === "json" ? "json" : "md";

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulation-report-${subscriberId}.${extension}`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Simulation Lab</CardTitle>
              <CardDescription>Test subscriber flows in a safe sandbox environment</CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="scenario" className="text-[10px] uppercase font-bold text-muted-foreground">Active Scenario</Label>
                <Select value={selectedScenarioId || ""} onValueChange={handleScenarioSelect}>
                  <SelectTrigger id="scenario" className="w-[240px] h-9">
                    <SelectValue placeholder="Select a test scenario..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SIMULATION_SCENARIOS.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ChatInterface
            messages={messages}
            loading={loading}
            onSendMessage={handleSendMessage}
            onReset={handleReset}
          />
        </div>
        <div className="lg:col-span-1">
          <ExecutionTimeline trace={trace} />
        </div>
        <div className="lg:col-span-1">
          <InspectorPanel variables={variables} onExport={handleExport} />
        </div>
      </div>
    </div>
  );
}
