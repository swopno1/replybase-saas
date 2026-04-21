// Minimal placeholder for sendResetEmail
export async function sendResetEmail(email: string, token: string) {
  // TODO: Integrate with your email provider (e.g., SendGrid, Resend, SES)
  // For now, just log the reset link for development
  const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/auth/reset-password?token=${token}`;
  console.log(`Send password reset email to ${email}: ${resetUrl}`);
}
