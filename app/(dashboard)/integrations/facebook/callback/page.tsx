"use client";
import { useEffect } from "react";

export default function FacebookCallbackPage() {
  useEffect(() => {
    // Small delay to ensure cookies are set before closing
    const timer = setTimeout(() => {
      window.close();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center">
        <h1 className="text-lg font-semibold text-emerald-600">Authentication Successful!</h1>
        <p className="text-sm text-slate-500 mt-2">You can close this window now.</p>
      </div>
    </div>
  );
}
