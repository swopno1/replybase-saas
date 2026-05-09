"use client";
import { useEffect } from "react";
import { signIn } from "next-auth/react";

export default function FacebookAuthPage() {
  useEffect(() => {
    signIn("facebook", { callbackUrl: "/integrations/facebook/callback" });
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center">
        <h1 className="text-lg font-semibold text-slate-800">Redirecting to Facebook...</h1>
        <p className="text-sm text-slate-500 mt-2">Please wait while we securely connect your account.</p>
      </div>
    </div>
  );
}
