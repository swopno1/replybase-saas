"use client";

import { useEffect, useState } from "react";

export default function WebchatE2EHarnessPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    const existing = document.getElementById("replybase-webchat-e2e-script");
    if (existing) {
      existing.remove();
    }

    const script = document.createElement("script");
    script.id = "replybase-webchat-e2e-script";
    script.src = "/embed/replybase-webchat.js";
    script.dataset.publicKey = "wpk_e2e_public_key";
    script.dataset.title = "E2E Assistant";
    script.dataset.primaryColor = "#0f766e";
    script.dataset.position = "right";
    script.defer = true;

    script.onload = () => setStatus("ready");
    script.onerror = () => setStatus("error");

    document.body.appendChild(script);

    return () => {
      const tag = document.getElementById("replybase-webchat-e2e-script");
      if (tag) {
        tag.remove();
      }
      const root = document.getElementById("replybase-webchat-root");
      if (root) {
        root.remove();
      }
    };
  }, []);

  return (
    <main style={{ padding: "24px", minHeight: "100vh" }}>
      <h1 data-testid="e2e-title">Webchat E2E Harness</h1>
      <p data-testid="e2e-description">
        This page loads the real webchat embed script for Playwright tests.
      </p>
      <p data-testid="e2e-status">{status}</p>
    </main>
  );
}
