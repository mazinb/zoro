'use client';

import React, { Suspense, useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Moon, Sun, Upload } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { ExpenseBucketInput } from '@/components/expenses/ExpenseBucketInput';
import { CompareView } from '@/components/expenses/CompareView';
import { ReviewClassifyView } from '@/components/expenses/ReviewClassifyView';
import type { ExpenseBucket } from '@/components/retirement/types';
import type { BucketsPerFile } from '@/components/expenses/types';
import { countryData, getCountriesSorted } from '@/components/retirement/countryData';
import { formatCurrency } from '@/components/retirement/utils';

const EXPENSES_TOKEN_KEY = 'zoro_expenses_token';
const DEFAULT_COUNTRY = 'India';
const BUCKET_KEYS = ['housing', 'food', 'transportation', 'healthcare', 'entertainment', 'other'] as const;

function getMonthOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
  for (let i = 0; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    out.push({ value: `${y}-${m}`, label: fmt.format(d) });
  }
  return out;
}

function bucketsToTotals(buckets: Record<string, { value?: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of BUCKET_KEYS) {
    const v = buckets[k];
    out[k] = v != null && typeof (v as { value?: number }).value === 'number' ? (v as { value: number }).value : 0;
  }
  return out;
}

function sumBucketTotals(totals: Record<string, number>): number {
  return BUCKET_KEYS.reduce((s, k) => s + (totals[k] ?? 0), 0);
}

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
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => monthOptions[0]?.value ?? '');
  const [monthAlreadyImported, setMonthAlreadyImported] = useState(false);
  const [selectedMonthData, setSelectedMonthData] = useState<{
    buckets: Record<string, { value: number }>;
  } | null>(null);
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [sharedData, setSharedData] = useState<Record<string, unknown>>({});
  const [buckets, setBuckets] = useState<Record<string, ExpenseBucket>>(() =>
    getDefaultBuckets(DEFAULT_COUNTRY)
  );
  const [bucketsPerFile, setBucketsPerFile] = useState<BucketsPerFile[]>([]);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMonthlyStatus, setSaveMonthlyStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
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
        if (data?.shared_data && typeof data.shared_data === 'object' && !Array.isArray(data.shared_data)) {
          setSharedData(data.shared_data as Record<string, unknown>);
          const c = (data.shared_data as Record<string, unknown>)?.expenses_country;
          if (typeof c === 'string' && c.trim() && (countryData as Record<string, unknown>)[c.trim()]) {
            setCountry(c.trim());
          }
        }
        const saved = data?.retirement_expense_buckets;
        if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
          setBuckets((prev) => {
            const next = { ...prev };
            for (const k of BUCKET_KEYS) {
              const v = saved[k];
              if (v != null && typeof v === 'object' && typeof (v as { value?: number }).value === 'number' && next[k]) {
                next[k] = { ...next[k], value: (v as { value: number }).value };
              }
            }
            return next;
          });
        }
      } catch {
        if (!cancelled) setUserName('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !selectedMonth) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/expenses/monthly?token=${encodeURIComponent(token)}&month=${encodeURIComponent(selectedMonth)}`
        );
        const json = await res.json();
        if (cancelled) return;
        const data = json?.data;
        setMonthAlreadyImported(!!data?.imported_at);
        if (data?.buckets && typeof data.buckets === 'object' && !Array.isArray(data.buckets)) {
          setSelectedMonthData({ buckets: data.buckets as Record<string, { value: number }> });
        } else {
          setSelectedMonthData(null);
        }
      } catch {
        if (!cancelled) {
          setMonthAlreadyImported(false);
          setSelectedMonthData(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, selectedMonth]);

  const currency = countryData[country]?.currency ?? countryData['India'].currency;
  const selectedMonthLabel = monthOptions.find((o) => o.value === selectedMonth)?.label ?? selectedMonth;

  const estimateTotal = useMemo(
    () => sumBucketTotals(Object.fromEntries(BUCKET_KEYS.map((k) => [k, buckets[k]?.value ?? 0]))),
    [buckets]
  );
  const monthlySummary = useMemo(() => {
    if (!selectedMonthData?.buckets) return null;
    const totals = bucketsToTotals(selectedMonthData.buckets);
    const monthlyTotal = sumBucketTotals(totals);
    const diff = monthlyTotal - estimateTotal;
    const pct = estimateTotal > 0 ? (diff / estimateTotal) * 100 : 0;
    return { monthlyTotal, estimateTotal, diff, pct };
  }, [selectedMonthData, estimateTotal]);

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
    const f = e.target.files?.[0];
    setUploadFiles(f && f.type?.toLowerCase() === 'application/pdf' ? [f] : []);
    setUploadError(null);
  }, []);

  const saveEstimatesWithBuckets = useCallback(
    async (bucketsToSave: Record<string, ExpenseBucket>): Promise<boolean> => {
      if (!token) return false;
      try {
        const res = await fetch('/api/user-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            formType: 'expenses',
            expenseBuckets: bucketsToSave,
            sharedData: { ...sharedData, expenses_country: country },
          }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [token, sharedData, country]
  );

  const saveEstimatesToDb = useCallback(
    async (bucketsToSave: Record<string, { value: number }>, comparedToActuals: boolean) => {
      if (!token) return;
      const res = await fetch('/api/expenses/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          buckets: bucketsToSave,
          comparedToActuals,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Save failed');
      }
    },
    [token]
  );

  const saveEstimates = useCallback(async () => {
    if (!token) return;
    setSaveStatus('saving');
    try {
      await saveEstimatesWithBuckets(buckets);
      await saveEstimatesToDb(
        Object.fromEntries(BUCKET_KEYS.map((k) => [k, { value: buckets[k]?.value ?? 0 }])),
        false
      );
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  }, [buckets, token, saveEstimatesWithBuckets, saveEstimatesToDb]);

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
    const file = uploadFiles[0];
    if (!file) {
      setUploadError('Select a PDF.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    setUploadProgress('Processing…');
    try {
      const formData = new FormData();
      formData.append('token', token);
      formData.append('file', file);
      formData.append('fileName', `Statement ${selectedMonthLabel}`);
      formData.append('month', selectedMonth);
      const res = await fetch('/api/expenses/parse-one-file', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setUploadError(json.message ?? 'This month was already imported. Edit totals manually.');
          return;
        }
        setUploadError(json.error ?? json.message ?? 'Upload failed');
        return;
      }
      const data = json.data;
      const collected: BucketsPerFile[] =
        data?.fileName != null && data?.buckets
          ? [{ fileName: data.fileName, buckets: data.buckets }]
          : [];
      setBucketsPerFile(collected);
      setStep(2);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [token, uploadFiles, selectedMonth, selectedMonthLabel]);

  const handleSaveMonthlyFinal = useCallback(
    async (bucketsToSave: Record<string, { value: number }>) => {
      if (!token) return;
      setSaveMonthlyStatus('saving');
      try {
        const res = await fetch('/api/expenses/monthly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            month: selectedMonth,
            buckets: bucketsToSave,
            finalizeImport: true,
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? 'Save failed');
        }
        setSaveMonthlyStatus('saved');
        setTimeout(() => setSaveMonthlyStatus('idle'), 2000);
        setStep(3);
      } catch {
        setSaveMonthlyStatus('error');
      }
    },
    [token, selectedMonth]
  );

  const handleViewAlreadyImported = useCallback(async () => {
    if (!token || !selectedMonth) return;
    try {
      const res = await fetch(
        `/api/expenses/monthly?token=${encodeURIComponent(token)}&month=${encodeURIComponent(selectedMonth)}`
      );
      const json = await res.json();
      const data = json?.data;
      if (data?.buckets) {
        const totals = bucketsToTotals(data.buckets);
        setBucketsPerFile([
          {
            fileName: selectedMonthLabel,
            buckets: {},
            bucketTotals: totals,
          },
        ]);
        setStep(3);
      }
    } catch {
      setUploadError('Failed to load month data.');
    }
  }, [token, selectedMonth, selectedMonthLabel]);

  const handleSaveMonthlyTotals = useCallback(
    async (bucketsToSave: Record<string, { value: number }>) => {
      if (!token || !selectedMonth) return;
      const res = await fetch('/api/expenses/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          month: selectedMonth,
          buckets: bucketsToSave,
          finalizeImport: false,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Update failed');
      }
    },
    [token, selectedMonth]
  );

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
            <div className="mt-4 flex flex-wrap gap-3 items-center">
              <button
                type="button"
                onClick={saveEstimates}
                disabled={!token || saveStatus === 'saving'}
                className={`py-2 px-4 rounded-lg border ${theme.borderClass} ${theme.textClass} disabled:opacity-50`}
              >
                {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save estimates'}
              </button>
              {saveStatus === 'error' && <span className="text-sm text-red-500">Save failed</span>}
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={!canProceedFromEstimate}
                className="py-4 px-6 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-lg"
              >
                Continue to upload
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <div
            className={`p-6 rounded-lg mb-6 ${
              darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'
            }`}
          >
            <h2 className={`text-xl font-light mb-2 ${theme.textClass}`}>Statement by month</h2>
            <p className={`text-sm mb-4 ${theme.textSecondaryClass}`}>
              You can go back up to 6 months. Each month can be imported once; after that you edit totals manually.
            </p>
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${theme.textClass}`}>Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setUploadError(null);
                }}
                className={`w-full max-w-xs p-3 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} ${theme.textClass}`}
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div
              className={`mb-6 p-4 rounded-lg border ${darkMode ? 'bg-slate-900/40 border-slate-600' : 'bg-gray-50 border-gray-200'}`}
            >
              <h3 className={`text-sm font-medium mb-2 ${theme.textClass}`}>Summary — {selectedMonthLabel}</h3>
              <p className={`text-sm ${theme.textSecondaryClass}`}>
                Your estimates total: {formatCurrency(estimateTotal, currency)}
              </p>
              {monthlySummary ? (
                <>
                  <p className={`text-sm mt-1 ${theme.textClass}`}>
                    Expenses for this month: {formatCurrency(monthlySummary.monthlyTotal, currency)}
                  </p>
                  <p className={`text-sm mt-1 ${theme.textSecondaryClass}`}>
                    {monthlySummary.diff === 0
                      ? 'Matches your estimates.'
                      : monthlySummary.diff > 0
                        ? `About ${monthlySummary.pct.toFixed(0)}% over your estimates (${formatCurrency(monthlySummary.diff, currency)} more).`
                        : `About ${Math.abs(monthlySummary.pct).toFixed(0)}% under your estimates (${formatCurrency(Math.abs(monthlySummary.diff), currency)} less).`}
                  </p>
                </>
              ) : (
                <p className={`text-sm mt-1 ${theme.textSecondaryClass}`}>
                  No statement imported yet for this month. Upload a PDF to compare.
                </p>
              )}
            </div>

            {monthAlreadyImported ? (
              <div
                className={`mb-4 p-4 rounded-lg border ${darkMode ? 'bg-slate-900/50 border-slate-600' : 'bg-amber-50 border-amber-200'}`}
              >
                <p className={`text-sm font-medium ${theme.textClass}`}>
                  {selectedMonthLabel} was already imported. You can view & compare with your estimates or edit totals manually. Re-importing is not allowed.
                </p>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={handleViewAlreadyImported}
                    className="inline-flex items-center gap-2 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                  >
                    View & compare
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className={`text-sm mb-2 ${theme.textSecondaryClass}`}>
                  Upload a PDF for {selectedMonthLabel}. We extract expenses by category. Only category totals are saved; no transaction or vendor data is stored.
                </p>
                <input
                  type="file"
                  accept="application/pdf"
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
                    onClick={handleUpload}
                    disabled={uploadFiles.length === 0 || uploading}
                    className="inline-flex items-center gap-2 py-2 px-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium"
                  >
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Processing…' : 'Upload & review'}
                  </button>
                </div>
              </>
            )}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setStep(0)}
                className={`py-2 px-4 rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step === 2 && bucketsPerFile.length > 0 && bucketsPerFile[0].buckets && (
          <div className="mb-6">
            <div className="mb-4 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`py-2 px-4 rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              >
                Back
              </button>
            </div>
            <ReviewClassifyView
              initialBuckets={bucketsPerFile[0].buckets}
              currency={currency}
              darkMode={darkMode}
              theme={theme}
              monthLabel={selectedMonthLabel}
              onSave={handleSaveMonthlyFinal}
              saveStatus={saveMonthlyStatus}
            />
          </div>
        )}

        {step === 3 && (
          <>
            <div className="mb-4 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`py-2 px-4 rounded-lg border ${theme.borderClass} ${theme.textClass}`}
              >
                Back to months
              </button>
            </div>
            <CompareView
              estimatedBuckets={buckets}
              bucketsPerFile={bucketsPerFile}
              currency={currency}
              darkMode={darkMode}
              theme={theme}
              userName={userName}
              token={token}
              onSaveEstimatesToDb={saveEstimatesToDb}
              savedMonth={selectedMonth}
              onSaveMonthlyTotals={handleSaveMonthlyTotals}
            />
          </>
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
