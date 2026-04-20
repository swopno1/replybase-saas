import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "../login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create Your ReplyBase Account — 14-Day Free Trial",
  description:
    "Start your free trial and unlock all ReplyBase features: AI chatbot, lead capture, Telegram, Webchat, Facebook, WhatsApp, and more. No card required.",
  alternates: {
    canonical: "/auth/register",
  },
  openGraph: {
    title: "Create Your ReplyBase Account — 14-Day Free Trial",
    description:
      "Start your free trial and unlock all ReplyBase features: AI chatbot, lead capture, Telegram, Webchat, Facebook, WhatsApp, and more. No card required.",
    url: "https://app.replybase.co.uk/auth/register",
    type: "website",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does the free trial work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You get full access to all ReplyBase features for 14 days. No card is charged until your trial ends. Cancel anytime before Day 14 and you will not be billed.",
      },
    },
    {
      "@type": "Question",
      name: "What happens after my trial?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can choose a paid plan or downgrade to the Free plan. Your data and bots remain safe — you won't lose access to your account.",
      },
    },
    {
      "@type": "Question",
      name: "Can I cancel my subscription anytime?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You can cancel or change your plan at any time from your dashboard. There are no long-term contracts.",
      },
    },
    {
      "@type": "Question",
      name: "Is my payment information secure?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "All payments are processed securely by Stripe. ReplyBase never stores your card details.",
      },
    },
    {
      "@type": "Question",
      name: "What support do I get during my trial?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You get full access to our support team via chat and email during your trial. We help you get set up and answer any questions.",
      },
    },
  ],
};

export default function RegisterPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <Suspense
        fallback={
          <div className="mx-auto max-w-md px-4 py-16 text-center">
            Loading registration...
          </div>
        }
      >
        <RegisterForm />
      </Suspense>
      <div className="max-w-2xl mx-auto mt-12 mb-24 bg-slate-800/60 rounded-2xl p-8 border border-slate-700/50 hidden">
        <h2 className="text-2xl font-bold text-white mb-6">
          Frequently Asked Questions
        </h2>
        <dl className="space-y-6 text-slate-300">
          <div>
            <dt className="font-semibold text-white">
              How does the free trial work?
            </dt>
            <dd>
              You get full access to all ReplyBase features for 14 days. No card
              is charged until your trial ends. Cancel anytime before Day 14 and
              you will not be billed.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-white">
              What happens after my trial?
            </dt>
            <dd>
              You can choose a paid plan or downgrade to the Free plan. Your
              data and bots remain safe &mdash; you won&apos;t lose access to
              your account.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-white">
              Can I cancel my subscription anytime?
            </dt>
            <dd>
              Yes. You can cancel or change your plan at any time from your
              dashboard. There are no long-term contracts.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-white">
              Is my payment information secure?
            </dt>
            <dd>
              All payments are processed securely by Stripe. ReplyBase never
              stores your card details.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-white">
              What support do I get during my trial?
            </dt>
            <dd>
              You get full access to our support team via chat and email during
              your trial. We help you get set up and answer any questions.
            </dd>
          </div>
        </dl>
      </div>
    </>
  );
}
