'use client';

import React, { Suspense, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Moon, Sun, Plus, Trash2, ChevronDown, ChevronUp, MessageSquare, Upload } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { countryData, getCountriesSorted } from '@/components/retirement/countryData';
import { formatInputValue, parseInputValue, formatCurrency } from '@/components/retirement/utils';
import { AddReminderForm } from '@/components/reminders/AddReminderForm';

const ASSETS_TOKEN_KEY = 'zoro_assets_token';
const DEFAULT_COUNTRY = 'India';

const ASSET_TYPES = ['savings', 'brokerage', 'property', 'crypto', 'other'] as const;
const ASSET_TYPE_LABELS: Record<(typeof ASSET_TYPES)[number], string> = {
  savings: 'Savings',
  brokerage: 'Brokerage',
  property: 'Property',
  crypto: 'Crypto',
  other: 'Other',
};

export type AssetType = (typeof ASSET_TYPES)[number];

const LIABILITY_TYPES = ['personal_loan', 'car_loan', 'credit_card', 'mortgage', 'other'] as const;
const LIABILITY_TYPE_LABELS: Record<(typeof LIABILITY_TYPES)[number], string> = {
  personal_loan: 'Personal loan',
  car_loan: 'Car loan',
  credit_card: 'Credit card',
  mortgage: 'Mortgage',
  other: 'Other',
};

export type LiabilityType = (typeof LIABILITY_TYPES)[number];

export type AssetAccountRow = {
  id: string;
  type: AssetType;
  currency: string;
  name: string;
  total: number | '';
  label: string;
  comment: string;
};

export type LiabilityRow = {
  id: string;
  type: LiabilityType;
  name: string;
  currency: string;
  total: number | '';
  comment: string;
};

export type QuarterlySnapshot = {
  quarter: string;
  captured_at: string;
  accounts: Array<{ type: string; currency: string; name?: string; total?: number; label?: string; comment?: string }>;
  liabilities: Array<{ type: string; name?: string; currency: string; total?: number; comment?: string }>;
};

function getQuarterKey(date: Date): string {
  const y = date.getFullYear();
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `${y}-Q${q}`;
}

// Approximate rates to INR for rough total (not real-time)
const RATES_TO_INR: Record<string, number> = {
  India: 1,
  Thailand: 2.2,
  UAE: 22,
  Europe: 90,
  US: 83,
  Other: 83,
};

function nextId(): string {
  return `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function nextLiabilityId(): string {
  return `l-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function AssetsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);

  const [token, setTokenState] = useState<string | null>(null);
  const [sharedData, setSharedData] = useState<Record<string, unknown>>({});
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [accounts, setAccounts] = useState<AssetAccountRow[]>([
    { id: nextId(), type: 'savings', currency: DEFAULT_COUNTRY, name: '', total: '', label: '', comment: '' },
  ]);
  const [liabilities, setLiabilities] = useState<LiabilityRow[]>([]);
  const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);
  const [expandedLiabilityCommentId, setExpandedLiabilityCommentId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [gateEmail, setGateEmail] = useState('');
  const [gateSending, setGateSending] = useState(false);
  const [gateMessage, setGateMessage] = useState<'idle' | 'sent' | 'not_registered' | 'error'>('idle');
  const [gateError, setGateError] = useState<string | null>(null);
  const [quarterlySnapshots, setQuarterlySnapshots] = useState<QuarterlySnapshot[]>([]);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const importTargetRef = useRef<{ kind: 'account' | 'liability'; id: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const urlToken = searchParams.get('token');
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem(ASSETS_TOKEN_KEY) : null;
    const t = urlToken || stored || null;
    setTokenState(t);
    if (t && urlToken && typeof window !== 'undefined') sessionStorage.setItem(ASSETS_TOKEN_KEY, t);
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
        if (data?.shared_data && typeof data.shared_data === 'object' && !Array.isArray(data.shared_data)) {
          setSharedData(data.shared_data as Record<string, unknown>);
          const c = (data.shared_data as Record<string, unknown>)?.assets_country;
          if (typeof c === 'string' && c.trim() && (countryData as Record<string, unknown>)[c.trim()]) {
            setCountry(c.trim());
          }
        }
        const assets = data?.assets_answers;
        if (assets && typeof assets === 'object') {
          const a = assets as {
            currency?: string;
            accounts?: Array<{
              type?: string;
              currency?: string;
              name?: string;
              total?: number;
              label?: string;
              comment?: string;
            }>;
            liabilities?: Array<{
              type?: string;
              name?: string;
              currency?: string;
              total?: number;
              comment?: string;
            }>;
          };
          if (typeof a.currency === 'string' && (countryData as Record<string, unknown>)[a.currency]) {
            setCountry(a.currency);
          }
          if (Array.isArray(a.accounts) && a.accounts.length > 0) {
            setAccounts(
              a.accounts.map((row) => {
                const type = ASSET_TYPES.includes((row.type as AssetType) ?? '') ? (row.type as AssetType) : 'savings';
                return {
                  id: nextId(),
                  type,
                  currency: typeof row.currency === 'string' && (countryData as Record<string, unknown>)[row.currency] ? row.currency : DEFAULT_COUNTRY,
                  name: typeof row.name === 'string' ? row.name : '',
                  total: typeof row.total === 'number' ? row.total : '',
                  label: typeof row.label === 'string' ? row.label : '',
                  comment: typeof row.comment === 'string' ? row.comment : '',
                };
              })
            );
          }
          if (Array.isArray(a.liabilities) && a.liabilities.length > 0) {
            setLiabilities(
              a.liabilities.map((row) => {
                const type = LIABILITY_TYPES.includes((row.type as LiabilityType) ?? '') ? (row.type as LiabilityType) : 'personal_loan';
                return {
                  id: nextLiabilityId(),
                  type,
                  name: typeof row.name === 'string' ? row.name : '',
                  currency: typeof row.currency === 'string' && (countryData as Record<string, unknown>)[row.currency] ? row.currency : DEFAULT_COUNTRY,
                  total: typeof row.total === 'number' ? row.total : '',
                  comment: typeof row.comment === 'string' ? row.comment : '',
                };
              })
            );
          }
          const snapshots = (a as { quarterly_snapshots?: unknown }).quarterly_snapshots;
          if (Array.isArray(snapshots) && snapshots.length > 0) {
            const valid = snapshots.filter(
              (s): s is QuarterlySnapshot =>
                s != null &&
                typeof s === 'object' &&
                typeof (s as QuarterlySnapshot).quarter === 'string' &&
                typeof (s as QuarterlySnapshot).captured_at === 'string' &&
                Array.isArray((s as QuarterlySnapshot).accounts) &&
                Array.isArray((s as QuarterlySnapshot).liabilities)
            );
            setQuarterlySnapshots(valid);
          }
        }
      } catch {
        // keep defaults
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
        body: JSON.stringify({ email, redirectPath: '/assets' }),
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

  const addRow = useCallback(() => {
    setAccounts((prev) => [
      ...prev,
      { id: nextId(), type: 'savings', currency: DEFAULT_COUNTRY, name: '', total: '', label: '', comment: '' },
    ]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setAccounts((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }, []);

  const updateRow = useCallback((id: string, field: keyof AssetAccountRow, value: string | number) => {
    setAccounts((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }, []);

  const toggleComment = useCallback((id: string) => {
    setExpandedCommentId((prev) => (prev === id ? null : id));
  }, []);

  const addLiability = useCallback(() => {
    setLiabilities((prev) => [
      ...prev,
      { id: nextLiabilityId(), type: 'personal_loan', name: '', currency: DEFAULT_COUNTRY, total: '', comment: '' },
    ]);
  }, []);

  const removeLiability = useCallback((id: string) => {
    setLiabilities((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateLiability = useCallback((id: string, field: keyof LiabilityRow, value: string | number) => {
    setLiabilities((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }, []);

  const toggleLiabilityComment = useCallback((id: string) => {
    setExpandedLiabilityCommentId((prev) => (prev === id ? null : id));
  }, []);

  const triggerImport = useCallback((kind: 'account' | 'liability', id: string) => {
    if (!token) return;
    setImportError(null);
    importTargetRef.current = { kind, id };
    fileInputRef.current?.click();
  }, [token]);

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      const target = importTargetRef.current;
      importTargetRef.current = null;
      if (!file || !token || !target) return;
      setImportingId(target.id);
      setImportError(null);
      try {
        const formData = new FormData();
        formData.set('token', token);
        formData.set('kind', target.kind);
        formData.set('file', file);
        const res = await fetch('/api/assets/parse-document', { method: 'POST', body: formData });
        const json = await res.json();
        if (!res.ok) {
          setImportError(json.error ?? 'Import failed');
          setImportingId(null);
          return;
        }
        const d = json?.data;
        if (target.kind === 'account' && d) {
          setAccounts((prev) =>
            prev.map((r) =>
              r.id !== target.id
                ? r
                : {
                    ...r,
                    name: typeof d.name === 'string' ? d.name : r.name,
                    type: d.type && ASSET_TYPES.includes(d.type as AssetType) ? (d.type as AssetType) : r.type,
                    currency: typeof d.currency === 'string' && (countryData as Record<string, unknown>)[d.currency] ? d.currency : r.currency,
                    total: typeof d.total === 'number' ? d.total : r.total,
                  }
            )
          );
        } else if (target.kind === 'liability' && d) {
          setLiabilities((prev) =>
            prev.map((r) =>
              r.id !== target.id
                ? r
                : {
                    ...r,
                    name: typeof d.name === 'string' ? d.name : r.name,
                    type: d.type && LIABILITY_TYPES.includes(d.type as LiabilityType) ? (d.type as LiabilityType) : r.type,
                    currency: typeof d.currency === 'string' && (countryData as Record<string, unknown>)[d.currency] ? d.currency : r.currency,
                    total: typeof d.total === 'number' ? d.total : r.total,
                  }
            )
          );
        }
      } catch {
        setImportError('Import failed');
      }
      setImportingId(null);
    },
    [token]
  );

  const approxTotal = useMemo(() => {
    const hasAny = accounts.some((r) => r.total !== '') || liabilities.some((r) => r.total !== '');
    if (!hasAny) return null;
    const toInr = (amount: number, countryKey: string) => amount * (RATES_TO_INR[countryKey] ?? 1);
    const assetsInr = accounts.filter((r) => r.total !== '').reduce((s, r) => s + toInr(Number(r.total), r.currency), 0);
    const liabilitiesInr = liabilities.filter((r) => r.total !== '').reduce((s, r) => s + toInr(Number(r.total), r.currency), 0);
    return { netInr: assetsInr - liabilitiesInr, assetsInr, liabilitiesInr };
  }, [accounts, liabilities]);

  const saveAssets = useCallback(async () => {
    if (!token) return;
    setSaveError(null);
    const rowsWithData = accounts.filter((r) => r.total !== '' || r.name.trim() !== '' || (r.type === 'other' && r.label.trim() !== ''));
    const liabilityRowsWithData = liabilities.filter((r) => r.name.trim() !== '' || r.total !== '');
    for (const r of rowsWithData) {
      if (r.name.trim().length < 3) {
        setSaveError('Every asset name must be at least 3 characters.');
        return;
      }
    }
    for (const r of liabilityRowsWithData) {
      if (r.name.trim().length < 3) {
        setSaveError('Every liability name must be at least 3 characters.');
        return;
      }
    }
    const toInr = (amount: number, countryKey: string) => amount * (RATES_TO_INR[countryKey] ?? 1);
    const assetsInr = accounts.filter((r) => r.total !== '').reduce((s, r) => s + toInr(Number(r.total), r.currency), 0);
    const liabilitiesInr = liabilities.filter((r) => r.total !== '').reduce((s, r) => s + toInr(Number(r.total), r.currency), 0);
    const netInr = assetsInr - liabilitiesInr;
    if (rowsWithData.length > 0 || liabilityRowsWithData.length > 0) {
      if (netInr <= 0) {
        setSaveError('Net value (assets minus liabilities) must be greater than 0.');
        return;
      }
    }
    setSaveStatus('saving');
    try {
      const accountList = accounts
        .filter((r) => r.total !== '' || (r.type === 'other' && r.label.trim() !== ''))
        .map((r) => ({
          type: r.type,
          currency: r.currency,
          name: r.name.trim() || undefined,
          total: r.total === '' ? undefined : Number(r.total),
          label: r.type === 'other' ? r.label.trim() : undefined,
          comment: r.comment.trim() || undefined,
        }));
      const liabilityList = liabilities
        .filter((r) => r.name.trim() !== '' || r.total !== '')
        .map((r) => ({
          type: r.type,
          name: r.name.trim() || undefined,
          currency: r.currency,
          total: r.total === '' ? undefined : Number(r.total),
          comment: r.comment.trim() || undefined,
        }));
      const res = await fetch('/api/user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          formType: 'assets',
          formData: {
            currency: country,
            accounts: accountList,
            liabilities: liabilityList,
            quarterly_snapshots: quarterlySnapshots,
          },
          sharedData: { ...sharedData, assets_country: country },
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
  }, [token, country, accounts, liabilities, sharedData, quarterlySnapshots]);

  const saveSnapshot = useCallback(async () => {
    if (!token) return;
    const quarter = getQuarterKey(new Date());
    const accountList = accounts
      .filter((r) => r.total !== '' || (r.type === 'other' && r.label.trim() !== ''))
      .map((r) => ({
        type: r.type,
        currency: r.currency,
        name: r.name.trim() || undefined,
        total: r.total === '' ? undefined : Number(r.total),
        label: r.type === 'other' ? r.label.trim() : undefined,
        comment: r.comment.trim() || undefined,
      }));
    const liabilityList = liabilities
      .filter((r) => r.name.trim() !== '' || r.total !== '')
      .map((r) => ({
        type: r.type,
        name: r.name.trim() || undefined,
        currency: r.currency,
        total: r.total === '' ? undefined : Number(r.total),
        comment: r.comment.trim() || undefined,
      }));
    const snapshot: QuarterlySnapshot = {
      quarter,
      captured_at: new Date().toISOString(),
      accounts: accountList,
      liabilities: liabilityList,
    };
    const nextSnapshots = [snapshot, ...quarterlySnapshots.filter((s) => s.quarter !== quarter)];
    setQuarterlySnapshots(nextSnapshots);
    setSaveError(null);
    setSaveStatus('saving');
    try {
      const accountPayload = accounts
        .filter((r) => r.total !== '' || (r.type === 'other' && r.label.trim() !== ''))
        .map((r) => ({
          type: r.type,
          currency: r.currency,
          name: r.name.trim() || undefined,
          total: r.total === '' ? undefined : Number(r.total),
          label: r.type === 'other' ? r.label.trim() : undefined,
          comment: r.comment.trim() || undefined,
        }));
      const liabilityPayload = liabilities
        .filter((r) => r.name.trim() !== '' || r.total !== '')
        .map((r) => ({
          type: r.type,
          name: r.name.trim() || undefined,
          currency: r.currency,
          total: r.total === '' ? undefined : Number(r.total),
          comment: r.comment.trim() || undefined,
        }));
      const res = await fetch('/api/user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          formType: 'assets',
          formData: {
            currency: country,
            accounts: accountPayload,
            liabilities: liabilityPayload,
            quarterly_snapshots: nextSnapshots,
          },
          sharedData: { ...sharedData, assets_country: country },
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setSaveError('Snapshot save failed.');
    }
  }, [token, country, accounts, liabilities, sharedData, quarterlySnapshots]);

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
          <h1 className={`text-2xl font-light mb-2 ${theme.textClass}`}>Assets & accounts</h1>
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
        <h1 className={`text-2xl font-light mb-2 ${theme.textClass}`}>Assets and liabilities</h1>
        <p className={`text-sm mb-2 ${theme.textSecondaryClass}`}>
          List assets and liabilities; add a snapshot to track over time. Import from a statement image or PDF to fill a row.
        </p>
        {approxTotal != null && (
          <div className={`mb-4 py-2 px-3 rounded-lg border ${theme.borderClass} ${theme.textSecondaryClass} text-sm`}>
            <span className={theme.textClass}>Net worth (approx): {formatCurrency(approxTotal.netInr, '₹')}</span>
            <p className="mt-1 text-xs opacity-80">Approximate conversion; not real-time rates.</p>
          </div>
        )}

        {quarterlySnapshots.length > 0 && (
          <div className={`mb-6 overflow-x-auto rounded-lg border ${darkMode ? 'border-slate-600' : 'border-gray-200'}`}>
            <h2 className={`text-sm font-medium px-4 py-2 ${darkMode ? 'bg-slate-800/50' : 'bg-gray-100'} ${theme.textClass}`}>
              Snapshot history
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${darkMode ? 'border-slate-600' : 'border-gray-200'}`}>
                  <th className={`text-left px-4 py-2 font-medium ${theme.textSecondaryClass}`}>Quarter</th>
                  <th className={`text-left px-4 py-2 font-medium ${theme.textSecondaryClass}`}>Captured</th>
                  <th className={`text-right px-4 py-2 font-medium ${theme.textSecondaryClass}`}>Net (approx)</th>
                </tr>
              </thead>
              <tbody>
                {quarterlySnapshots.map((s) => {
                  const toInr = (amount: number, countryKey: string) => amount * (RATES_TO_INR[countryKey] ?? 1);
                  const assetsInr = s.accounts.filter((r) => r.total != null).reduce((sum, r) => sum + toInr(Number(r.total), r.currency), 0);
                  const liabilitiesInr = s.liabilities.filter((r) => r.total != null).reduce((sum, r) => sum + toInr(Number(r.total), r.currency), 0);
                  const netInr = assetsInr - liabilitiesInr;
                  const captured = new Date(s.captured_at);
                  const capturedStr = Number.isNaN(captured.getTime()) ? s.captured_at : captured.toLocaleDateString();
                  return (
                    <tr key={`${s.quarter}-${s.captured_at}`} className={`border-b last:border-b-0 ${darkMode ? 'border-slate-600' : 'border-gray-200'}`}>
                      <td className={`px-4 py-2 font-medium ${theme.textClass}`}>{s.quarter}</td>
                      <td className={`px-4 py-2 ${theme.textSecondaryClass}`}>{capturedStr}</td>
                      <td className={`px-4 py-2 text-right ${theme.textClass}`}>{formatCurrency(netInr, '₹')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {accounts.some((a) => a.name.trim()) && (
              <details className={`border-t ${darkMode ? 'border-slate-600' : 'border-gray-200'}`}>
                <summary className={`px-4 py-2 text-sm cursor-pointer ${theme.textSecondaryClass} hover:${theme.textClass}`}>
                  By account
                </summary>
                <div className="px-4 pb-2">
                  {accounts.filter((a) => a.name.trim()).map((acc) => {
                    const history = quarterlySnapshots.map((s) => {
                      const row = s.accounts.find((r) => r.name === acc.name.trim() && r.type === acc.type);
                      const total = row?.total;
                      const cur = (countryData as Record<string, { currency?: string }>)[row?.currency ?? acc.currency]?.currency ?? '₹';
                      return { quarter: s.quarter, total, cur };
                    });
                    return (
                      <div key={`${acc.id}-hist`} className={`mt-2 text-xs ${theme.textSecondaryClass}`}>
                        <span className={theme.textClass}>{acc.name || acc.type}</span>
                        {' — '}
                        {history.filter((h) => h.total != null).length === 0
                          ? 'no history'
                          : history
                              .filter((h) => h.total != null)
                              .map((h) => `${h.quarter}: ${formatCurrency(Number(h.total), h.cur)}`)
                              .join(', ')}
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf,image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={handleImportFile}
          aria-label="Import from file"
        />
        {importError && (
          <p className="mb-2 text-sm text-red-500">{importError}</p>
        )}
        <div className={`p-6 rounded-lg mb-6 ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'}`}>
          <div className="mb-2">
            <span className={`text-sm font-medium ${theme.textClass}`}>Assets</span>
          </div>
          <div className="space-y-4 mb-4">
            {accounts.map((row) => {
              const rowCurrency = (countryData as Record<string, { currency?: string }>)[row.currency]?.currency ?? '₹';
              const showLabel = row.type === 'other';
              const isCommentExpanded = expandedCommentId === row.id;
              return (
                <div
                  key={row.id}
                  className={`p-4 rounded-lg border ${darkMode ? 'border-slate-600 bg-slate-900/40' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className="flex flex-wrap items-end gap-2 mb-2">
                    <div className="w-32 flex-shrink-0">
                      <label className={`block text-xs font-medium mb-1 ${theme.textSecondaryClass}`}>Type</label>
                      <select
                        value={row.type}
                        onChange={(e) => updateRow(row.id, 'type', e.target.value as AssetType)}
                        className={`w-full px-2 py-2 rounded border text-sm ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
                      >
                        {ASSET_TYPES.map((t) => (
                          <option key={t} value={t}>{ASSET_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className={`block text-xs font-medium mb-1 ${theme.textSecondaryClass}`}>Name</label>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                        placeholder="e.g. Main savings"
                        className={`w-full px-3 py-2 rounded border text-sm ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
                      />
                    </div>
                    <div className="w-28 flex-shrink-0">
                      <label className={`block text-xs font-medium mb-1 ${theme.textSecondaryClass}`}>Currency</label>
                      <select
                        value={row.currency}
                        onChange={(e) => updateRow(row.id, 'currency', e.target.value)}
                        className={`w-full px-2 py-2 rounded border text-sm ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
                      >
                        {getCountriesSorted().map((c) => (
                          <option key={c} value={c}>
                            {(countryData as Record<string, { currency?: string }>)[c]?.currency ?? c}
                          </option>
                        ))}
                      </select>
                    </div>
                    {showLabel && (
                      <div className="flex-1 min-w-[100px]">
                        <label className={`block text-xs font-medium mb-1 ${theme.textSecondaryClass}`}>Label</label>
                        <input
                          type="text"
                          value={row.label}
                          onChange={(e) => updateRow(row.id, 'label', e.target.value)}
                          placeholder="e.g. Other assets"
                          className={`w-full px-3 py-2 rounded border text-sm ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-[100px]">
                      <label className={`block text-xs font-medium mb-1 ${theme.textSecondaryClass}`}>Total</label>
                      <input
                        type="text"
                        value={row.total !== '' ? formatInputValue(String(row.total), rowCurrency) : ''}
                        onChange={(e) => {
                          const parsed = parseInputValue(e.target.value);
                          updateRow(row.id, 'total', parsed === '' ? '' : Number(parsed));
                        }}
                        placeholder="e.g. 50l, 10k, 2c"
                        className={`w-full px-3 py-2 rounded border text-sm ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => triggerImport('account', row.id)}
                      disabled={!token || importingId === row.id}
                      className={`p-2 rounded ${theme.textSecondaryClass} hover:${theme.textClass} disabled:opacity-40`}
                      aria-label="Import from file"
                      title="Import from statement or screenshot"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={accounts.length <= 1}
                      className={`p-2 rounded ${theme.textSecondaryClass} hover:text-red-500 disabled:opacity-40`}
                      aria-label="Remove row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {importingId === row.id && (
                    <p className={`mt-1 text-xs ${theme.textSecondaryClass}`}>Importing…</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleComment(row.id)}
                      className={`inline-flex items-center gap-1 text-sm ${theme.textSecondaryClass} hover:${theme.textClass}`}
                    >
                      {row.comment.trim() ? (
                        <>
                          <MessageSquare className="w-4 h-4" />
                          View/Edit comment
                          {isCommentExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4" />
                          Add comment
                          {isCommentExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </>
                      )}
                    </button>
                  </div>
                  {isCommentExpanded && (
                    <div className="mt-2">
                      <textarea
                        value={row.comment}
                        onChange={(e) => updateRow(row.id, 'comment', e.target.value)}
                        placeholder="Optional note for this asset..."
                        rows={2}
                        className={`w-full px-3 py-2 rounded border text-sm ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addRow}
            className={`mb-6 inline-flex items-center gap-2 py-2 px-3 rounded-lg border ${theme.borderClass} ${theme.textClass} text-sm`}
          >
            <Plus className="w-4 h-4" />
            Add asset
          </button>

          <div className={`mb-2 pt-4 border-t ${theme.borderClass}`}>
            <span className={`text-sm font-medium ${theme.textClass}`}>Liabilities</span>
          </div>
          <div className="space-y-4 mb-4">
            {liabilities.map((row) => {
              const rowCurrency = (countryData as Record<string, { currency?: string }>)[row.currency]?.currency ?? '₹';
              const isLiabilityCommentExpanded = expandedLiabilityCommentId === row.id;
              return (
                <div
                  key={row.id}
                  className={`p-4 rounded-lg border ${darkMode ? 'border-slate-600 bg-slate-900/40' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className="flex flex-wrap items-end gap-2 mb-2">
                    <div className="w-32 flex-shrink-0">
                      <label className={`block text-xs font-medium mb-1 ${theme.textSecondaryClass}`}>Type</label>
                      <select
                        value={row.type}
                        onChange={(e) => updateLiability(row.id, 'type', e.target.value as LiabilityType)}
                        className={`w-full px-2 py-2 rounded border text-sm ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
                      >
                        {LIABILITY_TYPES.map((t) => (
                          <option key={t} value={t}>{LIABILITY_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className={`block text-xs font-medium mb-1 ${theme.textSecondaryClass}`}>Name</label>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateLiability(row.id, 'name', e.target.value)}
                        placeholder="e.g. Mortgage, Credit card"
                        className={`w-full px-3 py-2 rounded border text-sm ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
                      />
                    </div>
                    <div className="w-28 flex-shrink-0">
                      <label className={`block text-xs font-medium mb-1 ${theme.textSecondaryClass}`}>Currency</label>
                      <select
                        value={row.currency}
                        onChange={(e) => updateLiability(row.id, 'currency', e.target.value)}
                        className={`w-full px-2 py-2 rounded border text-sm ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
                      >
                        {getCountriesSorted().map((c) => (
                          <option key={c} value={c}>
                            {(countryData as Record<string, { currency?: string }>)[c]?.currency ?? c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[100px]">
                      <label className={`block text-xs font-medium mb-1 ${theme.textSecondaryClass}`}>Amount owed</label>
                      <input
                        type="text"
                        value={row.total !== '' ? formatInputValue(String(row.total), rowCurrency) : ''}
                        onChange={(e) => {
                          const parsed = parseInputValue(e.target.value);
                          updateLiability(row.id, 'total', parsed === '' ? '' : Number(parsed));
                        }}
                        placeholder="e.g. 50l, 10k, 2c"
                        className={`w-full px-3 py-2 rounded border text-sm ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => triggerImport('liability', row.id)}
                      disabled={!token || importingId === row.id}
                      className={`p-2 rounded ${theme.textSecondaryClass} hover:${theme.textClass} disabled:opacity-40`}
                      aria-label="Import from file"
                      title="Import from statement or screenshot"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLiability(row.id)}
                      className={`p-2 rounded ${theme.textSecondaryClass} hover:text-red-500`}
                      aria-label="Remove liability"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {importingId === row.id && (
                    <p className={`mt-1 text-xs ${theme.textSecondaryClass}`}>Importing…</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleLiabilityComment(row.id)}
                      className={`inline-flex items-center gap-1 text-sm ${theme.textSecondaryClass} hover:${theme.textClass}`}
                    >
                      {row.comment.trim() ? (
                        <>
                          <MessageSquare className="w-4 h-4" />
                          View/Edit comment
                          {isLiabilityCommentExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4" />
                          Add comment
                          {isLiabilityCommentExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </>
                      )}
                    </button>
                  </div>
                  {isLiabilityCommentExpanded && (
                    <div className="mt-2">
                      <textarea
                        value={row.comment}
                        onChange={(e) => updateLiability(row.id, 'comment', e.target.value)}
                        placeholder="Optional note..."
                        rows={2}
                        className={`w-full px-3 py-2 rounded border text-sm ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addLiability}
            className={`mb-4 inline-flex items-center gap-2 py-2 px-3 rounded-lg border ${theme.borderClass} ${theme.textClass} text-sm`}
          >
            <Plus className="w-4 h-4" />
            Add liability
          </button>

          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              onClick={saveAssets}
              disabled={saveStatus === 'saving'}
              className={`py-2 px-4 rounded-lg border ${theme.borderClass} ${theme.textClass} disabled:opacity-50`}
            >
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save'}
            </button>
            <button
              type="button"
              onClick={saveSnapshot}
              disabled={saveStatus === 'saving'}
              className={`py-2 px-4 rounded-lg border ${theme.borderClass} ${theme.textClass} disabled:opacity-50`}
            >
              Save snapshot
            </button>
            {saveError && <span className="text-sm text-red-500">{saveError}</span>}
            {saveStatus === 'error' && !saveError && <span className="text-sm text-red-500">Save failed</span>}
          </div>
          <AddReminderForm token={token} context="assets" defaultDescription="Review assets" darkMode={darkMode} theme={theme} />
        </div>
      </main>
    </div>
  );
}

function AssetsPageFallback() {
  const { darkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);
  return (
    <div className={`min-h-screen ${theme.bgClass} flex items-center justify-center`}>
      <p className={theme.textSecondaryClass}>Loading…</p>
    </div>
  );
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<AssetsPageFallback />}>
      <AssetsPageContent />
    </Suspense>
  );
}
