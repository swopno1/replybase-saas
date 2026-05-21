const fs = require('fs');

const content = fs.readFileSync('lib/flow-templates.ts', 'utf8');

// Match `export const NAME_TEMPLATE = { ... nodes: [ ... ] };`
const templateRegex = /export const ([A-Z_]+):\s*FlowTemplateDefinition[^\[]+\[([\s\S]*?)\];/g;
let match;
let totalIssues = 0;

while ((match = templateRegex.exec(content)) !== null) {
  const name = match[1];
  const nodesBlock = match[2];
  
  // parse the nodes block to extract order and nextNodeOrder for each node block
  const nodeBlocks = nodesBlock.split('order:');
  
  const nodes = [];
  // first block is before the first order, skip it
  for (let i = 1; i < nodeBlocks.length; i++) {
    const block = nodeBlocks[i];
    const orderMatch = block.match(/^\s*(\d+)/);
    if (!orderMatch) continue;
    const order = parseInt(orderMatch[1], 10);
    
    let nextNodeOrder = null;
    const nextMatch = nodeBlocks[i-1].match(/nextNodeOrder:\s*(\d+)/);
    // Wait, the nextNodeOrder is actually BEFORE the `order: X` line in each node object!
    // Because the structure is:
    // {
    //   type: "...",
    //   content: { ... nextNodeOrder: X },
    //   order: Y
    // }
    // So nextNodeOrder for node Y is in nodeBlocks[i-1] !
    if (nextMatch) {
      nextNodeOrder = parseInt(nextMatch[1], 10);
    }
    
    nodes.push({ order, nextNodeOrder });
  }
  
  const orders = nodes.map(n => n.order);
  
  for (const node of nodes) {
    if (node.nextNodeOrder !== null) {
      if (!orders.includes(node.nextNodeOrder)) {
        console.log(`[${name}] Node ${node.order} explicit jump to missing node ${node.nextNodeOrder}`);
        totalIssues++;
      }
    } else {
      // Implicit jump
      const isEndFlow = nodeBlocks[nodes.findIndex(n => n.order === node.order)].includes('action: "end_flow"');
      if (!isEndFlow) {
        const next = node.order + 1;
        if (!orders.includes(next)) {
          // Verify if it's really the last node, maybe it's just the end of the array.
          // Wait, if it's the end of the array and not end_flow, it will crash anyway.
          console.log(`[${name}] Node ${node.order} implicitly jumps to missing node ${next}`);
          totalIssues++;
        }
      }
    }
  }
}

console.log(`Total issues: ${totalIssues}`);
