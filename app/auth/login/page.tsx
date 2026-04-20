import type { Metadata } from "next";
import { LoginForm } from "../login-form";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Sign In — ReplyBase",
  description:
    "Sign in to your ReplyBase account to access your AI chatbot dashboard, manage subscriptions, and reply to leads instantly.",
  alternates: {
    canonical: "/auth/login",
  },
  openGraph: {
    title: "Sign In — ReplyBase",
    description:
      "Sign in to your ReplyBase account to access your AI chatbot dashboard, manage subscriptions, and reply to leads instantly.",
    url: "https://app.replybase.co.uk/auth/login",
    type: "website",
  },
};

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          Loading registration...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
