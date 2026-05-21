import { getAvailableTemplates } from "../lib/flow-templates";

function audit() {
  const templates = getAvailableTemplates();
  let issues = 0;

  for (const template of templates) {
    const nodes = template.nodes;
    const orders = nodes.map(n => n.order);
    const maxOrder = Math.max(...orders);
    
    // Check missing orders
    for (const node of nodes) {
      const nextNodeOrder = node.content.nextNodeOrder as number | undefined;
      
      // If it has conditions, check them
      if (node.type === "condition" && node.content.conditions) {
        const conditions = node.content.conditions as any[];
        for (const c of conditions) {
          if (c.nextNodeOrder !== undefined && !orders.includes(c.nextNodeOrder)) {
            console.log(`[${template.name}] Condition points to missing node ${c.nextNodeOrder}`);
            issues++;
          }
        }
      }
      
      if (nextNodeOrder !== undefined) {
        if (!orders.includes(nextNodeOrder)) {
          console.log(`[${template.name}] Node ${node.order} points to missing nextNodeOrder ${nextNodeOrder}`);
          issues++;
        }
      } else {
        // No explicit nextNodeOrder, defaults to order + 1
        if (node.type !== "action" || (node.content as any).action !== "end_flow") {
          const next = node.order + 1;
          if (!orders.includes(next)) {
            console.log(`[${template.name}] Node ${node.order} implicitly points to missing node ${next} (no end_flow)`);
            issues++;
          }
        }
      }
    }
  }

  if (issues === 0) {
    console.log("All templates perfectly indexed and terminating!");
  } else {
    console.log(`Found ${issues} issues.`);
  }
}

audit();
