export function exportSimulationReport(data: any, format: "json" | "markdown") {
  if (format === "json") {
    return JSON.stringify(data, null, 2);
  }

  const { messages, trace, variables, scenario, subscriberId, timestamp } = data;

  let md = `# Simulation Lab Report\n\n`;
  md += `**Subscriber ID:** ${subscriberId}\n`;
  md += `**Scenario:** ${scenario || "Manual"}\n`;
  md += `**Date:** ${new Date(timestamp).toLocaleString()}\n\n`;

  md += `## Conversation Transcript\n\n`;
  messages.forEach((m: any) => {
    md += `**${m.role.toUpperCase()}:** ${m.text}\n\n`;
  });

  md += `## Extracted Lead Data (CRM)\n\n`;
  const leadData = Object.entries(variables).filter(([k]) => !k.startsWith("__"));
  if (leadData.length > 0) {
    md += `| Variable | Value |\n| :--- | :--- |\n`;
    leadData.forEach(([k, v]) => {
      md += `| ${k} | ${v} |\n`;
    });
  } else {
    md += `*No data extracted.*\n`;
  }
  md += `\n`;

  md += `## Execution Trace\n\n`;
  trace.forEach((step: any, i: number) => {
    md += `### Step ${i + 1}: ${step.type.toUpperCase()} Node\n`;
    md += `- **ID:** ${step.nodeId}\n`;
    md += `- **Status:** ${step.status}\n`;
    if (step.responses && step.responses.length > 0) {
      md += `- **Bot Sent:** ${step.responses.map((r: any) => r.text).join(", ")}\n`;
    }
    md += `\n#### State Change\n\`\`\`json\n${JSON.stringify({
      before: step.variablesBefore,
      after: step.variablesAfter
    }, null, 2)}\n\`\`\`\n\n`;
  });

  return md;
}
