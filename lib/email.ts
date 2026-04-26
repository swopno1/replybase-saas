/**
 * Shared email utility using Resend API.
 */

type SendEmailParams = {
  to: string | string[];
  subject: string;
  text: string;
  from?: string;
};

export async function sendEmail({ to, subject, text, from }: SendEmailParams) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const defaultFrom = process.env.TRIAL_REMINDER_EMAIL_FROM || 
                      process.env.LEAD_NOTIFICATION_EMAIL_FROM || 
                      "ReplyBase <noreply@replybase.co.uk>";

  if (!resendApiKey) {
    console.warn("RESEND_API_KEY is not set. Email not sent:", { to, subject });
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from || defaultFrom,
        to: Array.isArray(to) ? to : [to],
        subject,
        text,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Resend API error:", response.status, errorBody);
      return { ok: false, error: `Resend error ${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    console.error("Failed to send email via Resend:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Specifically for password resets.
 */
export async function sendResetEmail(email: string, token: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/reset-password?token=${token}`;
  
  const subject = "Reset your ReplyBase password";
  const text = `
Hi there,

We received a request to reset your password for your ReplyBase account.
Click the link below to set a new password:

${resetUrl}

If you didn't request this, you can safely ignore this email.

— The ReplyBase Team
  `.trim();

  return sendEmail({ to: email, subject, text });
}
