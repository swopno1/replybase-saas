import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";
  
  // We fetch the CSRF token from NextAuth so we can submit the POST request
  // This bypasses the default NextAuth "Sign in with..." button page
  const res = await fetch(`${baseUrl}/api/auth/csrf`, {
    headers: {
      cookie: req.headers.get("cookie") || "",
    },
  });
  
  const { csrfToken } = await res.json().catch(() => ({ csrfToken: "" }));

  const callbackUrl = `${baseUrl}/api/integrations/facebook/close-popup`;

  return new NextResponse(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Connecting Facebook...</title>
        <style>
          body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f8fafc; }
          .loader { border: 3px solid #e2e8f0; border-top: 3px solid #3b82f6; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto 16px; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div style="text-align: center;">
          <div class="loader"></div>
          <p style="color: #64748b;">Redirecting to Meta...</p>
        </div>
        <form id="submit-form" action="/api/auth/signin/facebook" method="POST">
          <input type="hidden" name="csrfToken" value="${csrfToken}" />
          <input type="hidden" name="callbackUrl" value="${callbackUrl}" />
        </form>
        <script>
          document.getElementById('submit-form').submit();
        </script>
      </body>
    </html>
  `, {
    headers: { "Content-Type": "text/html" }
  });
}
