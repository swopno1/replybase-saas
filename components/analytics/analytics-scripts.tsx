"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const plausibleDomain =
  process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "app.replybase.co.uk";
const plausibleScriptSrc =
  process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC ||
  "https://engine.replybase.co.uk/js/script.js";

export function AnalyticsScripts() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // Only load in production on the specific production domain
  const hostname = window.location.hostname;
  const isProduction = hostname === "app.replybase.co.uk";

  if (!isProduction || process.env.NODE_ENV !== "production") {
    return null;
  }

  return (
    <>
      <Script
        id="plausible"
        strategy="afterInteractive"
        defer
        data-domain={plausibleDomain}
        src={plausibleScriptSrc}
        onError={(e) => {
          console.error("Plausible script failed to load", e);
        }}
      />
    </>
  );
}
