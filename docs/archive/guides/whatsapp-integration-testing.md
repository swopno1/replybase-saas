# WhatsApp Integration Testing Guide (Meta Cloud API, Twilio & 360dialog)

This guide provides detailed instructions for testing WhatsApp integration in ReplyBase using Meta Cloud API (Native), Twilio, and 360dialog providers.

## 1. Technical Requirements & Permissions

### A. Meta Cloud API (Native - Recommended)
To test directly with Meta, you need a Meta for Developers account and a Business App:

- **Access Token**: A temporary or permanent (System User) token.
- **Phone Number ID**: Unique ID for the specific phone number used for sending.
- **WhatsApp Business Account ID (WABA ID)**: The ID of the WhatsApp Business account.
- **Webhook Verify Token**: A string you define in the Meta App settings to verify your webhook endpoint.

### B. Twilio (Sandbox & Production)
As a tech provider, you need the following from the Twilio Console:

- **Account SID**: Unique identifier for your Twilio account.
- **Auth Token**: Primary credential for API access.
- **WhatsApp Sender Number**:
  - **Sandbox**: Use the shared Twilio Sandbox number (e.g., `+14155238886`).
  - **Production**: A Meta-approved phone number configured as a Twilio WhatsApp Sender.

### C. 360dialog (Partner/Developer)
As a tech provider, you need:

- **API Key**: Generated from the 360dialog Hub (Client/Channel specific).
- **Channel ID**: The unique ID assigned to the WhatsApp channel.
- **Webhook URL Registration**: Ability to set the webhook URL via the 360dialog API or Partner Hub.

---

## 2. Requirements as a Tenant (User)

To test the integration as a tenant, you will need:
- An active **ReplyBase Account**.
- A created **Bot** in ReplyBase.
- A **WhatsApp Number** (for testing as a customer).
- For Twilio Sandbox: The customer must send a join code (e.g., `join [code]`) to the Twilio Sandbox number first.

---

## 3. Possible Costs for Testing

| Provider | Setup Cost | Message Cost | Notes |
| :--- | :--- | :--- | :--- |
| **Meta Cloud API** | $0 | $0 (first 1k/mo) | Direct integration, most cost-effective. |
| **Twilio Sandbox** | $0 | $0 | Free for testing with shared numbers. |
| **Twilio Production** | $0 - $1/mo | ~$0.005/msg + Meta fees | Requires Meta Business verification. |
| **360dialog** | ~$/mo sub | Meta fees | Requires a monthly fee per channel. |

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

#### For Meta Cloud API (Native):
1. Select **Meta Cloud API** as the provider.
2. Enter your **Access Token**, **Phone Number ID**, and **WABA ID**.
3. Click **Connect WhatsApp**.
4. **Set Webhook**: In Meta for Developers Dashboard, navigate to **WhatsApp** > **Configuration**.
   - **Callback URL**: `[YOUR_PUBLIC_URL]/api/whatsapp/webhook`
   - **Verify Token**: Must match your `WHATSAPP_WEBHOOK_VERIFY_TOKEN` environment variable.
   - **Webhook Fields**: Subscribe to `messages`.

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
2. Verify in ReplyBase:
   - Go to **Conversations** > **Inbox**.
   - Your message should appear and the bot should respond.

---

## 6. How to Get Meta API Credentials (Detailed Guide)

### Step 1: Create a Meta Developer App
1. Go to [Meta for Developers](https://developers.facebook.com/).
2. Click **My Apps** > **Create App**.
3. Select **Other** > **Next**.
4. Select **Business** as the app type > **Next**.
5. Provide an App Name and Contact Email. Select your **Business Account** if you have one (optional for testing).
6. Click **Create App**.

### Step 2: Set Up WhatsApp
1. In the App Dashboard, scroll down to **WhatsApp** and click **Set Up**.
2. Click **Continue** to accept the terms.
3. You will be taken to the **API Setup** page.

### Step 3: Get the Phone Number and IDs
On the **WhatsApp > API Setup** page, you will find:
- **Temporary Access Token**: Use this for initial testing (valid for 24 hours).
- **Phone Number ID**: A numeric string (e.g., `106555123456789`). Use this in ReplyBase.
- **WhatsApp Business Account ID (WABA ID)**: A numeric string. Use this in ReplyBase.
- **Test Phone Number**: Meta provides a test number (usually starting with `+1 555...`). This is your **Sender Number**.

### Step 4: Add Recipient Numbers (For Test Numbers)
If you are using a Meta Test Number, you can only send/receive messages to "Verified" numbers:
1. On the **API Setup** page, find the **To** field under "Send and receive messages".
2. Add your personal WhatsApp number and follow the verification steps.

### Step 5: Get a Permanent Access Token (Recommended)
Temporary tokens expire. For a production-like test environment:
1. Go to [Meta Business Suite > Settings](https://business.facebook.com/settings/).
2. Navigate to **Users** > **System Users**.
3. Create a new System User (or use an existing one).
4. Click **Add Assets** and assign your Meta App with **Full Control**.
5. Click **Generate New Token**.
6. Select your App and check the following permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
7. Copy and save this token. It will not expire.

---

## 7. Launch Strategy

- **Internal Testing**: Use Meta's **Test Number** and **Temporary Token** for quick validation.
- **Client Onboarding**: Use **Twilio Sandbox** if the client doesn't have a Meta Business account yet.
- **Production**: Use **Meta Cloud API** with a verified Business Account and a **Permanent System User Token** for the best performance and lowest cost.

---

## 8. Meta App Review Guidance (Tech Provider)

If you are applying for a **Tech Provider** status or submitting your app for review to use `whatsapp_business_messaging` in production, follow these guidelines.

### A. Minimum Required Use Case: "Customer Support"
Meta requires a clear demonstration of why you need specific permissions. The most straightforward use case for ReplyBase is **Customer Support**.

- **Use Case Name**: Omnichannel Customer Support & Automated Response.
- **Description**: "ReplyBase allows businesses to centralize customer communications. When a customer sends a message to the business via WhatsApp, our platform receives the message via Webhook, processes it through our AI/Flow engine, and provides an automated response or allows a human agent to reply. This ensures timely and efficient customer service."

### B. Permissions to Request
1.  **`whatsapp_business_messaging`**: (CRITICAL) Required to send and receive messages.
2.  **`whatsapp_business_management`**: (RECOMMENDED) Required to manage WABA settings and eventually support Embedded Signup.

### C. Screencast Requirements (The "Proof")
Meta reviewers MUST see the app in action. Your video should include:
1.  **Dashboard Overview**: Show the ReplyBase login and dashboard.
2.  **Connection Flow**: Navigate to **Integrations > WhatsApp**, show the configuration fields (Access Token, Phone Number ID).
3.  **Inbound Message**: 
    - Split screen or show a phone sending a WhatsApp message to the test/production number.
    - Show the message appearing in the **ReplyBase Inbox**.
4.  **Outbound Response**:
    - Show the ReplyBase bot responding automatically OR an agent typing a reply.
    - Show the message being received on the customer's phone.
5.  **Interactive Elements (Optional but Good)**: Show a button or quick reply being sent and clicked.

### D. App Settings Check
- **App Category**: Business.
- **App Type**: Business.
- **Privacy Policy URL**: Must be a valid link to your privacy policy.
- **Terms of Service URL**: Must be a valid link.
- **Business Verification**: Your Meta Business Manager **MUST** be verified before you can go live.

