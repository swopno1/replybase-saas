"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Errors are automatically captured by Sentry via the global-error boundary
    // and the @sentry/nextjs instrumentation. This log is kept for local debugging.
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[100dvh] w-full flex-col items-center justify-center gap-4 text-center px-4">
      <h2 className="text-2xl font-bold text-slate-100">
        Something went wrong!
      </h2>
      <p className="text-slate-400 max-w-md">
        {error.message ||
          "An unexpected error occurred while loading this page."}
      </p>
      <button
        onClick={() => reset()}
        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium"
      >
        Try again
      </button>
    </div>
  );
}
