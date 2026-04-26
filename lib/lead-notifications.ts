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

  const result = await sendEmail({
    to: recipients,
    subject,
    text,
    from: process.env.LEAD_NOTIFICATION_EMAIL_FROM || "ReplyBase <noreply@replybase.co.uk>",
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
