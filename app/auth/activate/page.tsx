"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldDescription,
} from "@/components/ui/field";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

type TokenState = "loading" | "valid" | "invalid" | "expired" | "already_claimed";

function ActivateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [tokenState, setTokenState] = useState<TokenState>("loading");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [tokenError, setTokenError] = useState("");

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  // Validate the token on mount
  useEffect(() => {
    if (!token) {
      setTokenState("invalid");
      setTokenError("No activation token found in this link.");
      return;
    }

    fetch(`/api/auth/activate?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.alreadyClaimed) {
          setTokenState("already_claimed");
          return;
        }
        if (!data.valid) {
          if (data.error?.includes("expired")) {
            setTokenState("expired");
          } else {
            setTokenState("invalid");
          }
          setTokenError(data.error ?? "Invalid link.");
          return;
        }
        setMaskedEmail(data.maskedEmail ?? "");
        setTokenState("valid");
      })
      .catch(() => {
        setTokenState("invalid");
        setTokenError("Could not validate your activation link. Please try again.");
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      // Password saved — now sign in via credentials so the user gets a session
      const result = await signIn("credentials", {
        email: data.email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // Edge case: sign-in failed even though activation succeeded
        setSubmitError("Account activated but sign-in failed. Please go to the login page.");
        return;
      }

      setSuccess(true);
      // Brief success state, then redirect to dashboard
      setTimeout(() => router.push("/"), 1500);
    } catch {
      setSubmitError("Connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (tokenState === "loading") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Validating your link…</p>
        </CardContent>
      </Card>
    );
  }

  // ── Already claimed ──────────────────────────────────────────────────────────
  if (tokenState === "already_claimed") {
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
            Your account is already set up. Sign in to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/auth/login">
            <Button className="w-full">Sign in</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // ── Invalid / expired token ──────────────────────────────────────────────────
  if (tokenState === "invalid" || tokenState === "expired") {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <div className="rounded-full bg-red-100 p-3">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <CardTitle>
            {tokenState === "expired" ? "Link expired" : "Invalid link"}
          </CardTitle>
          <CardDescription>{tokenError}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {tokenState === "expired" && (
            <p className="text-center text-sm text-slate-600">
              Activation links expire after 24 hours. You can request a new one
              from the checkout confirmation page, or contact support.
            </p>
          )}
          <a href="mailto:support@replybase.co.uk">
            <Button variant="outline" className="w-full">
              Contact support
            </Button>
          </a>
        </CardContent>
      </Card>
    );
  }

  // ── Success state ────────────────────────────────────────────────────────────
  if (success) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <div className="rounded-full bg-green-100 p-3">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-900">You're all set!</p>
            <p className="text-sm text-slate-500">Taking you to your dashboard…</p>
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  // ── Valid token — show password form ─────────────────────────────────────────
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mb-2 flex justify-center">
          <div className="rounded-full bg-blue-100 p-3">
            <ShieldCheck className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <CardTitle>Set your password</CardTitle>
        <CardDescription>
          {maskedEmail
            ? `Creating password for ${maskedEmail}`
            : "Create a password to access your dashboard."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {submitError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel>Password</FieldLabel>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={submitting}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <FieldDescription>
                Minimum 8 characters.
              </FieldDescription>
            </Field>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activating…
                </>
              ) : (
                "Activate my account"
              )}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ActivatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      }
    >
      <ActivateContent />
    </Suspense>
  );
}
