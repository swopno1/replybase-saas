"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Mail, RefreshCw, AlertCircle } from "lucide-react";
import Link from "next/link";

type PageState = "loading" | "sent" | "already_claimed" | "error";

function ClaimSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [state, setState] = useState<PageState>(
    sessionId ? "loading" : "error",
  );
  const [maskedEmail, setMaskedEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState(
    sessionId ? "" : "Missing session information.",
  );
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  async function callComplete() {
    if (!sessionId) return;
    try {
      const res = await fetch(
        `/api/auth/claim/complete?session_id=${sessionId}`,
      );
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? "Something went wrong.");
        setState("error");
        return;
      }

      if (data.alreadyClaimed) {
        setState("already_claimed");
        return;
      }

      setMaskedEmail(data.maskedEmail ?? "");
      setState("sent");
    } catch {
      setErrorMessage("Connection error. Please try again.");
      setState("error");
    }
  }

  useEffect(() => {
    callComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Count down resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handleResend() {
    if (resending || resendCooldown > 0) return;
    setResending(true);
    await callComplete();
    setResending(false);
    setResendCooldown(60);
  }

  if (state === "loading") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Confirming your payment…</p>
        </CardContent>
      </Card>
    );
  }

  if (state === "already_claimed") {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <CardTitle>Account already activated</CardTitle>
          <CardDescription>
            Your account is all set. Sign in to access your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/auth/login">
            <Button className="w-full">Sign in to your account</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (state === "error") {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <div className="rounded-full bg-red-100 p-3">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button variant="outline" onClick={callComplete} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <p className="text-center text-xs text-slate-500">
            If this keeps happening, contact{" "}
            <a
              href="mailto:support@replybase.co.uk"
              className="underline underline-offset-4"
            >
              support@replybase.co.uk
            </a>
          </p>
        </CardContent>
      </Card>
    );
  }

  // state === "sent"
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mb-2 flex justify-center">
          <div className="rounded-full bg-blue-100 p-3">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          We sent an activation link to{" "}
          <span className="font-medium text-slate-700">{maskedEmail}</span>.
          Click it to set your password and access your dashboard.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600 space-y-1">
          <p>The link expires in 24 hours.</p>
          <p>Check your spam folder if you don't see it within a few minutes.</p>
        </div>

        <Button
          variant="outline"
          onClick={handleResend}
          disabled={resending || resendCooldown > 0}
          className="w-full"
        >
          {resending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Resending…
            </>
          ) : resendCooldown > 0 ? (
            `Resend in ${resendCooldown}s`
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Resend activation email
            </>
          )}
        </Button>

        <p className="text-center text-xs text-slate-500">
          Wrong email?{" "}
          <Link
            href="/auth/claim"
            className="underline underline-offset-4"
          >
            Start over
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function ClaimSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      }
    >
      <ClaimSuccessContent />
    </Suspense>
  );
}
