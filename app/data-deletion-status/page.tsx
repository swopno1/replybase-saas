import { Suspense } from 'react';

function DataDeletionContent() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
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
                    Data Deletion Request Received
                </h1>

                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Your data deletion request has been received and will be processed according to our privacy policy.
                </p>

                <p className="text-sm text-gray-500 dark:text-gray-400">
                    If you have any questions, please contact our support team.
                </p>
            </div>
        </div>
    );
}

export default function DataDeletionStatusPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <DataDeletionContent />
        </Suspense>
    );
}
