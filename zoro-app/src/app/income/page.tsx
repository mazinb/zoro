'use client';

import React, { Suspense, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Moon, Sun, HelpCircle, Upload, X } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { countryData, getCountriesSorted } from '@/components/retirement/countryData';
import { formatInputValue, parseInputValue } from '@/components/retirement/utils';
import { AddReminderForm } from '@/components/reminders/AddReminderForm';

const INCOME_TOKEN_KEY = 'zoro_income_token';
const DEFAULT_COUNTRY = 'India';
const DEFAULT_RSU_CURRENCY = 'US';

export type YearlyIncome = {
  job?: string;
  baseSalary?: number;
  bonus?: number;
  bonusPct?: number;
  rsuValue?: number;
  rsuCurrency?: string;
  effectiveTaxRate?: number;
  currency?: string;
};

function currentYear(): string {
  return String(new Date().getFullYear());
}

function incomeToForm(y: YearlyIncome | undefined, countryDataRecord: Record<string, unknown>): Partial<{
  job: string; baseSalary: number | ''; bonus: number | ''; bonusPct: number | ''; rsuValue: number | ''; rsuCurrency: string; effectiveTaxRate: number | ''; country: string;
}> {
  if (!y || typeof y !== 'object') return {};
  const cd = countryDataRecord as Record<string, { currency?: string }>;
  return {
    job: typeof y.job === 'string' ? y.job : '',
    baseSalary: typeof y.baseSalary === 'number' ? y.baseSalary : '',
    bonus: typeof y.bonus === 'number' ? y.bonus : '',
    bonusPct: typeof y.bonusPct === 'number' ? y.bonusPct : '',
    rsuValue: typeof y.rsuValue === 'number' ? y.rsuValue : '',
    rsuCurrency: typeof y.rsuCurrency === 'string' && cd[y.rsuCurrency] ? y.rsuCurrency : DEFAULT_RSU_CURRENCY,
    effectiveTaxRate: typeof y.effectiveTaxRate === 'number' ? y.effectiveTaxRate : '',
    country: typeof y.currency === 'string' && cd[y.currency] ? y.currency : DEFAULT_COUNTRY,
  };
}

function formToYearly(
  job: string, baseSalary: number | '', bonus: number | '', bonusPct: number | '', rsuValue: number | '', rsuCurrency: string, effectiveTaxRate: number | '', country: string
): YearlyIncome {
  return {
    job: job.trim() || undefined,
    baseSalary: baseSalary === '' ? undefined : Number(baseSalary),
    bonus: bonus === '' ? undefined : Number(bonus),
    bonusPct: bonusPct === '' ? undefined : Number(bonusPct),
    rsuValue: rsuValue === '' ? undefined : Number(rsuValue),
    rsuCurrency: rsuCurrency || undefined,
    effectiveTaxRate: effectiveTaxRate === '' ? undefined : Number(effectiveTaxRate),
    currency: country || undefined,
  };
}

function IncomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);

  const [token, setTokenState] = useState<string | null>(null);
  const [sharedData, setSharedData] = useState<Record<string, unknown>>({});
  const [userName, setUserName] = useState('');
  const [job, setJob] = useState('');
  const [baseSalary, setBaseSalary] = useState<number | ''>('');
  const [bonus, setBonus] = useState<number | ''>('');
  const [bonusPct, setBonusPct] = useState<number | ''>('');
  const [rsuValue, setRsuValue] = useState<number | ''>('');
  const [rsuCurrency, setRsuCurrency] = useState(DEFAULT_RSU_CURRENCY);
  const [showRsuCurrencyDropdown, setShowRsuCurrencyDropdown] = useState(false);
  const [effectiveTaxRate, setEffectiveTaxRate] = useState<number | ''>('');
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [yearly, setYearly] = useState<Record<string, YearlyIncome>>({});
  const [selectedYear, setSelectedYear] = useState<string>(() => currentYear());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [gateEmail, setGateEmail] = useState('');
  const [gateSending, setGateSending] = useState(false);
  const [gateMessage, setGateMessage] = useState<'idle' | 'sent' | 'not_registered' | 'error'>('idle');
  const [gateError, setGateError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [importResult, setImportResult] = useState<Record<string, YearlyIncome> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showImportReview, setShowImportReview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const urlToken = searchParams.get('token');
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem(INCOME_TOKEN_KEY) : null;
    const t = urlToken || stored || null;
    setTokenState(t);
    if (t && urlToken && typeof window !== 'undefined') sessionStorage.setItem(INCOME_TOKEN_KEY, t);
  }, [searchParams]);

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
          const c = (data.shared_data as Record<string, unknown>)?.income_country;
          if (typeof c === 'string' && c.trim() && (countryData as Record<string, unknown>)[c.trim()]) {
            setCountry(c.trim());
          }
        }
        const income = data?.income_answers;
        if (income && typeof income === 'object') {
          const i = income as Record<string, unknown>;
          const cd = countryData as Record<string, unknown>;
          let nextYearly: Record<string, YearlyIncome> = {};
          let yearToShow = currentYear();
          if (typeof i.yearly === 'object' && i.yearly !== null && !Array.isArray(i.yearly)) {
            const y = i.yearly as Record<string, YearlyIncome>;
            const years = Object.keys(y).filter((k) => /^\d{4}$/.test(k)).sort((a, b) => Number(b) - Number(a));
            nextYearly = y;
            if (years.length > 0) yearToShow = years[0];
          }
          setYearly(nextYearly);
          setSelectedYear(yearToShow);
          const fromYear = nextYearly[yearToShow];
          const source = fromYear ? incomeToForm(fromYear, cd) : incomeToForm(i as YearlyIncome, cd);
          if (typeof source.job === 'string') setJob(source.job);
          if (source.baseSalary !== undefined) setBaseSalary(source.baseSalary);
          if (source.bonus !== undefined) setBonus(source.bonus);
          if (source.bonusPct !== undefined) setBonusPct(source.bonusPct);
          if (source.rsuValue !== undefined) setRsuValue(source.rsuValue);
          if (typeof source.rsuCurrency === 'string') setRsuCurrency(source.rsuCurrency);
          if (source.effectiveTaxRate !== undefined) setEffectiveTaxRate(source.effectiveTaxRate);
          if (typeof source.country === 'string') setCountry(source.country);
        }
      } catch {
        if (!cancelled) setUserName('');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const y = yearly[selectedYear];
    const cd = countryData as Record<string, unknown>;
    const source = y ? incomeToForm(y, cd) : {};
    setJob(typeof source.job === 'string' ? source.job : '');
    setBaseSalary(source.baseSalary !== undefined ? source.baseSalary : '');
    setBonus(source.bonus !== undefined ? source.bonus : '');
    setBonusPct(source.bonusPct !== undefined ? source.bonusPct : '');
    setRsuValue(source.rsuValue !== undefined ? source.rsuValue : '');
    setRsuCurrency(typeof source.rsuCurrency === 'string' ? source.rsuCurrency : DEFAULT_RSU_CURRENCY);
    setEffectiveTaxRate(source.effectiveTaxRate !== undefined ? source.effectiveTaxRate : '');
    setCountry(typeof source.country === 'string' ? source.country : DEFAULT_COUNTRY);
  }, [selectedYear, yearly]);

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
        body: JSON.stringify({ email, redirectPath: '/income' }),
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

  const saveIncome = useCallback(async () => {
    if (!token) return;
    setSaveError(null);
    if (job.trim().length > 0 && job.trim().length < 3) {
      setSaveError('Job / employer must be at least 3 characters.');
      return;
    }
    setSaveStatus('saving');
    const currentRow = formToYearly(job, baseSalary, bonus, bonusPct, rsuValue, rsuCurrency, effectiveTaxRate, country);
    const nextYearly = { ...yearly, [selectedYear]: currentRow };
    setYearly(nextYearly);
    const topLevel = {
      job: job.trim(),
      baseSalary: baseSalary === '' ? undefined : Number(baseSalary),
      bonus: bonus === '' ? undefined : Number(bonus),
      bonusPct: bonusPct === '' ? undefined : Number(bonusPct),
      rsuValue: rsuValue === '' ? undefined : Number(rsuValue),
      rsuCurrency: rsuCurrency,
      effectiveTaxRate: effectiveTaxRate === '' ? undefined : Number(effectiveTaxRate),
      currency: country,
    };
    try {
      const res = await fetch('/api/user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          formType: 'income',
          formData: { ...topLevel, yearly: nextYearly },
          sharedData: { ...sharedData, income_country: country },
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
      setSaveError(null);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setSaveError('Save failed.');
    }
  }, [token, job, baseSalary, bonus, bonusPct, rsuValue, rsuCurrency, effectiveTaxRate, country, sharedData, yearly, selectedYear]);

  const currency = (countryData as Record<string, { currency?: string }>)[country]?.currency ?? '₹';

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !token) return;
      setImportError(null);
      setImportStatus('uploading');
      setImportResult(null);
      try {
        const formData = new FormData();
        formData.set('token', token);
        formData.set('file', file);
        const res = await fetch('/api/income/parse-statement', { method: 'POST', body: formData });
        const json = await res.json();
        if (!res.ok) {
          setImportError(json.error ?? 'Import failed');
          setImportStatus('error');
          return;
        }
        const data = json?.data?.yearly;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          setImportResult(data as Record<string, YearlyIncome>);
          setShowImportReview(true);
          setImportStatus('done');
        } else {
          setImportError('No data extracted');
          setImportStatus('error');
        }
      } catch {
        setImportError('Import failed');
        setImportStatus('error');
      }
    },
    [token]
  );

  const applyImportResult = useCallback(() => {
    if (importResult) {
      setYearly((prev) => ({ ...prev, ...importResult }));
      setImportResult(null);
      setShowImportReview(false);
    }
  }, [importResult]);

  if (!token) {
    return (
      <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
        <nav className={`border-b ${theme.borderClass}`}>
          <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
            <button onClick={() => router.push('/')} className="flex items-center cursor-pointer" aria-label="Back to home">
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
          <h1 className={`text-2xl font-light mb-2 ${theme.textClass}`}>Income details</h1>
          <p className={`text-sm mb-6 ${theme.textSecondaryClass}`}>
            Use this page only if you’re signed up with Zoro. Enter your email and we’ll send you a link.
          </p>
          <div className={`p-6 rounded-lg mb-6 ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'}`}>
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
                  This email isn’t registered. Sign up for Zoro first, then come back.
                </p>
                <button type="button" onClick={() => router.push('/')} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium">
                  Sign up for Zoro
                </button>
              </div>
            )}
            {gateMessage === 'sent' && (
              <p className={`mb-4 text-sm ${theme.textSecondaryClass}`}>Check your email and click the link to open the form.</p>
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
          <button onClick={() => router.push('/')} className="flex items-center cursor-pointer" aria-label="Back to home">
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
        <h1 className={`text-2xl font-light mb-2 ${theme.textClass}`}>Income details</h1>
        <p className={`text-sm mb-4 ${theme.textSecondaryClass}`}>
          Job, base salary, and bonus. By year; we only store high-level numbers.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleImportFile}
          aria-label="Import PDF"
        />
        {(() => {
          const yearsList = Array.from(new Set([...Object.keys(yearly), currentYear()]))
            .filter((k) => /^\d{4}$/.test(k))
            .sort((a, b) => Number(b) - Number(a));
          return (
            <div className={`mb-4 p-4 rounded-lg ${darkMode ? 'bg-slate-800/60 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-sm font-medium ${theme.textSecondaryClass}`}>Year:</span>
                {yearsList.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setSelectedYear(yr)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedYear === yr
                        ? darkMode
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-500 text-white'
                        : darkMode
                          ? 'bg-slate-700 text-gray-200 hover:bg-slate-600'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importStatus === 'uploading'}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${theme.borderClass} ${theme.textClass} disabled:opacity-50`}
                >
                  <Upload className="w-4 h-4" />
                  {importStatus === 'uploading' ? 'Importing…' : 'Import from PDF'}
                </button>
              </div>
              {importError && <p className="mt-2 text-sm text-red-500">{importError}</p>}
            </div>
          );
        })()}

        {Object.keys(yearly).length > 0 && (
          <div className={`mb-6 overflow-x-auto rounded-lg border ${darkMode ? 'border-slate-600' : 'border-gray-200'}`}>
            <h2 className={`text-sm font-medium px-4 py-2 ${darkMode ? 'bg-slate-800/50' : 'bg-gray-100'} ${theme.textClass}`}>
              Yearly summary
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${darkMode ? 'border-slate-600' : 'border-gray-200'}`}>
                  <th className={`text-left px-4 py-2 font-medium ${theme.textSecondaryClass}`}>Year</th>
                  <th className={`text-left px-4 py-2 font-medium ${theme.textSecondaryClass}`}>Job</th>
                  <th className={`text-right px-4 py-2 font-medium ${theme.textSecondaryClass}`}>Base</th>
                  <th className={`text-right px-4 py-2 font-medium ${theme.textSecondaryClass}`}>Bonus</th>
                  <th className={`text-right px-4 py-2 font-medium ${theme.textSecondaryClass}`}>RSU</th>
                  <th className={`text-right px-4 py-2 font-medium ${theme.textSecondaryClass}`}>Tax %</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(yearly)
                  .filter((k) => /^\d{4}$/.test(k))
                  .sort((a, b) => Number(b) - Number(a))
                  .map((yr) => {
                    const row = yearly[yr];
                    const cur = (countryData as Record<string, { currency?: string }>)[row?.currency ?? country]?.currency ?? '₹';
                    const base = row?.baseSalary ?? 0;
                    const bonusVal = row?.bonus ?? (row?.bonusPct != null && base ? (base * row.bonusPct) / 100 : 0);
                    const rsu = row?.rsuValue ?? 0;
                    return (
                      <tr key={yr} className={`border-b last:border-b-0 ${darkMode ? 'border-slate-600' : 'border-gray-200'}`}>
                        <td className={`px-4 py-2 font-medium ${theme.textClass}`}>{yr}</td>
                        <td className={`px-4 py-2 ${theme.textClass}`}>{row?.job || '—'}</td>
                        <td className={`px-4 py-2 text-right ${theme.textClass}`}>{base ? formatInputValue(String(base), cur) : '—'}</td>
                        <td className={`px-4 py-2 text-right ${theme.textClass}`}>{bonusVal ? formatInputValue(String(bonusVal), cur) : '—'}</td>
                        <td className={`px-4 py-2 text-right ${theme.textClass}`}>{rsu ? formatInputValue(String(rsu), (countryData as Record<string, { currency?: string }>)[row?.rsuCurrency ?? 'US']?.currency ?? '$') : '—'}</td>
                        <td className={`px-4 py-2 text-right ${theme.textSecondaryClass}`}>{row?.effectiveTaxRate != null ? `${row.effectiveTaxRate}%` : '—'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        <div className={`p-6 rounded-lg mb-6 ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'}`}>
          <p className={`text-sm mb-4 ${theme.textSecondaryClass}`}>Editing year {selectedYear}</p>
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${theme.textClass}`}>Currency</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                className={`w-full flex items-center justify-between gap-2 p-3 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} ${theme.textClass}`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-xl">{(countryData as Record<string, { flag?: string }>)[country]?.flag ?? '🌍'}</span>
                  <span>{country}</span>
                  <span className={theme.textSecondaryClass}>({currency})</span>
                </span>
                <svg className={`w-5 h-5 ${showCountryDropdown ? 'rotate-180' : ''} ${theme.textSecondaryClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showCountryDropdown && (
                <div className={`absolute z-10 w-full mt-2 rounded-lg shadow-xl ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'}`}>
                  {getCountriesSorted().map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setCountry(c); setShowCountryDropdown(false); }}
                      className={`w-full p-4 text-left flex items-center gap-3 ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'} ${theme.textClass}`}
                    >
                      <span className="text-2xl">{(countryData as Record<string, { flag?: string }>)[c]?.flag ?? '🌍'}</span>
                      <span>{c}</span>
                      <span className={theme.textSecondaryClass}>{(countryData as Record<string, { currency?: string }>)[c]?.currency ?? ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label className={`block text-sm font-medium mb-1 ${theme.textClass}`}>Job / employer</label>
            <input
              type="text"
              value={job}
              onChange={(e) => setJob(e.target.value)}
              placeholder="e.g. Agoda, Software Engineer"
              className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
            />
          </div>
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-1 ${theme.textClass}`}>Base salary (optional)</label>
            <input
              type="text"
              value={baseSalary !== '' ? formatInputValue(String(baseSalary), currency) : ''}
              onChange={(e) => {
                const parsed = parseInputValue(e.target.value);
                setBaseSalary(parsed === '' ? '' : Number(parsed));
              }}
              placeholder="e.g. 50l, 10k, 2c"
              className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
            />
          </div>
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-1 ${theme.textClass}`}>Bonus (optional)</label>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[120px]">
                <input
                  type="text"
                  value={bonus !== '' ? formatInputValue(String(bonus), currency) : ''}
                  onChange={(e) => {
                    const parsed = parseInputValue(e.target.value);
                    setBonus(parsed === '' ? '' : Number(parsed));
                  }}
                  placeholder="e.g. 50l, 10k, 2c"
                  className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
                />
              </div>
              <span className={theme.textSecondaryClass}>or</span>
              <div className="flex-1 min-w-[100px]">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={bonusPct === '' ? '' : bonusPct}
                  onChange={(e) => setBonusPct(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="% of base"
                  className={`w-full px-3 py-2 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
                />
              </div>
            </div>
          </div>

          <div className={`mb-4 p-4 rounded-lg border ${darkMode ? 'border-slate-600 bg-slate-900/40' : 'border-gray-200 bg-gray-50'}`}>
            <label className={`block text-sm font-medium mb-2 ${theme.textClass}`}>
              RSUs / stock options (optional)
              <span className="inline-flex items-center ml-1" title="Average pre-tax value (e.g. grant or vesting value for the year).">
                <HelpCircle className="w-4 h-4 text-slate-400 cursor-help" aria-label="Tooltip" />
              </span>
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={rsuValue !== '' ? formatInputValue(String(rsuValue), (countryData as Record<string, { currency?: string }>)[rsuCurrency]?.currency ?? '$') : ''}
                onChange={(e) => {
                  const parsed = parseInputValue(e.target.value);
                  setRsuValue(parsed === '' ? '' : Number(parsed));
                }}
                placeholder="e.g. 10k, 2m"
                className={`w-32 px-3 py-2 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
              />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowRsuCurrencyDropdown(!showRsuCurrencyDropdown)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'} ${theme.textClass} text-sm`}
                >
                  <span>{(countryData as Record<string, { flag?: string }>)[rsuCurrency]?.flag ?? '🌍'}</span>
                  <span>{(countryData as Record<string, { currency?: string }>)[rsuCurrency]?.currency ?? '$'}</span>
                  <svg className={`w-4 h-4 ${showRsuCurrencyDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showRsuCurrencyDropdown && (
                  <div className={`absolute left-0 top-full mt-1 z-20 py-1 min-w-[120px] rounded-lg shadow-lg border ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'}`}>
                    {getCountriesSorted().map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => { setRsuCurrency(c); setShowRsuCurrencyDropdown(false); }}
                        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'} ${theme.textClass}`}
                      >
                        <span>{(countryData as Record<string, { flag?: string }>)[c]?.flag ?? '🌍'}</span>
                        <span>{(countryData as Record<string, { currency?: string }>)[c]?.currency ?? ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className={`block text-sm font-medium mb-1 ${theme.textClass}`}>
              Effective tax rate % (optional)
              <span className="inline-flex items-center ml-1" title="Blended effective rate across income (salary, bonus, RSU, etc.).">
                <HelpCircle className="w-4 h-4 text-slate-400 cursor-help" aria-label="Tooltip" />
              </span>
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={effectiveTaxRate === '' ? '' : effectiveTaxRate}
              onChange={(e) => setEffectiveTaxRate(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g. 25"
              className={`w-24 px-3 py-2 rounded-lg border ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
            />
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              onClick={saveIncome}
              disabled={saveStatus === 'saving'}
              className={`py-2 px-4 rounded-lg border ${theme.borderClass} ${theme.textClass} disabled:opacity-50`}
            >
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save'}
            </button>
            {saveError && <span className="text-sm text-red-500">{saveError}</span>}
            {saveStatus === 'error' && !saveError && <span className="text-sm text-red-500">Save failed</span>}
          </div>
          <AddReminderForm token={token} context="income" defaultDescription="Update income" darkMode={darkMode} theme={theme} />
        </div>

        {showImportReview && importResult && Object.keys(importResult).length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="import-review-title">
            <div className={`max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl shadow-xl ${darkMode ? 'bg-slate-800 border border-slate-600' : 'bg-white border border-gray-200'}`}>
              <div className="flex items-center justify-between p-4 border-b border-slate-600 border-gray-200">
                <h2 id="import-review-title" className={`text-lg font-medium ${theme.textClass}`}>Review import</h2>
                <button
                  type="button"
                  onClick={() => { setShowImportReview(false); setImportResult(null); setImportError(null); }}
                  className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass}`}
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b ${darkMode ? 'border-slate-600' : 'border-gray-200'}`}>
                      <th className={`text-left px-3 py-2 font-medium ${theme.textSecondaryClass}`}>Year</th>
                      <th className={`text-left px-3 py-2 font-medium ${theme.textSecondaryClass}`}>Job</th>
                      <th className={`text-right px-3 py-2 font-medium ${theme.textSecondaryClass}`}>Base</th>
                      <th className={`text-right px-3 py-2 font-medium ${theme.textSecondaryClass}`}>Bonus</th>
                      <th className={`text-right px-3 py-2 font-medium ${theme.textSecondaryClass}`}>RSU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(importResult)
                      .filter((k) => /^\d{4}$/.test(k))
                      .sort((a, b) => Number(b) - Number(a))
                      .map((yr) => {
                        const row = importResult[yr];
                        const cur = (countryData as Record<string, { currency?: string }>)[row?.currency ?? country]?.currency ?? '₹';
                        return (
                          <tr key={yr} className={`border-b last:border-b-0 ${darkMode ? 'border-slate-600' : 'border-gray-200'}`}>
                            <td className={`px-3 py-2 font-medium ${theme.textClass}`}>{yr}</td>
                            <td className={`px-3 py-2 ${theme.textClass}`}>{row?.job || '—'}</td>
                            <td className={`px-3 py-2 text-right ${theme.textClass}`}>{row?.baseSalary != null ? formatInputValue(String(row.baseSalary), cur) : '—'}</td>
                            <td className={`px-3 py-2 text-right ${theme.textClass}`}>{row?.bonus != null ? formatInputValue(String(row.bonus), cur) : '—'}</td>
                            <td className={`px-3 py-2 text-right ${theme.textClass}`}>{row?.rsuValue != null ? formatInputValue(String(row.rsuValue), (countryData as Record<string, { currency?: string }>)[row?.rsuCurrency ?? 'US']?.currency ?? '$') : '—'}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t border-slate-600 border-gray-200">
                <button
                  type="button"
                  onClick={() => { setShowImportReview(false); setImportResult(null); }}
                  className={`px-4 py-2 rounded-lg border ${theme.borderClass} ${theme.textClass}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyImportResult}
                  className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function IncomePageFallback() {
  const { darkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);
  return (
    <div className={`min-h-screen ${theme.bgClass} flex items-center justify-center`}>
      <p className={theme.textSecondaryClass}>Loading…</p>
    </div>
  );
}

export default function IncomePage() {
  return (
    <Suspense fallback={<IncomePageFallback />}>
      <IncomePageContent />
    </Suspense>
  );
}
