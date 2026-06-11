import { sendEmail } from "./email";
import { APP_CONFIG } from "./config";

const appUrl = APP_CONFIG.meta.url;

export const sendDataDeletionEmails = {
  async requested(
    email: string,
    confirmationCode: string,
    cancelToken: string,
    scheduledDeletionAt: Date,
  ) {
    const statusUrl = `${appUrl}/data-deletion-status?code=${confirmationCode}`;
    const cancelUrl = `${appUrl}/api/data-deletion/cancel?token=${cancelToken}`;
    const deletionDate = scheduledDeletionAt.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const subject = "Your data deletion request has been received — ReplyBase";
    const text = `
Hi,

We have received your request to delete all personal data associated with this email address from ReplyBase.

Your data is scheduled for permanent deletion on ${deletionDate} (7-day grace period).

If you submitted this by mistake or have changed your mind, you can cancel the request before that date:

Cancel request: ${cancelUrl}

To check the status of your request at any time:

View status: ${statusUrl}

Confirmation code: ${confirmationCode}

If you have questions, reply to this email or contact us at admin@replybase.co.uk.

— The ReplyBase Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:32px 16px">
  <h2 style="font-size:20px;margin-bottom:8px">Data Deletion Request Received</h2>
  <p style="color:#555;margin-bottom:24px">We have received your request to delete all personal data associated with <strong>${email}</strong> from ReplyBase.</p>
  <div style="background:#fef9c3;border-left:4px solid #eab308;padding:12px 16px;border-radius:4px;margin-bottom:24px">
    <p style="margin:0;font-size:14px">Your data is scheduled for <strong>permanent deletion on ${deletionDate}</strong>.<br>You have 7 days to cancel if this was a mistake.</p>
  </div>
  <a href="${cancelUrl}" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;margin-bottom:16px">Cancel Request</a>
  <p style="font-size:13px;color:#888;margin-top:24px">
    Confirmation code: <code style="background:#f3f4f6;padding:2px 6px;border-radius:3px">${confirmationCode}</code><br>
    <a href="${statusUrl}" style="color:#3b82f6">Track request status</a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="font-size:12px;color:#9ca3af">ReplyBase · admin@replybase.co.uk</p>
</body>
</html>
    `.trim();

    return sendEmail({ to: email, subject, text, html });
  },

  async completed(email: string, confirmationCode: string) {
    const statusUrl = `${appUrl}/data-deletion-status?code=${confirmationCode}`;

    const subject = "Your data has been deleted — ReplyBase";
    const text = `
Hi,

Your data deletion request (${confirmationCode}) has been fully processed.

All personal data associated with this email address has been permanently removed from ReplyBase's systems.

You can verify the completion status here:
${statusUrl}

If you believe any data remains or have further questions, contact us at admin@replybase.co.uk.

— The ReplyBase Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:32px 16px">
  <h2 style="font-size:20px;margin-bottom:8px">Your Data Has Been Deleted</h2>
  <p style="color:#555;margin-bottom:24px">All personal data associated with <strong>${email}</strong> has been permanently removed from ReplyBase.</p>
  <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:12px 16px;border-radius:4px;margin-bottom:24px">
    <p style="margin:0;font-size:14px">Request <strong>${confirmationCode}</strong> — completed successfully.</p>
  </div>
  <a href="${statusUrl}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;margin-bottom:16px">View Status Page</a>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="font-size:12px;color:#9ca3af">ReplyBase · admin@replybase.co.uk</p>
</body>
</html>
    `.trim();

    return sendEmail({ to: email, subject, text, html });
  },
};
