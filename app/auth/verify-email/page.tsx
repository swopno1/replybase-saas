"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Mail, RefreshCw, AlertCircle } from "lucide-react";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 100; // ~5 minutes

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") ?? "";
  const blocked = searchParams.get("blocked") === "true";

  const [status, setStatus] = useState<
    "waiting" | "verified" | "resending" | "resent" | "error"
  >("waiting");
  const [resendError, setResendError] = useState("");
  const [retryAfter, setRetryAfter] = useState(0);
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Countdown for resend rate limit ──────────────────────────────────────
  useEffect(() => {
    if (retryAfter <= 0) return;
    const t = setTimeout(() => setRetryAfter((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [retryAfter]);

  // ── Poll for verification ─────────────────────────────────────────────────
  useEffect(() => {
    if (!email || status === "verified") return;

    pollRef.current = setInterval(async () => {
      setPollCount((n) => {
        if (n >= MAX_POLLS) {
          clearInterval(pollRef.current!);
          return n;
        }
        return n + 1;
      });

      try {
        const res = await fetch(
          `/api/auth/verify-email?check=true&email=${encodeURIComponent(email)}`,
        );
        const data = await res.json();

        if (data.verified) {
          clearInterval(pollRef.current!);
          setStatus("verified");
          setTimeout(() => {
            router.push(
              `/auth/login?verified=true&email=${encodeURIComponent(email)}`,
            );
          }, 1500);
        }
      } catch {
        // Silent — keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [email, router, status]);

  async function handleResend() {
    if (!email) return;
    setResendError("");
    setStatus("resending");

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResendError(data.error ?? "Failed to resend. Please try again.");
        if (data.retryAfter) setRetryAfter(data.retryAfter);
        setStatus("waiting");
        return;
      }

      setStatus("resent");
      setTimeout(() => setStatus("waiting"), 4000);
    } catch {
      setResendError("Connection error. Please try again.");
      setStatus("waiting");
    }
  }

  const maskedEmail = email
    ? email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + b.replace(/./g, "*") + c)
    : "";

  // ── Verified ──────────────────────────────────────────────────────────────
  if (status === "verified") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <div className="rounded-full bg-green-100 p-3">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-900">Email verified!</p>
            <p className="text-sm text-slate-500">Taking you to sign in…</p>
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  // ── Waiting / Resent / Resending ──────────────────────────────────────────
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mb-2 flex justify-center">
          <div className="rounded-full bg-blue-100 p-3">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <CardTitle>
          {blocked ? "Verify your email to sign in" : "Check your inbox"}
        </CardTitle>
        <CardDescription>
          {email ? (
            <>
              We sent a verification link to{" "}
              <span className="font-medium text-slate-700">{maskedEmail}</span>.
              Click it to activate your account.
            </>
          ) : (
            "Click the verification link we emailed you to continue."
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Waiting indicator */}
        {status === "waiting" && pollCount < MAX_POLLS && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-3 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Waiting for verification… this page updates automatically.
          </div>
        )}

        {pollCount >= MAX_POLLS && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-medium">Still waiting?</p>
            <p>Check your spam folder or resend the email below.</p>
          </div>
        )}

        {/* Resent confirmation */}
        {status === "resent" && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Verification email resent! Check your inbox.
          </div>
        )}

        {/* Resend error */}
        {resendError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {resendError}
          </div>
        )}

        {/* Resend button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleResend}
          disabled={status === "resending" || retryAfter > 0}
        >
          {status === "resending" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : retryAfter > 0 ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Resend in {retryAfter}s
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Resend verification email
            </>
          )}
        </Button>

        <p className="text-center text-xs text-slate-400">
          Already verified?{" "}
          <Link
            href={email ? `/auth/login?email=${encodeURIComponent(email)}` : "/auth/login"}
            className="underline hover:text-slate-600"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
