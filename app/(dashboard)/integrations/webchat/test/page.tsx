"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function WebchatTestHarnessContent() {
  const searchParams = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);
  const [currentOrigin] = useState(
    typeof window !== "undefined" ? window.location.origin : "",
  );
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");

  const publicKey = searchParams.get("publicKey")?.trim() || "";
  const baseUrl = searchParams.get("baseUrl")?.trim() || "";
  const title = searchParams.get("title")?.trim() || "Chat with us";
  const primaryColor = searchParams.get("primaryColor")?.trim() || "#0f766e";
  const position = searchParams.get("position") === "left" ? "left" : "right";
  const welcomeMessage =
    searchParams.get("welcomeMessage")?.trim() ||
    "Hi. How can I help you today?";
  const siteName = searchParams.get("siteName")?.trim() || "Webchat Site";
  const missingPublicKey = !publicKey;

  const allowedDomains = useMemo(() => {
    const raw = searchParams.get("allowedDomains")?.trim();
    if (!raw) {
      return [] as string[];
    }

    return raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }, [searchParams]);

  const normalizedAllowedDomains = useMemo(
    () =>
      allowedDomains
        .map((value) => normalizeOrigin(value))
        .filter((value): value is string => Boolean(value)),
    [allowedDomains],
  );

  const isCurrentOriginAllowed = useMemo(() => {
    if (!normalizedAllowedDomains.length) {
      return true;
    }

    const normalizedCurrentOrigin = normalizeOrigin(currentOrigin);
    return Boolean(
      normalizedCurrentOrigin &&
      normalizedAllowedDomains.includes(normalizedCurrentOrigin),
    );
  }, [currentOrigin, normalizedAllowedDomains]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const rootId = "replybase-webchat-root";
    const scriptId = "replybase-webchat-harness-script";

    document.getElementById(rootId)?.remove();
    document.getElementById(scriptId)?.remove();

    if (missingPublicKey) {
      return;
    }

    const runtimeBaseUrl = baseUrl || window.location.origin;
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `${runtimeBaseUrl}/embed/replybase-webchat.js`;
    script.dataset.baseUrl = runtimeBaseUrl;
    script.dataset.publicKey = publicKey;
    script.dataset.title = title;
    script.dataset.primaryColor = primaryColor;
    script.dataset.position = position;
    script.defer = true;

    script.onload = () => {
      setStatus("ready");
    };

    script.onerror = () => {
      setStatus("error");
      setErrorMessage("Failed to load the ReplyBase webchat embed script.");
    };

    document.body.appendChild(script);

    return () => {
      document.getElementById(rootId)?.remove();
      document.getElementById(scriptId)?.remove();
    };
  }, [
    baseUrl,
    missingPublicKey,
    position,
    primaryColor,
    publicKey,
    reloadKey,
    title,
  ]);

  const displayedStatus = missingPublicKey ? "error" : status;
  const displayedErrorMessage = missingPublicKey
    ? "Missing public key. Launch this page from the webchat dashboard."
    : errorMessage;

  function handleReloadWidget() {
    setStatus("loading");
    setErrorMessage("");
    setReloadKey((value) => value + 1);
  }

  function handleResetSession() {
    if (typeof window === "undefined" || !publicKey) {
      return;
    }

    window.localStorage.removeItem(`replybase_webchat_session:${publicKey}`);
    setStatus("loading");
    setErrorMessage("");
    setReloadKey((value) => value + 1);
  }

  return (
    <div className="space-y-6 pb-28">
      <div>
        <Link href="/integrations/webchat">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Webchat Setup
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">
          Widget Test Harness
        </h1>
        <p className="mt-1 text-muted-foreground">
          This page loads the real ReplyBase embed script for {siteName} so you
          can test the public widget before adding it to a customer website.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Harness Status</CardTitle>
            <CardDescription>
              Use the floating chat launcher in the bottom corner after the
              widget finishes loading.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-slate-50 p-4">
                <p className="text-sm text-muted-foreground">Current Origin</p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {currentOrigin || "Loading..."}
                </p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-4">
                <p className="text-sm text-muted-foreground">Allowlist Check</p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {isCurrentOriginAllowed
                    ? "Current origin allowed"
                    : "Current origin is not on the site allowlist"}
                </p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-4">
                <p className="text-sm text-muted-foreground">Widget Status</p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {displayedStatus === "idle"
                    ? "Waiting to load"
                    : displayedStatus === "loading"
                      ? "Loading embed script"
                      : displayedStatus === "ready"
                        ? "Ready. Click the launcher bubble."
                        : "Load failed"}
                </p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-4">
                <p className="text-sm text-muted-foreground">Public Key</p>
                <p className="mt-2 break-all text-sm font-medium text-slate-900">
                  {publicKey || "Unavailable"}
                </p>
              </div>
            </div>

            {displayedErrorMessage ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {displayedErrorMessage}
              </div>
            ) : null}

            {!isCurrentOriginAllowed && normalizedAllowedDomains.length ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                This harness runs on the current dashboard origin, so the public
                webchat APIs will reject requests until this origin is added to
                the selected site&apos;s allowlist.
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleReloadWidget}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload Widget
              </Button>
              <Button variant="outline" onClick={handleResetSession}>
                <Trash2 className="mr-2 h-4 w-4" />
                Reset Session
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Launch Context</CardTitle>
            <CardDescription>
              These values are passed into the embed script for this test run.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700">
            <div className="rounded-lg border bg-white p-4">
              <p className="font-medium text-slate-900">Widget Title</p>
              <p className="mt-1">{title}</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="font-medium text-slate-900">Welcome Message</p>
              <p className="mt-1 whitespace-pre-wrap">{welcomeMessage}</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="font-medium text-slate-900">Theme</p>
              <div className="mt-2 flex items-center gap-3">
                <div
                  className="h-5 w-5 rounded-full border"
                  style={{ backgroundColor: primaryColor }}
                />
                <span>{primaryColor}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-700">
                  {position}
                </span>
              </div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="font-medium text-slate-900">Allowed Domains</p>
              {allowedDomains.length ? (
                <div className="mt-2 space-y-2">
                  {allowedDomains.map((domain) => (
                    <p key={domain} className="break-all text-slate-700">
                      {domain}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-slate-700">
                  No site-level domains configured.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Surface</CardTitle>
          <CardDescription>
            Scroll, click around, and use the floating launcher to validate the
            real widget behavior in an isolated dashboard-controlled page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="min-h-[60vh] rounded-2xl border bg-linear-to-br from-slate-50 via-white to-emerald-50 p-8">
            <div className="max-w-2xl space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
                  Internal QA surface
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  Validate launch, init, config load, and message roundtrip
                </h2>
              </div>
              <p className="text-sm leading-6 text-slate-700">
                This page uses the selected webchat site&apos;s public key and
                the same embed script your production snippet loads. Open the
                chat, send a few messages, and then return to the dashboard
                diagnostics panel to confirm telemetry activity.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border bg-white/80 p-4">
                  <p className="text-sm font-medium text-slate-900">
                    Open and close
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Confirm lifecycle events and launcher positioning.
                  </p>
                </div>
                <div className="rounded-xl border bg-white/80 p-4">
                  <p className="text-sm font-medium text-slate-900">
                    Send a message
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Verify session bootstrap, CRM persistence, and AI response.
                  </p>
                </div>
                <div className="rounded-xl border bg-white/80 p-4">
                  <p className="text-sm font-medium text-slate-900">
                    Reset and retry
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Clear local session storage and repeat the flow from init.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function WebchatTestHarnessPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 pb-28">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Widget Test Harness
            </h1>
            <p className="mt-1 text-muted-foreground">
              Loading test harness...
            </p>
          </div>
        </div>
      }
    >
      <WebchatTestHarnessContent />
    </Suspense>
  );
}
