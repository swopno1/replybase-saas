/**
 * Trial reminder email sender.
 *
 * Reuses the same Resend transport as lead-notifications.ts.
 * Called by the cron route at 10, 5, and 2 days before trial end.
 */

export type TrialReminderEmailInput = {
  to: string;
  userName: string;
  daysRemaining: number;
  recommendedPlan: string;
  appUrl: string;
};

function buildSubject(daysRemaining: number): string {
  if (daysRemaining <= 2) {
    return `⚠️ Your ReplyBase trial ends in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} — add billing to keep going`;
  }
  if (daysRemaining <= 5) {
    return `Your ReplyBase trial ends in ${daysRemaining} days — choose a plan`;
  }
  return `Your ReplyBase trial has 10 days left — plan your upgrade`;
}

function buildBody(input: TrialReminderEmailInput): string {
  const { userName, daysRemaining, recommendedPlan, appUrl } = input;
  const planLabel =
    recommendedPlan.charAt(0).toUpperCase() + recommendedPlan.slice(1);
  const pricingUrl = `${appUrl}/pricing?plan=${recommendedPlan}&source=trial_reminder_email_${daysRemaining}d`;
  const billingUrl = `${appUrl}/settings?tab=billing`;

  const urgencyLine =
    daysRemaining <= 2
      ? "This is your last chance to add billing before automations pause."
      : daysRemaining <= 5
        ? "Please add billing details to keep your automations running without interruption."
        : "You still have time, but it's worth picking a plan now so your automations stay live.";

  return [
    `Hi ${userName},`,
    ``,
    `Your ReplyBase trial ends in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}.`,
    ``,
    urgencyLine,
    ``,
    `Recommended plan: ${planLabel}`,
    `Choose now: ${pricingUrl}`,
    ``,
    `Or manage billing directly: ${billingUrl}`,
    ``,
    `If you have questions about which plan is right for you, reply to this email`,
    `or contact us at support@replybase.co.uk`,
    ``,
    `— The ReplyBase Team`,
  ].join("\n");
}

type SendResult = { ok: boolean; error?: string };

export async function sendTrialReminderEmail(
  input: TrialReminderEmailInput,
): Promise<SendResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.TRIAL_REMINDER_EMAIL_FROM ||
    process.env.LEAD_NOTIFICATION_EMAIL_FROM ||
    "ReplyBase <noreply@replybase.co.uk>";

  if (!resendApiKey) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const subject = buildSubject(input.daysRemaining);
  const text = buildBody(input);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject,
        text,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        ok: false,
        error: `Resend ${response.status}: ${errorBody || "Unknown error"}`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown send error",
    };
  }
}
