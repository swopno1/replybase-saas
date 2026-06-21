"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";

type ClaimPlan = "launch" | "grow" | "scale" | "business";

const PLAN_LABELS: Record<ClaimPlan, { name: string; trial: string }> = {
  launch: { name: "Launch", trial: "14-day free trial" },
  grow: { name: "Grow", trial: "14-day free trial" },
  scale: { name: "Scale", trial: "14-day free trial" },
  business: { name: "Business", trial: "14-day free trial" },
};

function parsePlan(value: string | null): ClaimPlan | null {
  if (
    value === "launch" ||
    value === "grow" ||
    value === "scale" ||
    value === "business"
  ) {
    return value;
  }
  return null;
}

function ClaimForm() {
  const searchParams = useSearchParams();
  const plan = parsePlan(searchParams.get("plan")) ?? "grow";
  const source = searchParams.get("source") ?? undefined;
  const billingCycle =
    searchParams.get("cycle") === "annual" ? "annual" : "monthly";
  const promo = searchParams.get("promo") ?? undefined;
  const wasCanceled = searchParams.get("canceled") === "true";

  const planMeta = PLAN_LABELS[plan];

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(
    wasCanceled ? "Checkout was cancelled. You can try again below." : null,
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          plan,
          source,
          billingCycle,
          promo,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      // Redirect to Stripe checkout — no Next.js router, direct navigation
      window.location.assign(data.checkoutUrl);
    } catch {
      setError("Connection error. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mb-2 inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-200 self-center">
          {planMeta.name} plan · {planMeta.trial}
        </div>
        <CardTitle className="text-xl">Start your free trial</CardTitle>
        <CardDescription>
          No card charged for 14 days. Cancel anytime.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>First name</FieldLabel>
                <Input
                  type="text"
                  autoComplete="given-name"
                  placeholder="Jane"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={loading}
                />
              </Field>
              <Field>
                <FieldLabel>Last name</FieldLabel>
                <Input
                  type="text"
                  autoComplete="family-name"
                  placeholder="Smith"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={loading}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>Work email</FieldLabel>
              <Input
                type="email"
                autoComplete="email"
                placeholder="jane@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </Field>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing checkout…
                </>
              ) : (
                <>
                  Continue to checkout
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </FieldGroup>
        </form>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          Payments secured by Stripe
        </div>

        <FieldDescription className="mt-4 text-center text-xs">
          Already have an account?{" "}
          <Link href="/auth/login" className="underline underline-offset-4">
            Sign in
          </Link>
        </FieldDescription>
      </CardContent>
    </Card>
  );
}

export default function ClaimPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      }
    >
      <ClaimForm />
    </Suspense>
  );
}
