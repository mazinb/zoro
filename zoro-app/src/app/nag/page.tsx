import { Suspense } from 'react';
import type { Metadata } from 'next';
import { NagPageInner } from './NagPageInner';

export const metadata: Metadata = {
  title: 'Nag',
  description: 'Schedule reminders that actually work — email and more.',
};

function NagFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
      Loading…
    </div>
  );
}

export default function NagPage() {
  return (
    <Suspense fallback={<NagFallback />}>
      <NagPageInner />
    </Suspense>
  );
}
