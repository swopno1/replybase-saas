import { NextResponse } from "next/server";

export async function GET() {
  return new NextResponse(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Integration Complete</title>
        <style>
          body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <div style="text-align: center;">
          <svg style="width: 48px; height: 48px; color: #10b981; margin: 0 auto 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          <h2 style="color: #0f172a; margin: 0 0 8px;">Integration Successful</h2>
          <p style="color: #64748b; margin: 0;">You can close this window now.</p>
        </div>
        <script>
          setTimeout(() => { window.close(); }, 500);
        </script>
      </body>
    </html>
  `, {
    headers: { "Content-Type": "text/html" }
  });
}
