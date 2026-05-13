import { prisma } from "@/lib/prisma";
import { decryptTelegramToken } from "@/lib/telegram-crypto";
import { sendTelegramTextMessage } from "@/lib/telegram-api";

export type NewLeadNotificationInput = {
  tenantId: string;
  leadId: string;
  name: string;
  enquiry: string;
  email?: string;
  phone?: string;
  source: string;
  createdAt: Date;
};

type DeliveryResult = {
  channel: "telegram" | "email";
  attempted: boolean;
  delivered: number;
  failed: number;
  errors: string[];
};

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

const REPLYBASE_SITE_URL = "https://replybase.co.uk";
const REPLYBASE_LOGO_URL = `${REPLYBASE_SITE_URL}/image/replybase-logo.jpg`;

function escapeHtml(value: string) {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMessageHtml(value: string) {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

function buildLeadSummaryMessage(input: NewLeadNotificationInput): string {
  const lines = [
    `New Lead - ${input.name}`,
    `Enquiry: ${input.enquiry}`,
    `Contact: ${input.email || "-"}${input.phone ? ` | ${input.phone}` : ""}`,
    `Source: ${input.source}`,
    `Lead ID: ${input.leadId}`,
    `Time: ${input.createdAt.toISOString()}`,
  ];

  return lines.join("\n");
}

function buildLeadSummaryHtml(input: NewLeadNotificationInput): string {
  return `
    <div style="margin:0; padding:32px 16px; background:linear-gradient(180deg, #f4efe7 0%, #ffffff 100%); font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #eadfce; border-radius:24px; overflow:hidden; box-shadow:0 18px 45px rgba(15, 23, 42, 0.08);">
        <div style="padding:28px 32px; background:linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%); color:#ffffff;">
          <img src="${REPLYBASE_LOGO_URL}" alt="ReplyBase" width="160" style="display:block; max-width:160px; height:auto; margin:0 0 20px;" />
          <div style="font-size:12px; letter-spacing:0.12em; text-transform:uppercase; opacity:0.76; margin-bottom:10px;">New Lead Captured</div>
          <h1 style="margin:0; font-size:28px; line-height:1.25; font-weight:700;">A new lead just engaged with your chatbot.</h1>
          <p style="margin:14px 0 0; font-size:15px; line-height:1.7; color:rgba(255,255,255,0.88);">Great news! We've captured a new inquiry from ${escapeHtml(input.name)}. Details are below.</p>
        </div>

        <div style="padding:32px;">
          <div style="border:1px solid #e5e7eb; border-radius:20px; background:#f8fafc; padding:22px 24px;">
            <div style="margin:0 0 14px; font-size:13px; letter-spacing:0.08em; text-transform:uppercase; color:#64748b;">Lead Summary</div>
            <table role="presentation" width="100%" style="border-collapse:collapse; font-size:14px; line-height:1.65;">
              <tr>
                <td style="padding:0 0 10px; width:120px; color:#64748b; vertical-align:top;">Name</td>
                <td style="padding:0 0 10px; color:#0f172a; font-weight:600; vertical-align:top;">${escapeHtml(input.name)}</td>
              </tr>
              <tr>
                <td style="padding:0 0 10px; width:120px; color:#64748b; vertical-align:top;">Email</td>
                <td style="padding:0 0 10px; color:#0f172a; font-weight:600; vertical-align:top;">${escapeHtml(input.email || "-")}</td>
              </tr>
              <tr>
                <td style="padding:0 0 10px; width:120px; color:#64748b; vertical-align:top;">Phone</td>
                <td style="padding:0 0 10px; color:#0f172a; font-weight:600; vertical-align:top;">${escapeHtml(input.phone || "-")}</td>
              </tr>
              <tr>
                <td style="padding:0 0 10px; width:120px; color:#64748b; vertical-align:top;">Source</td>
                <td style="padding:0 0 10px; color:#0f172a; font-weight:600; vertical-align:top;">${escapeHtml(input.source)}</td>
              </tr>
              <tr>
                <td style="padding:0; width:120px; color:#64748b; vertical-align:top;">Enquiry</td>
                <td style="padding:0; color:#0f172a; font-weight:600; vertical-align:top;">${formatMessageHtml(input.enquiry)}</td>
              </tr>
            </table>
          </div>

          <p style="margin:24px 0 0; font-size:15px; line-height:1.75;">You can view and manage all your leads directly in the <a href="https://app.replybase.co.uk/" style="color:#2563eb; text-decoration:none; font-weight:600;">ReplyBase Dashboard</a>.</p>
        </div>

        <div style="padding:24px 32px 32px; border-top:1px solid #e5e7eb; background:#fcfcfd;">
          <p style="margin:0 0 6px; font-size:15px; font-weight:700; color:#0f172a;">The ReplyBase Team</p>
          <p style="margin:0 0 6px; font-size:14px; color:#475569;">AI-powered conversations for teams that do not want to miss a lead.</p>
        </div>
      </div>
    </div>
  `;
}

async function sendTelegramLeadNotification(
  input: NewLeadNotificationInput,
  chatIds: string[],
): Promise<DeliveryResult> {
  if (chatIds.length === 0) {
    return {
      channel: "telegram",
      attempted: false,
      delivered: 0,
      failed: 0,
      errors: [],
    };
  }

  const telegramChannel = await prisma.channel.findFirst({
    where: {
      type: "telegram",
      isActive: true,
      enabled: true,
      accessToken: { not: null },
      bot: {
        tenantId: input.tenantId,
      },
    },
    select: {
      id: true,
      accessToken: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (!telegramChannel?.accessToken) {
    return {
      channel: "telegram",
      attempted: true,
      delivered: 0,
      failed: chatIds.length,
      errors: ["No active Telegram channel token found for tenant"],
    };
  }

  const token = decryptTelegramToken(telegramChannel.accessToken);
  const message = buildLeadSummaryMessage(input);

  let delivered = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const chatId of chatIds) {
    const result = await sendTelegramTextMessage(token, chatId, message);
    if (result.success) {
      delivered += 1;
      continue;
    }

    failed += 1;
    errors.push(
      `chat ${chatId}: ${result.error || "Unknown Telegram delivery error"}`,
    );
  }

  return {
    channel: "telegram",
    attempted: true,
    delivered,
    failed,
    errors,
  };
}

import { sendEmail } from "./email";

async function sendEmailLeadNotification(
  input: NewLeadNotificationInput,
  recipients: string[],
): Promise<DeliveryResult> {
  if (recipients.length === 0) {
    return {
      channel: "email",
      attempted: false,
      delivered: 0,
      failed: 0,
      errors: [],
    };
  }

  const subject = `New Lead - ${input.name}`;
  const text = buildLeadSummaryMessage(input);
  const html = buildLeadSummaryHtml(input);

  const result = await sendEmail({
    to: recipients,
    subject,
    text,
    html,
  });

  if (!result.ok) {
    return {
      channel: "email",
      attempted: true,
      delivered: 0,
      failed: recipients.length,
      errors: [result.error || "Unknown email delivery error"],
    };
  }

  return {
    channel: "email",
    attempted: true,
    delivered: recipients.length,
    failed: 0,
    errors: [],
  };
}

export async function sendNewLeadNotifications(
  input: NewLeadNotificationInput,
) {
  const settings = await prisma.tenantLeadNotificationSettings.findUnique({
    where: {
      tenantId: input.tenantId,
    },
    select: {
      emailRecipients: true,
      telegramChatIds: true,
    },
  });

  const emailRecipients = asStringList(settings?.emailRecipients);
  const telegramChatIds = asStringList(settings?.telegramChatIds);

  const [telegram, email] = await Promise.allSettled([
    sendTelegramLeadNotification(input, telegramChatIds),
    sendEmailLeadNotification(input, emailRecipients),
  ]);

  const telegramResult: DeliveryResult =
    telegram.status === "fulfilled"
      ? telegram.value
      : {
        channel: "telegram",
        attempted: true,
        delivered: 0,
        failed: 1,
        errors: [
          telegram.reason instanceof Error
            ? telegram.reason.message
            : "Unknown Telegram notification error",
        ],
      };

  const emailResult: DeliveryResult =
    email.status === "fulfilled"
      ? email.value
      : {
        channel: "email",
        attempted: true,
        delivered: 0,
        failed: 1,
        errors: [
          email.reason instanceof Error
            ? email.reason.message
            : "Unknown email notification error",
        ],
      };

  return {
    telegram: telegramResult,
    email: emailResult,
  };
}

export async function sendTenantLeadNotificationTest(tenantId: string) {
  return sendNewLeadNotifications({
    tenantId,
    leadId: `test-${Date.now()}`,
    name: "ReplyBase Test Lead",
    enquiry:
      "This is a test alert from your Notification Settings. Real website leads will include the visitor's message.",
    source: "settings-test",
    createdAt: new Date(),
  });
}
