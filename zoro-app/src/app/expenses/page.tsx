'use client';

import React, { Suspense, useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Moon, Sun, Upload } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { ExpenseBucketInput } from '@/components/expenses/ExpenseBucketInput';
import { ReviewClassifyView } from '@/components/expenses/ReviewClassifyView';
import type { ExpenseBucket } from '@/components/retirement/types';
import type { BucketsPerFile } from '@/components/expenses/types';
import { BUCKET_KEYS, ONE_OFF_BUCKET_KEYS, RECURRING_BUCKET_KEYS } from '@/components/expenses/types';
import { countryData, getCountriesSorted } from '@/components/retirement/countryData';
import { formatCurrency } from '@/components/retirement/utils';
import { AddReminderForm } from '@/components/reminders/AddReminderForm';

const EXPENSES_TOKEN_KEY = 'zoro_expenses_token';
const DEFAULT_COUNTRY = 'India';

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

function sumBucketTotals(totals: Record<string, number>, keys: readonly string[] = BUCKET_KEYS): number {
  return keys.reduce((s, k) => s + (totals[k] ?? 0), 0);
}

function formatMonthLabel(monthStr: string): string {
  const d = new Date(monthStr);
  if (Number.isNaN(d.getTime())) return monthStr;
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);
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
  const [monthsWithData, setMonthsWithData] = useState<
    Array<{ month: string; buckets: Record<string, { value: number }>; imported_at: string | null }>
  >([]);
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [sharedData, setSharedData] = useState<Record<string, unknown>>({});
  const [buckets, setBuckets] = useState<Record<string, ExpenseBucket>>(() =>
    getDefaultBuckets(DEFAULT_COUNTRY)
  );
  const [bucketsPerFile, setBucketsPerFile] = useState<BucketsPerFile[]>([]);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [importAccountName, setImportAccountName] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [pasteParsing, setPasteParsing] = useState(false);
  const [everSavedEstimates, setEverSavedEstimates] = useState(false);
  const [tableView, setTableView] = useState<'by_month' | 'by_bucket'>('by_month');
  const [currentImportAccountName, setCurrentImportAccountName] = useState<string | null>(null);
  const [expenseAccounts, setExpenseAccounts] = useState<Array<{ name: string; type: string }>>([]);
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
  const [actualsEdits, setActualsEdits] = useState<Record<string, number>>({});
  const [saveActualsStatus, setSaveActualsStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showManualActuals, setShowManualActuals] = useState(false);

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
          const sd = data.shared_data as Record<string, unknown>;
          const c = (sd?.expenses_country ?? sd?.default_currency) as string | undefined;
          if (typeof c === 'string' && c.trim() && (countryData as Record<string, unknown>)[c.trim()]) {
            setCountry(c.trim());
          }
          const accounts = sd?.expense_accounts;
          setExpenseAccounts(Array.isArray(accounts) ? accounts as Array<{ name: string; type: string }> : []);
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
        const hasData =
          (saved && typeof saved === 'object' && Object.keys(saved).length > 0) ||
          (data?.shared_data && typeof data.shared_data === 'object' && (data.shared_data as Record<string, unknown>)?.expenses_country);
        if (hasData) setStep(1);
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

  useEffect(() => {
    setActualsEdits({});
    setShowManualActuals(false);
  }, [selectedMonth]);

  // Fetch months list whenever we have a token (so dashboard shows for returning users)
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/expenses/monthly?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (cancelled) return;
        const data = json?.data;
        const list = Array.isArray(data) ? data : [];
        const mapped = list.map((row: { month: string; buckets: unknown; imported_at: string | null }) => ({
          month: row.month,
          buckets: (row.buckets && typeof row.buckets === 'object' && !Array.isArray(row.buckets)
            ? row.buckets
            : {}) as Record<string, { value: number }>,
          imported_at: row.imported_at ?? null,
        }));
        const filtered = mapped.filter((row) => {
          const totals = bucketsToTotals(row.buckets);
          const total = sumBucketTotals(totals);
          return row.imported_at != null || total > 0;
        });
        setMonthsWithData(filtered);
        // If user has any saved monthly data, show the dashboard (step 1) by default
        if (filtered.length > 0) setStep(1);
      } catch {
        if (!cancelled) setMonthsWithData([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const currency = countryData[country]?.currency ?? countryData['India'].currency;
  const selectedMonthLabel = monthOptions.find((o) => o.value === selectedMonth)?.label ?? selectedMonth;

  const recurringEstimateTotal = useMemo(
    () => sumBucketTotals(Object.fromEntries(BUCKET_KEYS.map((k) => [k, buckets[k]?.value ?? 0])), RECURRING_BUCKET_KEYS),
    [buckets]
  );
  const bucketAverages = useMemo(() => {
    if (monthsWithData.length === 0) return null;
    const sums: Record<string, number> = {};
    for (const k of RECURRING_BUCKET_KEYS) sums[k] = 0;
    for (const row of monthsWithData) {
      const b = row.buckets;
      for (const k of RECURRING_BUCKET_KEYS) {
        const v = b[k]?.value ?? 0;
        sums[k] += typeof v === 'number' ? v : 0;
      }
    }
    const denom = monthsWithData.length || 1;
    const avgs: Record<string, number> = {};
    for (const k of RECURRING_BUCKET_KEYS) {
      avgs[k] = sums[k] / denom;
    }
    return avgs;
  }, [monthsWithData]);
  const monthlySummary = useMemo(() => {
    if (!selectedMonthData?.buckets) return null;
    const totals = bucketsToTotals(selectedMonthData.buckets);
    const recurringTotal = sumBucketTotals(totals, RECURRING_BUCKET_KEYS);
    const oneTimeOnly = totals.one_time ?? 0;
    const travelTotal = totals.travel ?? 0;
    const oneTimeTotal = oneTimeOnly + travelTotal;
    const monthlyTotal = sumBucketTotals(totals);
    const diff = recurringTotal - recurringEstimateTotal;
    const pct = recurringEstimateTotal > 0 ? (diff / recurringEstimateTotal) * 100 : 0;
    return { recurringTotal, oneTimeTotal, oneTimeOnly, travelTotal, monthlyTotal, recurringEstimateTotal, diff, pct };
  }, [selectedMonthData, recurringEstimateTotal]);

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
      setEverSavedEstimates(true);
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
      formData.append('fileName', importAccountName.trim() || `Statement ${selectedMonthLabel}`);
      formData.append('month', selectedMonth);
      const res = await fetch('/api/expenses/parse-one-file', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error ?? json.message ?? 'Upload failed');
        return;
      }
      const data = json.data;
      const collected: BucketsPerFile[] =
        data?.fileName != null && data?.buckets
          ? [{ fileName: data.fileName, buckets: data.buckets }]
          : [];
      setBucketsPerFile(collected);
      setCurrentImportAccountName(importAccountName.trim() || null);
      setStep(2);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [token, uploadFiles, selectedMonth, selectedMonthLabel, importAccountName]);

  const handlePasteParse = useCallback(async () => {
    if (!token || !pastedText.trim()) {
      setUploadError('Paste some transaction data first.');
      return;
    }
    setPasteParsing(true);
    setUploadError(null);
    try {
      const res = await fetch('/api/expenses/parse-paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          month: selectedMonth,
          pastedText: pastedText.trim(),
          fileName: importAccountName.trim() || `Pasted ${selectedMonthLabel}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error ?? 'Parse failed');
        return;
      }
      const data = json.data;
      const collected: BucketsPerFile[] =
        data?.fileName != null && data?.buckets
          ? [{ fileName: data.fileName, buckets: data.buckets }]
          : [];
      setBucketsPerFile(collected);
      setPastedText('');
      setCurrentImportAccountName(importAccountName.trim() || null);
      setStep(2);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Parse failed');
    } finally {
      setPasteParsing(false);
    }
  }, [token, pastedText, selectedMonth, selectedMonthLabel, importAccountName]);

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
        if (currentImportAccountName) {
          const accounts = Array.isArray(sharedData.expense_accounts) ? [...(sharedData.expense_accounts as Array<{ name: string; type: string }>)] : [];
          if (!accounts.some((a) => a.name === currentImportAccountName)) {
            accounts.push({ name: currentImportAccountName, type: 'expense' });
            setExpenseAccounts(accounts);
            setSharedData((prev) => ({ ...prev, expense_accounts: accounts }));
            await fetch('/api/user-data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token,
                formType: 'expenses',
                sharedData: { ...sharedData, expense_accounts: accounts },
              }),
            });
          }
        }
        setCurrentImportAccountName(null);
        setTimeout(() => setSaveMonthlyStatus('idle'), 2000);
        setStep(1);
      } catch {
        setSaveMonthlyStatus('error');
      }
    },
    [token, selectedMonth, currentImportAccountName, sharedData]
  );

  const handleSaveManualActuals = useCallback(async () => {
    if (!token || !selectedMonth) return;
    setSaveActualsStatus('saving');
    try {
      const bucketsToSave: Record<string, { value: number }> = {};
      for (const k of BUCKET_KEYS) {
        const v = actualsEdits[k] ?? selectedMonthData?.buckets?.[k]?.value ?? 0;
        bucketsToSave[k] = { value: typeof v === 'number' ? v : 0 };
      }
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
        throw new Error(json.error ?? 'Save failed');
      }
      setSaveActualsStatus('saved');
      setActualsEdits({});
      const refetch = await fetch(
        `/api/expenses/monthly?token=${encodeURIComponent(token)}&month=${encodeURIComponent(selectedMonth)}`
      );
      const json = await refetch.json();
      const data = json?.data;
      setMonthAlreadyImported(!!data?.imported_at);
      if (data?.buckets && typeof data.buckets === 'object' && !Array.isArray(data.buckets)) {
        setSelectedMonthData({ buckets: data.buckets as Record<string, { value: number }> });
      }
      setMonthsWithData((prev) => {
        const monthDate = `${selectedMonth}-01`;
        const buckets = (data?.buckets ?? {}) as Record<string, { value: number }>;
        const totals = bucketsToTotals(buckets);
        const total = sumBucketTotals(totals);
        const hasData = (data?.imported_at != null) || total > 0;
        const existing = prev.find((r) => r.month.startsWith(selectedMonth));
        if (!hasData) {
          return existing ? prev.filter((r) => !r.month.startsWith(selectedMonth)) : prev;
        }
        const row = { month: monthDate, buckets, imported_at: data?.imported_at ?? null };
        return existing
          ? prev.map((r) => (r.month.startsWith(selectedMonth) ? row : r))
          : [row, ...prev];
      });
      setTimeout(() => setSaveActualsStatus('idle'), 2000);
    } catch {
      setSaveActualsStatus('error');
    }
  }, [token, selectedMonth, actualsEdits, selectedMonthData]);

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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 min-w-0 overflow-x-hidden">
        <h1 className={`text-2xl font-light mb-2 ${theme.textClass}`}>Expenses</h1>
        <p className={`text-sm mb-6 sm:mb-8 ${theme.textSecondaryClass}`}>
          Set monthly estimates, then add actuals by month.
        </p>

        {step === 0 && (
          <>
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${theme.textClass}`}>Currency</label>
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
                onClick={() => {
                  if (!everSavedEstimates && typeof window !== 'undefined') {
                    const ok = window.confirm('Continue without saving your estimates?');
                    if (!ok) return;
                  }
                  setStep(1);
                }}
                disabled={!canProceedFromEstimate}
                className="py-4 px-6 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-lg"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <div
            className={`p-4 sm:p-6 rounded-lg mb-6 min-w-0 overflow-x-auto ${
              darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setTableView('by_month')}
                  className={`px-2 py-1 rounded ${
                    tableView === 'by_month'
                      ? darkMode
                        ? 'bg-slate-700 text-white'
                        : 'bg-blue-500 text-white'
                      : darkMode
                        ? 'text-slate-300'
                        : 'text-slate-600'
                  }`}
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => setTableView('by_bucket')}
                  className={`px-2 py-1 rounded ${
                    tableView === 'by_bucket'
                      ? darkMode
                        ? 'bg-slate-700 text-white'
                        : 'bg-blue-500 text-white'
                      : darkMode
                        ? 'text-slate-300'
                        : 'text-slate-600'
                  }`}
                >
                  Bucket
                </button>
              </div>
              <button
                type="button"
                onClick={() => setStep(0)}
                className={`py-2 px-4 rounded-lg border ${theme.borderClass} ${theme.textClass} text-sm`}
              >
                Change estimates
              </button>
            </div>

            {monthsWithData.length > 0 && (
              <div className={`mb-6 overflow-x-auto rounded-lg border ${darkMode ? 'border-slate-600' : 'border-gray-200'}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b ${darkMode ? 'border-slate-600' : 'border-gray-200'}`}>
                      <th className={`text-left px-4 py-2 font-medium ${theme.textSecondaryClass}`}>{tableView === 'by_month' ? 'Month' : 'Bucket'}</th>
                      <th className={`text-right px-4 py-2 font-medium ${theme.textSecondaryClass}`}>Expenses</th>
                      <th className={`text-right px-4 py-2 font-medium ${theme.textSecondaryClass}`}>Vs estimates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableView === 'by_month'
                      ? monthsWithData.map((row) => {
                          const totals = bucketsToTotals(row.buckets);
                          const recurringTotal = sumBucketTotals(totals, RECURRING_BUCKET_KEYS);
                          const total = sumBucketTotals(totals);
                          const diff = recurringTotal - recurringEstimateTotal;
                          const pct = recurringEstimateTotal > 0 ? (diff / recurringEstimateTotal) * 100 : 0;
                          const monthKey = row.month.slice(0, 7);
                          const isSelected = monthKey === selectedMonth;
                          const amountPart =
                            diff === 0
                              ? '—'
                              : diff > 0
                                ? `+${formatCurrency(diff, currency)}`
                                : formatCurrency(-diff, currency);
                          const pctPart =
                            diff === 0 ? null : diff > 0 ? `+${pct.toFixed(0)}%` : `-${Math.abs(pct).toFixed(0)}%`;
                          const pctClass =
                            diff === 0 ? theme.textSecondaryClass : diff > 0 ? 'text-red-400' : 'text-emerald-400';
                          return (
                            <tr
                              key={row.month}
                              className={`border-b last:border-b-0 ${
                                darkMode ? 'border-slate-600' : 'border-gray-200'
                              } ${isSelected ? (darkMode ? 'bg-slate-700/30' : 'bg-blue-50/50') : ''}`}
                            >
                              <td className={`px-4 py-2 ${theme.textClass}`}>
                                {formatMonthLabel(row.month)}
                              </td>
                              <td className={`px-4 py-2 text-right ${theme.textClass}`}>
                                {formatCurrency(total, currency)}
                              </td>
                              <td className={`px-4 py-2 text-right ${theme.textSecondaryClass}`}>
                                {diff === 0 ? (
                                  amountPart
                                ) : (
                                  <>
                                    {amountPart}{' '}
                                    <span className={pctClass}>({pctPart})</span>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      : RECURRING_BUCKET_KEYS.map((key) => {
                          const avg = bucketAverages?.[key] ?? 0;
                          const est = buckets[key]?.value ?? 0;
                          const diff = avg - est;
                          const pct = est > 0 ? (diff / est) * 100 : 0;
                          const amountPart =
                            diff === 0
                              ? '—'
                              : diff > 0
                                ? `+${formatCurrency(diff, currency)}`
                                : formatCurrency(-diff, currency);
                          const pctPart =
                            diff === 0 ? null : diff > 0 ? `+${pct.toFixed(0)}%` : `-${Math.abs(pct).toFixed(0)}%`;
                          const pctClass =
                            diff === 0 ? theme.textSecondaryClass : diff > 0 ? 'text-red-400' : 'text-emerald-400';
                          return (
                            <tr
                              key={key}
                              className={`border-b last:border-b-0 ${darkMode ? 'border-slate-600' : 'border-gray-200'}`}
                            >
                              <td className={`px-4 py-2 ${theme.textClass}`}>
                                {buckets[key]?.label ?? key}
                              </td>
                              <td className={`px-4 py-2 text-right ${theme.textClass}`}>
                                {formatCurrency(avg, currency)}
                              </td>
                              <td className={`px-4 py-2 text-right ${theme.textSecondaryClass}`}>
                                {diff === 0 ? (
                                  amountPart
                                ) : (
                                  <>
                                    {amountPart}{' '}
                                    <span className={pctClass}>({pctPart})</span>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    <tr aria-hidden="true">
                      <td colSpan={3} className="py-2" />
                    </tr>
                    <tr className={`border-t ${darkMode ? 'border-slate-600' : 'border-gray-200'}`}>
                      <td className={`px-4 py-2 font-medium ${theme.textClass}`}>One-off</td>
                      <td className={`px-4 py-2 text-right ${theme.textClass}`}>
                        {formatCurrency(monthlySummary?.oneTimeOnly ?? 0, currency)}
                      </td>
                      <td className={`px-4 py-2 text-right ${theme.textSecondaryClass}`}>—</td>
                    </tr>
                    <tr className={darkMode ? 'border-slate-600' : 'border-gray-200'}>
                      <td className={`px-4 py-2 font-medium ${theme.textClass}`}>Travel</td>
                      <td className={`px-4 py-2 text-right ${theme.textClass}`}>
                        {formatCurrency(monthlySummary?.travelTotal ?? 0, currency)}
                      </td>
                      <td className={`px-4 py-2 text-right ${theme.textSecondaryClass}`}>—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

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
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className={`text-sm font-medium ${theme.textClass}`}>{selectedMonthLabel}</h3>
                <button
                  type="button"
                  onClick={() => setShowManualActuals((prev) => !prev)}
                  className={`py-1 px-2 rounded border text-xs shrink-0 ${theme.borderClass} ${theme.textClass}`}
                >
                  {showManualActuals ? 'Hide' : 'Edit'}
                </button>
              </div>
              <p className={`text-sm ${theme.textSecondaryClass}`}>
                Recurring estimate: {formatCurrency(recurringEstimateTotal, currency)}
              </p>
              {monthlySummary != null ? (
                <>
                  <p className={`text-sm mt-1 ${theme.textClass}`}>
                    Recurring: {formatCurrency(monthlySummary.recurringTotal, currency)}
                  </p>
                  {(monthlySummary.oneTimeOnly > 0 || monthlySummary.travelTotal > 0) && (
                    <>
                      {monthlySummary.oneTimeOnly > 0 && (
                        <p className={`text-sm mt-1 ${theme.textSecondaryClass}`}>
                          One-off: {formatCurrency(monthlySummary.oneTimeOnly, currency)}
                        </p>
                      )}
                      {monthlySummary.travelTotal > 0 && (
                        <p className={`text-sm mt-2 ${theme.textSecondaryClass}`}>
                          Travel: {formatCurrency(monthlySummary.travelTotal, currency)}
                        </p>
                      )}
                    </>
                  )}
                  <p className={`text-sm mt-1 ${theme.textSecondaryClass}`}>
                    {monthlySummary.diff === 0
                      ? 'Matches estimates.'
                      : monthlySummary.diff > 0
                        ? `${monthlySummary.pct.toFixed(0)}% over (${formatCurrency(monthlySummary.diff, currency)} more).`
                        : `${Math.abs(monthlySummary.pct).toFixed(0)}% under (${formatCurrency(Math.abs(monthlySummary.diff), currency)} less).`}
                  </p>
                </>
              ) : (
                <p className={`text-sm mt-1 ${theme.textSecondaryClass}`}>No data. Upload, paste, or enter below.</p>
              )}
            </div>

            {showManualActuals && (
              <div
                className={`mb-6 p-4 rounded-lg border ${darkMode ? 'bg-slate-800/60 border-slate-600' : 'bg-white border-gray-200'}`}
              >
                <h3 className={`text-sm font-medium mb-2 ${theme.textClass}`}>{selectedMonthLabel}</h3>
                <p className={`text-xs mb-3 ${theme.textSecondaryClass}`}>
                  Enter amounts per category. Saving overwrites imported data.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`border-b ${darkMode ? 'border-slate-600' : 'border-gray-200'}`}>
                        <th className={`text-left py-2 pr-4 font-medium ${theme.textSecondaryClass}`}>Category</th>
                        <th className={`text-right py-2 pr-4 font-medium ${theme.textSecondaryClass}`}>Estimate</th>
                        <th className={`text-right py-2 pl-4 font-medium ${theme.textSecondaryClass}`}>Actual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {BUCKET_KEYS.map((k) => {
                        const estimate = buckets[k]?.value ?? 0;
                        const actual = actualsEdits[k] ?? selectedMonthData?.buckets?.[k]?.value ?? 0;
                        return (
                          <tr key={k} className={`border-b last:border-b-0 ${darkMode ? 'border-slate-600' : 'border-gray-200'}`}>
                            <td className={`py-2 pr-4 ${theme.textClass}`}>{buckets[k]?.label ?? k}</td>
                            <td className={`py-2 pr-4 text-right ${theme.textSecondaryClass}`}>
                              {formatCurrency(estimate, currency)}
                            </td>
                            <td className="py-2 pl-4">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={actual}
                                onChange={(e) =>
                                  setActualsEdits((prev) => ({ ...prev, [k]: parseFloat(e.target.value) || 0 }))
                                }
                                className={`w-28 px-2 py-1.5 rounded border text-right text-sm ${
                                  darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'
                                } ${theme.textClass}`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveManualActuals}
                    disabled={saveActualsStatus === 'saving'}
                    className={`py-2 px-4 rounded-lg border ${theme.borderClass} ${theme.textClass} text-sm font-medium disabled:opacity-50`}
                  >
                    {saveActualsStatus === 'saving' ? 'Saving…' : saveActualsStatus === 'saved' ? 'Saved' : 'Save actuals'}
                  </button>
                  {saveActualsStatus === 'error' && <span className="text-sm text-red-500">Save failed</span>}
                </div>
              </div>
            )}

            {expenseAccounts.length > 0 && (
              <p className={`mb-2 text-xs ${theme.textSecondaryClass}`}>
                Accounts: {expenseAccounts.map((a) => a.name).join(', ')}
              </p>
            )}
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className={`block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-500 file:text-white hover:file:bg-blue-600 ${theme.textClass}`}
            />
            <p className={`mt-1 text-xs ${theme.textSecondaryClass}`}>
              File must not be password-protected. If it is, copy and paste the transactions instead.
            </p>
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
                {uploading ? 'Processing…' : 'Upload PDF & review'}
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-600">
              <label className={`block text-sm font-medium mb-2 ${theme.textClass}`}>Or paste</label>
              <p className={`mb-2 text-xs ${theme.textSecondaryClass}`}>
                Include table headers when pasting. For multi-page statements, paste the full table (with headers) once per page.
              </p>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="e.g.&#10;Date, Description, Amount&#10;2025-01-15, Grocery Store, 85.20&#10;2025-01-16, Gas Station, 45.00"
                rows={5}
                className={`w-full p-3 rounded-lg border text-sm font-mono ${
                  darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'
                } ${theme.textClass}`}
              />
              <div className="mt-2">
                <button
                  type="button"
                  onClick={handlePasteParse}
                  disabled={!pastedText.trim() || pasteParsing}
                  className="inline-flex items-center gap-2 py-2 px-4 rounded-lg border border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pasteParsing ? 'Parsing…' : 'Parse & review'}
                </button>
              </div>
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

        <AddReminderForm token={token} context="expenses" defaultDescription="Update expenses" darkMode={darkMode} theme={theme} />
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
