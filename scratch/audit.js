const fs = require('fs');

const content = fs.readFileSync('lib/flow-templates.ts', 'utf8');

// Match `export const NAME_TEMPLATE = { ... nodes: [ ... ] };`
const templateRegex = /export const ([A-Z_]+):\s*FlowTemplateDefinition[^\[]+\[([\s\S]*?)\];/g;

let match;
let totalIssues = 0;

while ((match = templateRegex.exec(content)) !== null) {
  const name = match[1];
  const nodesBlock = match[2];
  
  // Find all orders: `order: 5,`
  const orderRegex = /order:\s*(\d+)/g;
  const orders = [];
  let orderMatch;
  while ((orderMatch = orderRegex.exec(nodesBlock)) !== null) {
    orders.push(parseInt(orderMatch[1], 10));
  }
  
  // Find all nextNodeOrders: `nextNodeOrder: 10,`
  const nextNodeRegex = /nextNodeOrder:\s*(\d+)/g;
  const nextNodes = [];
  let nextNodeMatch;
  while ((nextNodeMatch = nextNodeRegex.exec(nodesBlock)) !== null) {
    nextNodes.push(parseInt(nextNodeMatch[1], 10));
  }
  
  // Check if any nextNodeOrder points to a non-existent order
  for (const nn of nextNodes) {
    if (!orders.includes(nn)) {
      console.log(`[${name}] Missing explicit nextNodeOrder: ${nn}`);
      totalIssues++;
    }
  }
  
  // Check implicit nextNodeOrders (if a node doesn't have nextNodeOrder, does it have an order+1?)
  // This is a bit harder with regex since we don't know if a block had nextNodeOrder or was end_flow.
  // But we can check if there are GAPS in `orders`.
  // If there's a gap (e.g. 8, 9, 11), then node 9 implicitly points to 10, which is missing!
  // Unless node 9 has an explicit nextNodeOrder or is end_flow.
  const sortedOrders = [...orders].sort((a,b)=>a-b);
  for (let i = 0; i < sortedOrders.length - 1; i++) {
    if (sortedOrders[i+1] !== sortedOrders[i] + 1) {
      // There is a gap. e.g. 9 then 11.
      // We must check if the node at sortedOrders[i] has an explicit nextNodeOrder or end_flow.
      const nodeOrder = sortedOrders[i];
      // Regex to find the node block for this order
      const nodeBlockRegex = new RegExp(`{[^{}]*order:\\s*${nodeOrder}\\s*,?[^{}]*}|{[^{}]*{[^{}]*}[^{}]*order:\\s*${nodeOrder}\\s*,?[^{}]*}|{[\\s\\S]*?order:\\s*${nodeOrder}\\b`, 'g');
      // Actually simpler: just log the gaps, and I'll manually verify.
      console.log(`[${name}] Gap found after node ${nodeOrder} (next is ${sortedOrders[i+1]})`);
    }
  }
}

console.log(`Total issues: ${totalIssues}`);
