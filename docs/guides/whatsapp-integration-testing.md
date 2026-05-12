# WhatsApp Integration Testing Guide (Twilio & 360dialog)

This guide provides detailed instructions for testing WhatsApp integration in ReplyBase using Twilio and 360dialog providers.

## 1. Technical Requirements & Permissions

### A. Twilio (Sandbox & Production)
As a tech provider, you need the following from the Twilio Console:

- **Account SID**: Unique identifier for your Twilio account.
- **Auth Token**: Primary credential for API access.
- **WhatsApp Sender Number**:
  - **Sandbox**: Use the shared Twilio Sandbox number (e.g., `+14155238886`).
  - **Production**: A Meta-approved phone number configured as a Twilio WhatsApp Sender.
- **Webhook Permissions**: Ability to configure "A MESSAGE COMES IN" and "STATUS CALLBACK URL" in the Twilio Console.

### B. 360dialog (Partner/Developer)
As a tech provider, you need:

- **API Key**: Generated from the 360dialog Hub (Client/Channel specific).
- **Channel ID**: The unique ID assigned to the WhatsApp channel.
- **Webhook URL Registration**: Ability to set the webhook URL via the 360dialog API or Partner Hub.
- **Meta-Compatible Webhooks**: 360dialog v2 APIs provide webhooks in the Meta Cloud API format, which ReplyBase supports.

---

## 2. Requirements as a Tenant (User)

To test the integration as a tenant, you will need:
- An active **ReplyBase Account**.
- A created **Bot** in ReplyBase.
- A **WhatsApp Number** (for testing as a customer).
- For Twilio Sandbox: The customer must send a join code (e.g., `join [code]`) to the Twilio Sandbox number first to authorize the session.

---

## 3. Possible Costs for Testing

| Provider | Setup Cost | Message Cost | Notes |
| :--- | :--- | :--- | :--- |
| **Twilio Sandbox** | $0 | $0 | Free for testing with shared numbers. |
| **Twilio Production** | $0 - $1/mo per number | ~$0.005/msg + Meta fees | Requires Meta Business verification. |
| **360dialog** | ~$/mo subscription | Meta fees | Usually requires a monthly fee per channel. Check latest pricing. |
| **Meta Fees** | $0 (first 1k/mo) | Variable | Meta provides 1,000 free service conversations per month. |

---

## 4. Pre-requirements

1. **Public URL (Ngrok)**: If testing locally, use `ngrok` to expose your local server.
   ```bash
   ngrok http 3000
   ```
2. **Environment Variables**:
   Ensure `WHATSAPP_WEBHOOK_VERIFY_TOKEN` and `NEXT_PUBLIC_APP_URL` are set in your `.env` file.

---

## 5. Step-by-Step Testing Process

### Step 1: Create and Configure Bot
1. Log in to ReplyBase.
2. Create a new Bot (or select an existing one).
3. Navigate to **Integrations** > **WhatsApp**.

### Step 2: Configure Provider

#### For Twilio Sandbox:
1. Select **Twilio** as the provider.
2. Enter your **Account SID** and **Auth Token**.
3. Enter the Twilio Sandbox number as the **Twilio WhatsApp Sender** (e.g., `+14155238886`).
4. Click **Connect WhatsApp**.
5. **Set Webhook**: In Twilio Console (WhatsApp Sandbox Settings), set the "When a message comes in" URL to:
   `[YOUR_PUBLIC_URL]/api/whatsapp/webhook`

#### For 360dialog:
1. Select **360dialog** as the provider.
2. Enter your **360dialog API Key**.
3. Enter your **Channel ID**.
4. Click **Connect WhatsApp**.
5. **Set Webhook**: Use the 360dialog Hub or API to set the webhook URL to:
   `[YOUR_PUBLIC_URL]/api/whatsapp/webhook`

### Step 3: Assign a Flow
1. In the WhatsApp integration page, select an **Assigned Flow**.
2. Click **Assign Flow**.

### Step 4: Perform Inbound Test
1. As a customer (using your personal WhatsApp), send a message to the configured sender number.
   - *Note for Twilio Sandbox*: Send the join code first.
2. Verify in ReplyBase:
   - Go to **Conversations** > **Inbox**.
   - Your message should appear.
   - The bot should automatically respond if a flow is assigned.

### Step 5: Verify Diagnostics
1. Go back to **Integrations** > **WhatsApp**.
2. Check the **Status** card.
3. Verify `Last inbound message` and `Last delivery status event` timestamps have updated.
4. Review the **Activity Log** for any errors.

---

## 6. Launch Strategy (Without Meta Cloud API)

Until Meta approval is complete:
- **Use Twilio Sandbox** for internal development and QA.
- **Use 360dialog/Twilio Production** for early access tenants who already have verified Meta Business accounts.
- Avoid the **Meta Cloud API** option in the UI, as it requires a verified App and reviewed permissions (`whatsapp_business_messaging`).
