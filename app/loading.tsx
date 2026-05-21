import { Loader2 } from "lucide-react";

export default function GlobalLoading() {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-slate-950/50">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    </div>
  );
}
