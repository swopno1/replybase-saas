# Flow Builder Documentation

The ReplyBase Flow Builder is a powerful visual automation tool that allows you to design conversational experiences across multiple channels (Facebook, WhatsApp, Webchat). This document details every available option, how they work independently, and how they interact to create complex automation.

---

## 🏗️ Core Concepts

### Nodes
A "Node" is a single step in a flow. Nodes are executed sequentially based on their `order` property, unless a logic node (like a Condition) redirects the path.

### Variables
Flows use a persistent state to store information collected from users.
- **Interpolation Syntax:** Use `{{variable_name}}` in text fields to insert stored values.
- **Auto-Sanitization:** Variables like `contact_name`, `lead_name`, or `name` automatically strip greetings (e.g., "Hi, I'm...") to store clean names.

### Sessions
Every user interaction with a flow creates a `FlowSession`. The session tracks:
- `currentNodeId`: Where the user currently is in the flow.
- `variables`: A JSON object of all collected data.
- `isActive`: Whether the flow is still running or completed.

---

## 🧩 Node Types

### 1. Message Node
The most basic node. Sends a message to the user.
- **Options:**
    - `text`: The message body (supports variables).
    - `quick_replies`: Interactive buttons that the user can tap to reply quickly.
    - `buttons`: URL or Postback buttons (specific to Facebook/WhatsApp).
- **Behavior:** Executes the message and moves immediately to the next node unless `quick_replies` are present, which pauses for user selection.

### 2. Input Node
Used to collect and store information from the user.
- **Options:**
    - `variableName`: The key where the response will be stored (e.g., `contact_email`).
    - `inputType`: Validates the format (`text`, `email`, `phone`, `number`).
    - `validationMessage`: Custom message sent if the user provides an invalid format.
- **Behavior:** Pauses execution and waits for user input. Once valid input is received, it saves the value to the session and moves to the next node.

### 3. Condition Node
Logic-based routing.
- **Options:**
    - `conditions`: A list of rules to evaluate.
    - `operator`: `equals`, `contains`, `greater_than`, `less_than`.
    - `nextNodeOrder`: The specific node to jump to if the condition is met.
- **Behavior:** Checks each rule in order. The first rule that returns `true` determines the next node. If no rules match, it moves to the default next node.

### 4. Action Node
Triggers system-level tasks or integrations.
- **Options:**
    - `tag_user`: Adds tags to the Lead profile.
    - `update_status`: Changes Lead status (e.g., `lead` to `contacted`).
    - `call_flow`: Sub-flow execution. Jumps to another flow and returns when done.
    - `booking`: Log a demo request and tag the lead.
    - `checkout`: Generates a personalized Stripe checkout link using stored variables.
    - `trigger_webhook`: Sends a POST request to your configured webhook URL with all session variables.
    - `end_flow`: Forcefully terminates the session.
- **Behavior:** Executes the task silently and moves to the next node.

### 5. Wait / Typing Nodes
Adds a human touch and timing control.
- **Options:**
    - `waitMs`: Pause execution for a specific duration (max 5000ms).
    - `typingDurationMs`: Displays a "typing..." indicator to the user.
- **Behavior:** Delays the next message to avoid overwhelming the user.

---

## 🛠️ Actions In-Depth

### Call Flow (Sub-flows)
When an action uses `call_flow`, the current flow state is saved to a "Call Stack".
1. The engine switches to the `targetFlowId`.
2. When the target flow reaches an `End` node, the engine checks the stack.
3. If a parent flow exists, it resumes exactly where it left off.

### Dynamic Checkout
The `checkout` action automatically detects if a tenant has used their trial and generates the appropriate Stripe URL:
- It appends `client_reference_id` (Tenant ID) for tracking.
- It appends `customer_email` if a variable named `contact_email` has been collected.

---

## 📝 Scenario Examples

### Scenario A: Lead Qualification & Tagging
1. **Message:** "Welcome! Are you looking for Personal or Business services?" (Quick Replies: Personal, Business)
2. **Input:** `variableName: user_intent`
3. **Condition:**
   - If `user_intent` equals "Business" -> Jump to Node 5.
4. **Message:** "Great! Let's get you started with a personal account." -> **Action:** `tag_user: ["personal-lead"]`
5. **Message:** "Business it is! What is your company name?" -> **Input:** `variableName: business_name` -> **Action:** `tag_user: ["business-lead"]`

### Scenario B: Automated Demo Booking
1. **Input:** `variableName: contact_email`, `inputType: email`.
2. **Action:** `booking`.
   - *Result:* The system creates an `ActivityLog`, tags the lead as `booking-requested`, and notifies the admin.
3. **Message:** "Thanks {{contact_name}}! We've received your request for {{business_name}} and will email you at {{contact_email}}."

### Scenario C: Complex Router Flow
A "Global Router" flow can use the `call_flow` action to delegate tasks:
- If user says "Support" -> `call_flow: "Support Engine"`.
- If user says "Sales" -> `call_flow: "Sales Funnel"`.
- This keeps individual flows small, manageable, and reusable.

---

## ⚠️ Best Practices
- **Fallback Messages:** Always configure a `fallbackMessage` in flow settings for when AI or Flow Logic doesn't understand an input.
- **Circular Loops:** Ensure conditions don't point back to previous nodes in a way that creates an infinite loop.
- **Variable Naming:** Use consistent naming (e.g., `contact_` prefix) to make data mapping easier across different flows.
