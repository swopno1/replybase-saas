import { APP_CONFIG } from "./config";

/**
 * Shared email utility using Resend API.
 */

type SendEmailParams = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
};

export async function sendEmail({ to, subject, text, html, from }: SendEmailParams) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const defaultFrom = APP_CONFIG.email.from;

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
        ...(html ? { html } : {}),
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
 * Sent after Stripe payment for claim-flow users who have no password yet.
 * Also serves as email verification (clicking the link proves ownership).
 */
export async function sendAccountActivationEmail(email: string, token: string) {
  const activateUrl = `${APP_CONFIG.meta.baseUrl}/auth/activate?token=${token}`;

  const subject = "Activate your ReplyBase account";
  const text = `
Hi there,

Your ReplyBase subscription is confirmed! One last step — set a password to access your dashboard.

Activate your account here:
${activateUrl}

This link expires in 24 hours. If you didn't sign up for ReplyBase, you can safely ignore this email.

— The ReplyBase Team
  `.trim();

  return sendEmail({ to: email, subject, text });
}

/**
 * Sent after credential registration to verify email ownership.
 */
export async function sendEmailVerificationEmail(email: string, token: string) {
  const verifyUrl = `${APP_CONFIG.meta.baseUrl}/api/auth/verify-email?token=${token}`;

  const subject = "Verify your ReplyBase email address";
  const text = `
Hi there,

Thanks for signing up for ReplyBase! Please verify your email address to activate your account.

Verify your email here:
${verifyUrl}

This link expires in 24 hours. If you didn't create a ReplyBase account, you can safely ignore this email.

— The ReplyBase Team
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1e293b;">
  <h2 style="margin-bottom: 8px;">Verify your email address</h2>
  <p style="color: #475569; margin-bottom: 24px;">Thanks for signing up for ReplyBase. Click the button below to verify your email and activate your account.</p>
  <a href="${verifyUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">Verify my email</a>
  <p style="margin-top: 24px; color: #64748b; font-size: 14px;">Or copy and paste this link into your browser:<br/><span style="color: #2563eb;">${verifyUrl}</span></p>
  <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">This link expires in 24 hours. If you didn't create a ReplyBase account, you can safely ignore this email.</p>
</body>
</html>
  `.trim();

  return sendEmail({ to: email, subject, text, html });
}

/**
 * Specifically for password resets.
 */
export async function sendResetEmail(email: string, token: string) {
  const resetUrl = `${APP_CONFIG.meta.baseUrl}/auth/reset-password?token=${token}`;
  
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
