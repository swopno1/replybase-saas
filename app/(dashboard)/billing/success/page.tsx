"use client";

import { useEffect, useState, Suspense } from "react";

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  
  const [status, setStatus] = useState<"loading" | "syncing" | "success" | "error">("loading");
  const [message, setMessage] = useState("Confirming your subscription...");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setMessage("Missing session information. Please contact support if you were charged.");
      return;
    }

    const verifySession = async () => {
      try {
        const response = await fetch(`/api/billing/verify-session?session_id=${sessionId}`);
        const data = await response.json();

        if (data.status === "success") {
          setStatus("success");
          setMessage(`Successfully upgraded to ${data.subscription.plan}!`);

          if (data.pixelData) {
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
              event: "subscription_started",
              plan_name: data.pixelData.plan_name,
              value: data.pixelData.value,
              currency: data.pixelData.currency,
              transaction_id: data.pixelData.transaction_id,
              first_name: data.pixelData.first_name,
              last_name: data.pixelData.last_name,
              email: data.pixelData.email,
              phone: data.pixelData.phone,
            });
          }

          // Small delay before redirecting to dashboard
          setTimeout(() => {
            router.push("/");
          }, 2000);
        } else if (data.status === "syncing" || data.status === "pending") {
          setStatus("syncing");
          setMessage("Syncing your subscription with our system...");
          
          // Poll again if under max retries (max ~20 seconds)
          if (retryCount < 10) {
            setTimeout(() => setRetryCount(prev => prev + 1), 2000);
          } else {
            setStatus("error");
            setMessage("Background sync is taking longer than expected. Please check your dashboard in a few minutes.");
          }
        } else {
          setStatus("error");
          setMessage(data.error || "An error occurred while verifying your session.");
        }
      } catch (err) {
        setStatus("error");
        setMessage("Connection error. We'll keep trying...");
        setTimeout(() => setRetryCount(prev => prev + 1), 3000);
      }
    };

    verifySession();
  }, [sessionId, retryCount, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col items-center">
        {status === "loading" || status === "syncing" ? (
          <>
            <div className="relative mb-6">
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Processing...</h1>
            <p className="text-slate-600 animate-pulse">{message}</p>
          </>
        ) : status === "success" ? (
          <>
            <div className="mb-6 bg-green-100 p-4 rounded-full">
              <CheckCircle2 className="w-16 h-16 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Checkout Successful!</h1>
            <p className="text-slate-600 mb-8">{message}</p>
            <button 
              onClick={() => router.push("/")}
              className="w-full py-3 px-6 bg-slate-900 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <div className="mb-6 bg-red-100 p-4 rounded-full">
              <AlertCircle className="w-16 h-16 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-slate-600 mb-8">{message}</p>
            <div className="flex flex-col w-full gap-3">
              <Link 
                href="/"
                className="w-full py-3 px-6 bg-slate-100 text-slate-900 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                Back to Dashboard
              </Link>
              <Link 
                href="mailto:support@replybase.co.uk"
                className="text-sm text-slate-500 hover:text-slate-900 underline underline-offset-4"
              >
                Contact support
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
