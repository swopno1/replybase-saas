import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export default async function DataDeletionStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Data Deletion Status
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            A confirmation code is required to view the status of your request.
          </p>
        </div>
      </div>
    );
  }

  const request = await prisma.dataDeletionRequest.findUnique({
    where: { confirmationCode: code },
  });

  if (!request) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Request Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            We could not find a data deletion request with that confirmation
            code.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <svg
            className="mx-auto h-16 w-16 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Data Deletion Status
        </h1>

        <p className="text-gray-600 dark:text-gray-300 mb-2">
          Status: <span className="font-semibold">{request.status}</span>
        </p>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Requested on {request.requestedAt.toLocaleDateString()}
        </p>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          If you have any questions, please contact our support team.
        </p>
      </div>
    </div>
  );
}
