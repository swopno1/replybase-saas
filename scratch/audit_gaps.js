const fs = require('fs');
const content = fs.readFileSync('lib/flow-templates.ts', 'utf8');

// The regex will match each template block
const templateRegex = /export const ([A-Z_]+):\s*FlowTemplateDefinition[^\[]+\[([\s\S]*?)\];/g;
let match;
const gaps = [];

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
  
  const sortedOrders = [...new Set(orders)].sort((a,b)=>a-b);
  for (let i = 0; i < sortedOrders.length - 1; i++) {
    if (sortedOrders[i+1] !== sortedOrders[i] + 1) {
      gaps.push(`${name}: Gap between ${sortedOrders[i]} and ${sortedOrders[i+1]}`);
    }
  }
}

console.log(gaps.join('\n'));
