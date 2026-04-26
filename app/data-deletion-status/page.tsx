import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ShieldCheck, Mail, MessageCircle, FileText, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DataDeletionStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  const containerClass = "min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 font-sans";
  const cardClass = "max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-8";

  if (!code) {
    return (
      <div className={containerClass}>
        <div className={cardClass + " text-center"}>
          <ShieldCheck className="mx-auto h-12 w-12 text-slate-400 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Data Deletion Status
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            A confirmation code is required to view the status of your request.
            Please check the link provided by Meta or your initial request confirmation.
          </p>
          <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
            <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors">
              Return to ReplyBase
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const request = await prisma.dataDeletionRequest.findUnique({
    where: { confirmationCode: code },
  });

  if (!request) {
    return (
      <div className={containerClass}>
        <div className={cardClass + " text-center"}>
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Request Not Found
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            We could not find a data deletion request with the confirmation
            code <strong>{code}</strong>. It may have expired or been entered incorrectly.
          </p>
          <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
            <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors">
              Return to ReplyBase
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusIcons = {
    PENDING: <Clock className="mx-auto h-16 w-16 text-amber-500" />,
    IN_PROGRESS: <Clock className="mx-auto h-16 w-16 text-blue-500 animate-pulse" />,
    COMPLETED: <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />,
    REJECTED: <AlertCircle className="mx-auto h-16 w-16 text-red-500" />,
    CANCELLED: <AlertCircle className="mx-auto h-16 w-16 text-slate-400" />,
  };

  const statusLabels = {
    PENDING: "Queued for Deletion",
    IN_PROGRESS: "Processing Request",
    COMPLETED: "Data Successfully Deleted",
    REJECTED: "Request Rejected",
    CANCELLED: "Request Cancelled",
  };

  return (
    <div className={containerClass}>
      <div className={cardClass}>
        <div className="mb-6 text-center">
          {statusIcons[request.status as keyof typeof statusIcons] || statusIcons.PENDING}
        </div>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 text-center">
          Data Deletion Request
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-6">
          Code: {request.confirmationCode}
        </p>

        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700/50">
            <span className="text-sm text-slate-500 dark:text-slate-400">Current Status</span>
            <span className={`text-sm font-bold ${
              request.status === 'COMPLETED' ? 'text-emerald-600' : 'text-amber-600'
            }`}>
              {statusLabels[request.status as keyof typeof statusLabels] || request.status}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700/50">
            <span className="text-sm text-slate-500 dark:text-slate-400">Date Requested</span>
            <span className="text-sm text-slate-900 dark:text-slate-200">
              {request.requestedAt.toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </span>
          </div>
          {request.processedAt && (
            <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700/50">
              <span className="text-sm text-slate-500 dark:text-slate-400">Processed On</span>
              <span className="text-sm text-slate-900 dark:text-slate-200">
                {request.processedAt.toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </span>
            </div>
          )}
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 mb-8">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Legal & Support</h2>
          <div className="space-y-3">
            <a href="mailto:admin@replybase.co.uk" className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <Mail className="h-4 w-4" /> admin@replybase.co.uk
            </a>
            <a href="https://wa.me/447822033580" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              <MessageCircle className="h-4 w-4" /> +44 7822 033580
            </a>
            <Link href="/privacy" className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <ShieldCheck className="h-4 w-4" /> Privacy Policy
            </Link>
            <Link href="/terms" className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <FileText className="h-4 w-4" /> Terms of Service
            </Link>
          </div>
        </div>

        <div className="text-center text-[10px] text-slate-400 leading-relaxed">
          ReplyBase complies with Meta's Data Deletion Policy. Once a request is processed,
          all associated personal data is permanently removed from our active systems.
        </div>
      </div>
    </div>
  );
}
