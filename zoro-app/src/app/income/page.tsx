'use client';

import React, { Suspense, useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Moon, Sun, HelpCircle } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { countryData, getCountriesSorted } from '@/components/retirement/countryData';
import { formatInputValue, parseInputValue } from '@/components/retirement/utils';

const INCOME_TOKEN_KEY = 'zoro_income_token';
const DEFAULT_COUNTRY = 'India';
const DEFAULT_RSU_CURRENCY = 'US';

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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [gateEmail, setGateEmail] = useState('');
  const [gateSending, setGateSending] = useState(false);
  const [gateMessage, setGateMessage] = useState<'idle' | 'sent' | 'not_registered' | 'error'>('idle');
  const [gateError, setGateError] = useState<string | null>(null);

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
          if (typeof i.job === 'string') setJob(i.job);
          if (typeof i.baseSalary === 'number') setBaseSalary(i.baseSalary);
          if (typeof i.bonus === 'number') setBonus(i.bonus);
          if (typeof i.bonusPct === 'number') setBonusPct(i.bonusPct);
          if (typeof i.rsuValue === 'number') setRsuValue(i.rsuValue);
          if (typeof i.rsuCurrency === 'string' && (countryData as Record<string, unknown>)[i.rsuCurrency]) {
            setRsuCurrency(i.rsuCurrency as string);
          }
          if (typeof i.effectiveTaxRate === 'number') setEffectiveTaxRate(i.effectiveTaxRate);
          if (typeof i.currency === 'string' && (countryData as Record<string, unknown>)[i.currency]) {
            setCountry(i.currency);
          }
        }
      } catch {
        if (!cancelled) setUserName('');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

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
    try {
      const res = await fetch('/api/user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          formType: 'income',
          formData: {
            job: job.trim(),
            baseSalary: baseSalary === '' ? undefined : Number(baseSalary),
            bonus: bonus === '' ? undefined : Number(bonus),
            bonusPct: bonusPct === '' ? undefined : Number(bonusPct),
            rsuValue: rsuValue === '' ? undefined : Number(rsuValue),
            rsuCurrency: rsuCurrency,
            effectiveTaxRate: effectiveTaxRate === '' ? undefined : Number(effectiveTaxRate),
            currency: country,
          },
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
  }, [token, job, baseSalary, bonus, bonusPct, rsuValue, rsuCurrency, effectiveTaxRate, country, sharedData]);

  const currency = (countryData as Record<string, { currency?: string }>)[country]?.currency ?? '₹';

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
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className={`text-2xl font-light mb-2 ${theme.textClass}`}>Income details</h1>
        <p className={`text-sm mb-2 ${theme.textSecondaryClass}`}>
          Job, base salary, and bonus. We only store high-level numbers—no statements or documents.
        </p>

        <div className={`p-6 rounded-lg mb-6 ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'}`}>
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
        </div>
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
