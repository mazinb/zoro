'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function ClaimInner() {
  const params = useSearchParams();
  const nonce = params.get('nonce')?.trim() ?? '';
  const [status, setStatus] = useState<'working' | 'ok' | 'error'>('working');
  const [message, setMessage] = useState('Confirming your email…');
  const appUrl = useMemo(
    () => (nonce ? `zoro://mailbox/claim?nonce=${encodeURIComponent(nonce)}` : ''),
    [nonce],
  );

  useEffect(() => {
    if (!nonce) {
      setStatus('error');
      setMessage('Missing confirmation code.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/mobile/mailbox/claim/finish?nonce=${encodeURIComponent(nonce)}`);
        const json = (await res.json()) as { error?: string; appUrl?: string };
        if (cancelled) return;
        if (!res.ok) {
          setStatus('error');
          setMessage(json.error ?? 'This link is invalid or expired.');
          return;
        }
        setStatus('ok');
        setMessage('Email confirmed. Opening Zoro…');
        const target = json.appUrl || appUrl;
        window.location.href = target;
      } catch {
        if (!cancelled) {
          setStatus('error');
          setMessage('Could not confirm this link.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce, appUrl]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold mb-3">Claim your Zoro mailbox</h1>
        <p className="text-slate-600 mb-6">{message}</p>
        {status !== 'error' && appUrl ? (
          <a
            href={appUrl}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold"
          >
            Open Zoro
          </a>
        ) : null}
      </div>
    </main>
  );
}

export default function MailboxClaimPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50" />}>
      <ClaimInner />
    </Suspense>
  );
}
