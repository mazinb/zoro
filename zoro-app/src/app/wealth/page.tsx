'use client';

import React, { Suspense, useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';

const WEALTH_TOKEN_KEY = 'zoro_wealth_token';

function WealthLanding() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);

  const tokenFromQuery = searchParams.get('token');
  const [gateEmail, setGateEmail] = useState('');
  const [gateSending, setGateSending] = useState(false);
  const [gateMessage, setGateMessage] = useState<'idle' | 'sent' | 'not_registered' | 'error'>('idle');
  const [gateError, setGateError] = useState<string | null>(null);

  const redirectPath = useMemo(() => '/expenses', []);

  useEffect(() => {
    if (!tokenFromQuery) return;
    try {
      sessionStorage.setItem(WEALTH_TOKEN_KEY, tokenFromQuery);
    } catch {
      // ignore; sessionStorage might be blocked
    }
    // Wealth is spread across /expenses, /income, /assets; default entry is /expenses.
    router.replace(`${redirectPath}?token=${encodeURIComponent(tokenFromQuery)}`);
  }, [redirectPath, router, tokenFromQuery]);

  const handleSendMagicLink = useCallback(async () => {
    const email = gateEmail.trim().toLowerCase();
    if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      setGateError('Please enter a valid email.');
      setGateMessage('error');
      return;
    }

    setGateSending(true);
    setGateError(null);
    setGateMessage('idle');
    try {
      const res = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectPath }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGateMessage('error');
        setGateError(json.error ?? 'Something went wrong.');
        return;
      }
      if (json.registered === false) {
        setGateMessage('not_registered');
        setGateError(null);
        return;
      }
      setGateMessage('sent');
      setGateError(null);
    } catch (e) {
      setGateMessage('error');
      setGateError(e instanceof Error ? e.message : 'Failed to send link.');
    } finally {
      setGateSending(false);
    }
  }, [gateEmail, redirectPath]);

  return (
    <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
      <nav className={`border-b ${theme.borderClass}`}>
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center cursor-pointer"
            aria-label="Back to home"
          >
            <ZoroLogo className="h-10" isDark={darkMode} />
          </button>
          <div className="flex items-center gap-6">
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className={`text-2xl font-light mb-2 ${theme.textClass}`}>Wealth</h1>
        <p className={`text-sm mb-6 ${theme.textSecondaryClass}`}>
          Use the wealth tools only after you’re signed up. Enter your email and we’ll send you a link to open the experience.
        </p>

        <div
          className={`p-6 rounded-lg mb-6 ${
            darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'
          }`}
        >
          <label className={`block text-sm font-medium mb-1 ${theme.textClass}`}>Email</label>
          <input
            type="email"
            value={gateEmail}
            onChange={(e) => {
              setGateEmail(e.target.value);
              setGateMessage('idle');
              setGateError(null);
            }}
            placeholder="you@example.com"
            className={`w-full px-3 py-2 rounded-lg border mb-4 ${
              darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'
            } ${theme.textClass}`}
          />

          {gateError && <p className="mb-2 text-sm text-red-500">{gateError}</p>}

          {gateMessage === 'not_registered' && (
            <div
              className={`mb-4 p-4 rounded-lg ${
                darkMode ? 'bg-slate-900/50 border border-slate-700' : 'bg-amber-50 border border-amber-200'
              }`}
            >
              <p className={`text-sm font-medium ${theme.textClass}`}>
                This email isn’t registered. Sign up for Zoro first, then come back to use wealth tools.
              </p>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium"
              >
                Sign up for Zoro
              </button>
            </div>
          )}

          {gateMessage === 'sent' && (
            <p className={`mb-4 text-sm ${theme.textSecondaryClass}`}>
              Check your email and click the button in the message to open the form.
            </p>
          )}

          <button
            type="button"
            onClick={handleSendMagicLink}
            disabled={gateSending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium"
          >
            {gateSending ? 'Sending…' : 'Send me the link'}
          </button>
        </div>

        <div className={`text-sm ${theme.textSecondaryClass}`}>
          After you open the link, you can navigate:
          <div className="mt-2 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push('/expenses')}
              className="underline hover:opacity-80"
            >
              Expenses
            </button>
            <button type="button" onClick={() => router.push('/income')} className="underline hover:opacity-80">
              Income
            </button>
            <button type="button" onClick={() => router.push('/assets')} className="underline hover:opacity-80">
              Assets
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function WealthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300 flex items-center justify-center">
          <div className="text-gray-900 dark:text-gray-100">Loading...</div>
        </div>
      }
    >
      <WealthLanding />
    </Suspense>
  );
}

