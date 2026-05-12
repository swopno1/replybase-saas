import { evaluateCondition } from "../lib/flow-runtime-utils";

const val = "INTENT_PRICING";
const op = "contains";
const compare = "intent_pricing";

console.log(`Testing: "${val}" ${op} "${compare}"`);
console.log(`Result: ${evaluateCondition(val, op, compare)}`);

const val2 = "INTENT_PRICING";
const op2 = "equals";
const compare2 = "INTENT_PRICING";
console.log(`Testing: "${val2}" ${op2} "${compare2}"`);
console.log(`Result: ${evaluateCondition(val2, op2, compare2)}`);
