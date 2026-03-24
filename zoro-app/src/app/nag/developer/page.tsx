import { Suspense } from 'react';
import type { Metadata } from 'next';
import { DeveloperPageInner } from './DeveloperPageInner';

export const metadata: Metadata = {
  title: 'Nag Developer Settings',
  description: 'Developer mode, webhooks, and personality for Nags.',
};

function Fallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
      Loading…
    </div>
  );
}

export default function NagDeveloperPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <DeveloperPageInner />
    </Suspense>
  );
}

