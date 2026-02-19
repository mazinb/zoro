'use client';

import React, { Suspense, useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Moon, Sun, Upload } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { ExpenseBucketInput } from '@/components/expenses/ExpenseBucketInput';
import { CompareView } from '@/components/expenses/CompareView';
import type { ExpenseBucket } from '@/components/retirement/types';
import type { BucketsPerFile } from '@/components/expenses/types';
import { countryData, getCountriesSorted } from '@/components/retirement/countryData';

const EXPENSES_TOKEN_KEY = 'zoro_expenses_token';
const MAX_UPLOAD_FILES = 5;
const DEFAULT_COUNTRY = 'India';

function getDefaultBuckets(country: string): Record<string, ExpenseBucket> {
  const data = countryData[country] ?? countryData['India'];
  return Object.fromEntries(
    Object.entries(data.buckets).map(([k, v]) => [k, { ...v }])
  );
}

function ExpensesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);

  const [token, setTokenState] = useState<string | null>(null);

  useEffect(() => {
    const urlToken = searchParams.get('token');
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem(EXPENSES_TOKEN_KEY) : null;
    setTokenState(urlToken || stored || null);
  }, [searchParams]);
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [buckets, setBuckets] = useState<Record<string, ExpenseBucket>>(() =>
    getDefaultBuckets(DEFAULT_COUNTRY)
  );
  const [bucketsPerFile, setBucketsPerFile] = useState<BucketsPerFile[]>([]);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [gateEmail, setGateEmail] = useState('');
  const [gateSending, setGateSending] = useState(false);
  const [gateMessage, setGateMessage] = useState<'idle' | 'sent' | 'not_registered' | 'error'>('idle');
  const [gateError, setGateError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/user-data?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (cancelled) return;
        const data = json?.data;
        if (data?.name && typeof data.name === 'string') setUserName(data.name.trim());
      } catch {
        if (!cancelled) setUserName('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const currency = countryData[country]?.currency ?? countryData['India'].currency;

  const handleCountryChange = useCallback((newCountry: string) => {
    setCountry(newCountry);
    setShowCountryDropdown(false);
    setBuckets(getDefaultBuckets(newCountry));
  }, []);

  const handleBucketChange = useCallback((key: string, value: number) => {
    setBuckets((prev) => {
      const next = { ...prev };
      if (next[key]) next[key] = { ...next[key], value };
      return next;
    });
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list) {
      setUploadFiles([]);
      return;
    }
    const arr = Array.from(list).filter((f) => f.type?.toLowerCase() === 'application/pdf').slice(0, MAX_UPLOAD_FILES);
    setUploadFiles(arr);
    setUploadError(null);
  }, []);

  const handleSendMagicLink = useCallback(async () => {
    const email = gateEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setGateError('Please enter a valid email.');
      return;
    }
    setGateSending(true);
    setGateError(null);
    setGateMessage('idle');
    try {
      const res = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectPath: '/expenses' }),
      });
      const json = await res.json();
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
  }, [gateEmail]);

  const handleUpload = useCallback(async () => {
    if (!token) {
      setUploadError('Session expired. Please use the link from your email again.');
      return;
    }
    if (uploadFiles.length === 0) {
      setUploadError('Select at least one PDF.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    setUploadProgress(null);
    const collected: BucketsPerFile[] = [];
    const n = uploadFiles.length;
    try {
      for (let i = 0; i < n; i++) {
        setUploadProgress(`Parsing file ${i + 1}/${n}…`);
        const formData = new FormData();
        formData.append('token', token);
        formData.append('file', uploadFiles[i]);
        formData.append('fileName', `File ${i + 1}`);
        const res = await fetch('/api/expenses/parse-one-file', {
          method: 'POST',
          body: formData,
        });
        const json = await res.json();
        if (!res.ok) {
          if (res.status === 409) {
            setUploadError("You've already used the expenses analysis once.");
            return;
          }
          setUploadError(json.error ?? json.message ?? `File ${i + 1} failed`);
          return;
        }
        const data = json.data;
        if (data?.fileName != null && data?.buckets) {
          collected.push({ fileName: data.fileName, buckets: data.buckets });
        }
        setUploadProgress(`Parsed ${i + 1}/${n} file${n !== 1 ? 's' : ''}`);
      }
      setUploadProgress('Finalizing…');
      const finalRes = await fetch('/api/expenses/finalize-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const finalJson = await finalRes.json();
      if (!finalRes.ok) {
        if (finalRes.status === 409) {
          setUploadError("You've already used the expenses analysis once.");
          return;
        }
        setUploadError(finalJson.error ?? 'Finalize failed');
        return;
      }
      setBucketsPerFile(collected);
      setStep(2);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [token, uploadFiles]);

  const canProceedFromEstimate = useMemo(() => {
    return Object.values(buckets).every((b) => typeof b.value === 'number' && !Number.isNaN(b.value));
  }, [buckets]);

  if (!token) {
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
          <h1 className={`text-2xl font-light mb-2 ${theme.textClass}`}>Expenses</h1>
          <p className={`text-sm mb-6 ${theme.textSecondaryClass}`}>
            You can use the expenses tool only if you’re already signed up with Zoro. Enter your email and we’ll send you a link to open this form.
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
              onChange={(e) => { setGateEmail(e.target.value); setGateMessage('idle'); setGateError(null); }}
              placeholder="you@example.com"
              className={`w-full px-3 py-2 rounded-lg border mb-4 ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
            />
            {gateError && <p className="mb-2 text-sm text-red-500">{gateError}</p>}
            {gateMessage === 'not_registered' && (
              <div className={`mb-4 p-4 rounded-lg ${darkMode ? 'bg-slate-900/50 border border-slate-700' : 'bg-amber-50 border border-amber-200'}`}>
                <p className={`text-sm font-medium ${theme.textClass}`}>
                  This email isn’t registered. Sign up for Zoro first, then come back to use the expenses tool.
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
        </main>
      </div>
    );
  }

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
        <h1 className={`text-2xl font-light mb-2 ${theme.textClass}`}>Expenses</h1>
        <p className={`text-sm mb-8 ${theme.textSecondaryClass}`}>
          Estimate your monthly expenses, then compare with your bank statement.
        </p>

        {step === 0 && (
          <>
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${theme.textClass}`}>
                Currency
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                  className={`w-full flex items-center justify-between gap-2 p-3 rounded-lg border ${
                    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
                  } ${theme.textClass}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xl">{countryData[country]?.flag ?? '🌍'}</span>
                    <span>{country}</span>
                    <span className={theme.textSecondaryClass}>
                      ({countryData[country]?.currency ?? '₹'})
                    </span>
                  </span>
                  <svg
                    className={`w-5 h-5 ${showCountryDropdown ? 'rotate-180' : ''} ${theme.textSecondaryClass}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showCountryDropdown && (
                  <div
                    className={`absolute z-10 w-full mt-2 rounded-lg shadow-xl ${
                      darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'
                    }`}
                  >
                    {getCountriesSorted().map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleCountryChange(c)}
                        className={`w-full p-4 text-left flex items-center gap-3 ${
                          darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'
                        } ${country === c ? (darkMode ? 'bg-slate-700' : 'bg-gray-50') : ''} ${theme.textClass}`}
                      >
                        <span className="text-2xl">{countryData[c].flag}</span>
                        <span>{c}</span>
                        <span className={theme.textSecondaryClass}>({countryData[c].currency})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <ExpenseBucketInput
              buckets={buckets}
              onChange={handleBucketChange}
              currency={currency}
              darkMode={darkMode}
              theme={theme}
            />
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={!canProceedFromEstimate}
              className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-lg"
            >
              Continue to upload
            </button>
          </>
        )}

        {step === 1 && (
          <div
            className={`p-6 rounded-lg mb-6 ${
              darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'
            }`}
          >
            <h2 className={`text-xl font-light mb-2 ${theme.textClass}`}>Upload bank statement</h2>
            <p className={`text-sm mb-2 ${theme.textSecondaryClass}`}>
              Compare your estimates to your statement. We extract expenses by category. You can upload up to {MAX_UPLOAD_FILES} PDFs.
            </p>
            <p className={`text-sm mb-4 font-medium ${theme.textClass}`}>
              We do not save your files. PDFs are processed and then discarded. You can use this analysis only once per account.
            </p>
            <p className={`text-sm mb-2 ${theme.textSecondaryClass}`}>
              <strong>{uploadFiles.length}/{MAX_UPLOAD_FILES}</strong> files selected
            </p>
            <input
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleFileChange}
              className={`block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-500 file:text-white hover:file:bg-blue-600 ${theme.textClass}`}
            />
            {uploadProgress && (
              <p className={`mt-3 text-sm font-medium ${theme.textClass}`}>{uploadProgress}</p>
            )}
            {uploadError && (
              <p className="mt-2 text-sm text-red-500">{uploadError}</p>
            )}
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(0)}
                className={`py-2 px-4 rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploadFiles.length === 0 || uploading}
                className="inline-flex items-center gap-2 py-2 px-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium"
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'Processing…' : 'Upload & compare'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <CompareView
            estimatedBuckets={buckets}
            bucketsPerFile={bucketsPerFile}
            currency={currency}
            darkMode={darkMode}
            theme={theme}
            userName={userName}
          />
        )}
      </main>
    </div>
  );
}

function ExpensesPageFallback() {
  const { darkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);
  return (
    <div className={`min-h-screen ${theme.bgClass} flex items-center justify-center`}>
      <p className={theme.textSecondaryClass}>Loading…</p>
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<ExpensesPageFallback />}>
      <ExpensesPageContent />
    </Suspense>
  );
}
