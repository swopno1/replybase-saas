export default function WebchatE2EHarnessPage() {
  return (
    <main style={{ padding: "24px", minHeight: "100vh" }}>
      <h1 data-testid="e2e-title">Webchat E2E Harness</h1>
      <p data-testid="e2e-description">
        This page loads the real webchat embed script for Playwright tests.
      </p>

      <script
        id="replybase-webchat-e2e-script"
        src="/embed/replybase-webchat.js"
        data-public-key="wpk_e2e_public_key"
        data-title="E2E Assistant"
        data-primary-color="#0f766e"
        data-position="right"
        defer
      />
    </main>
  );
}
