'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SuccessContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const msg = searchParams.get('msg');
  const linkedinError = searchParams.get('linkedin_error');
  const details = searchParams.get('details');

  if (error || msg || linkedinError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-xl font-semibold text-red-600 dark:text-red-400">LinkedIn authorization failed</h1>
          <p className="text-zinc-600 dark:text-zinc-400">{msg || linkedinError || 'Unknown error'}</p>
          {details && <p className="text-sm text-zinc-500 break-all">{details}</p>}
          <Link href="/" className="inline-block text-blue-600 hover:underline">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-xl font-semibold text-green-600 dark:text-green-400">LinkedIn connected</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Your token is saved. You can now post to LinkedIn via <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">POST /api/linkedin/post</code> with <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">{`{ "text": "..." }`}</code>.
        </p>
        <p className="text-sm text-zinc-500">
          Next: Reddit content → LinkedIn posts (daily automation coming soon).
        </p>
        <Link href="/" className="inline-block text-blue-600 hover:underline">Back to home</Link>
      </div>
    </div>
  );
}

export default function LinkedInSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950"><p className="text-zinc-600">Loading…</p></div>}>
      <SuccessContent />
    </Suspense>
  );
}
