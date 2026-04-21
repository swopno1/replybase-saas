"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

function WebchatE2EHarnessContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  // Move all searchParams-derived variables above useEffect
  const title = searchParams.get("title") || "E2E Assistant";
  const primaryColor = searchParams.get("primaryColor") || "#0f766e";
  const position = searchParams.get("position") || "right";
  const publicKey = searchParams.get("publicKey") || "wpk_e2e_public_key";
  const cookieConsent = searchParams.get("cookieConsent") || "off";
  const cookieConsentCheck = searchParams.get("cookieConsentCheck") || "";
  const mobileMode = searchParams.get("mobileMode") || "auto";

  // Move the environment check after all hooks, so hooks are always called
  const isNotAvailable =
    typeof window !== "undefined" && process.env.NODE_ENV !== "development";

  useEffect(() => {
    if (isNotAvailable) {
      return;
    }
    const existing = document.getElementById("replybase-webchat-e2e-script");
    if (existing) {
      existing.remove();
    }

    const script = document.createElement("script");
    script.id = "replybase-webchat-e2e-script";
    script.src = "/embed/replybase-webchat.js";
    script.dataset.publicKey = publicKey;
    script.dataset.title = title;
    script.dataset.primaryColor = primaryColor;
    script.dataset.position = position;
    script.dataset.cookieConsent = cookieConsent;
    script.dataset.mobileMode = mobileMode;
    if (cookieConsentCheck) {
      script.dataset.cookieConsentCheck = cookieConsentCheck;
    }
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
  }, [
    cookieConsent,
    cookieConsentCheck,
    mobileMode,
    position,
    primaryColor,
    publicKey,
    title,
  ]);

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

export default function WebchatE2EHarnessPage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: "24px", minHeight: "100vh" }}>
          <h1 data-testid="e2e-title">Webchat E2E Harness</h1>
          <p data-testid="e2e-status">loading</p>
        </main>
      }
    >
      <WebchatE2EHarnessContent />
    </Suspense>
  );
}
