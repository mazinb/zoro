'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { NagEndEditor, NagNav, NagSheet, type NagDraft } from './nag-chrome';

const NAG_TOKEN_STORAGE = 'nag_dev_token';
const NAG_FORCE_LOGOUT = 'nag_force_logout';

const NAG_TIMEZONE_OPTIONS: string[] =
  typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
    ? [
        ...(Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf(
          'timeZone'
        ),
      ].sort((a, b) => a.localeCompare(b))
    : ['UTC'];

type Nag = {
  id: string;
  message: string;
  channel: string;
  frequency: string;
  time_hhmm: string;
  day_of_week: number | null;
  day_of_month: number | null;
  end_type: string;
  until_date: string | null;
  occurrences_max: number | null;
  occurrences_remaining: number | null;
  status: string;
  next_at: string | null;
};

const WEEKDAYS = [
  { v: 0, l: 'Mon' },
  { v: 1, l: 'Tue' },
  { v: 2, l: 'Wed' },
  { v: 3, l: 'Thu' },
  { v: 4, l: 'Fri' },
  { v: 5, l: 'Sat' },
  { v: 6, l: 'Sun' },
];

function emptyDraft(): NagDraft {
  return {
    message: '',
    channel: 'email',
    frequency: 'weekly',
    time_hhmm: '10:00',
    day_of_week: 4,
    day_of_month: 15,
    end_type: 'forever',
    until_date: '',
    occurrences_max: '5',
  };
}

function draftFromParse(d: Record<string, unknown>): NagDraft {
  return {
    message: String(d.message ?? ''),
    channel: String(d.channel ?? 'email'),
    frequency: String(d.frequency ?? 'weekly'),
    time_hhmm: String(d.time_hhmm ?? '10:00'),
    day_of_week: typeof d.day_of_week === 'number' ? d.day_of_week : null,
    day_of_month: typeof d.day_of_month === 'number' ? d.day_of_month : null,
    end_type: String(d.end_type ?? 'forever'),
    until_date: d.until_date ? String(d.until_date) : '',
    occurrences_max: d.occurrences_max != null ? String(d.occurrences_max) : '5',
  };
}

function nagToDraft(n: Nag): NagDraft {
  return {
    message: n.message,
    channel: n.channel,
    frequency: n.frequency,
    time_hhmm: n.time_hhmm,
    day_of_week: n.day_of_week,
    day_of_month: n.day_of_month,
    end_type: n.end_type,
    until_date: n.until_date ?? '',
    occurrences_max: n.occurrences_max != null ? String(n.occurrences_max) : '5',
  };
}

function formatNext(nextAt: string | null, timeZone: string): string {
  if (!nextAt) return '—';
  try {
    const d = new Date(nextAt);
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timeZone.trim() || 'UTC',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return nextAt;
  }
}

function endLabel(n: Nag): string {
  if (n.end_type === 'forever') return 'forever';
  if (n.end_type === 'occurrences') return `${n.occurrences_remaining ?? n.occurrences_max ?? '?'}× left`;
  return n.until_date ? `until ${n.until_date}` : 'until …';
}

function apiErrorMessage(status: number, json: { error?: string }): string {
  if (status === 401) {
    return 'Invalid or expired token. Paste the token from your magic link (the value after ?token=), save it below, or request a new link.';
  }
  if (status === 503 && json.error) {
    return json.error;
  }
  return json.error ?? `Request failed (${status})`;
}

type SandboxAction = 'parse' | 'list' | 'create' | 'patch' | 'delete';

const SANDBOX_EXAMPLES: { label: string; method: string; path: string; action: SandboxAction }[] = [
  { label: 'Parse', method: 'POST', path: '/api/nag-parse', action: 'parse' },
  { label: 'Create', method: 'POST', path: '/api/nags', action: 'create' },
  { label: 'List', method: 'GET', path: '/api/nags?token=…&status=all', action: 'list' },
  { label: 'Edit', method: 'PATCH', path: '/api/nags/:id', action: 'patch' },
  { label: 'Cancel', method: 'DELETE', path: '/api/nags/:id?token=…', action: 'delete' },
];

export function NagPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get('token')?.trim() ?? '';
  const envDevToken = (process.env.NEXT_PUBLIC_NAG_DEV_TOKEN ?? '').trim();

  const [storedToken, setStoredToken] = useState('');
  const [forceLogout, setForceLogout] = useState(false);
  useEffect(() => {
    try {
      const s = sessionStorage.getItem(NAG_TOKEN_STORAGE);
      if (s?.trim()) setStoredToken(s.trim());
      if (sessionStorage.getItem(NAG_FORCE_LOGOUT) === '1') setForceLogout(true);
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    if (!urlToken) return;
    setForceLogout(false);
    try {
      sessionStorage.removeItem(NAG_FORCE_LOGOUT);
    } catch {
      /* ignore */
    }
  }, [urlToken]);

  const effectiveToken =
    urlToken || (!forceLogout && (storedToken || envDevToken)) || '';

  const persistStoredToken = useCallback((raw: string) => {
    const v = raw.trim();
    setStoredToken(v);
    try {
      if (v) sessionStorage.setItem(NAG_TOKEN_STORAGE, v);
      else sessionStorage.removeItem(NAG_TOKEN_STORAGE);
    } catch {
      /* ignore */
    }
  }, []);

  const signOut = useCallback(() => {
    persistStoredToken('');
    setForceLogout(true);
    try {
      sessionStorage.setItem(NAG_FORCE_LOGOUT, '1');
    } catch {
      /* ignore */
    }
    router.push('/nag');
  }, [persistStoredToken, router]);

  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);

  const [tokenInput, setTokenInput] = useState('');
  const [nags, setNags] = useState<Nag[]>([]);
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [profileTimezone, setProfileTimezone] = useState('UTC');
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  const [compose, setCompose] = useState('');
  const [defaultChannel, setDefaultChannel] = useState<'email' | 'whatsapp'>('email');
  const [parsing, setParsing] = useState(false);

  const [sheet, setSheet] = useState<'confirm' | 'edit' | 'profile' | null>(null);
  const [draft, setDraft] = useState<NagDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [magicEmail, setMagicEmail] = useState('');
  const [magicStatus, setMagicStatus] = useState<string | null>(null);
  const [magicBusy, setMagicBusy] = useState(false);

  const [getStartedOpen, setGetStartedOpen] = useState(false);
  const [getStartedEmail, setGetStartedEmail] = useState('');
  const [getStartedStatus, setGetStartedStatus] = useState<string | null>(null);
  const [getStartedBusy, setGetStartedBusy] = useState(false);

  const [profilePhone, setProfilePhone] = useState('+1 555 010 1234');
  const [profDraft, setProfDraft] = useState({
    phone: '',
    defaultVia: 'email' as 'email' | 'whatsapp',
    timezone: 'UTC',
  });

  const [sandboxIdx, setSandboxIdx] = useState(0);
  const [sandboxRes, setSandboxRes] = useState<unknown>(null);
  const [sandboxBusy, setSandboxBusy] = useState(false);
  const [firstNagId, setFirstNagId] = useState<string | null>(null);

  const fetchNags = useCallback(async () => {
    if (!effectiveToken) return;
    setLoadingList(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/nags?token=${encodeURIComponent(effectiveToken)}&status=all`);
      const json = await res.json();
      if (!res.ok) {
        setLoadError(apiErrorMessage(res.status, json));
        setNags([]);
        return;
      }
      setNags(json.nags ?? []);
      setProfileEmail(json.profile?.email ?? null);
      setProfileTimezone(
        typeof json.profile?.timezone === 'string' && json.profile.timezone.trim()
          ? json.profile.timezone.trim()
          : 'UTC'
      );
      const first = (json.nags ?? [])[0]?.id;
      if (first) setFirstNagId(first);
    } catch {
      setLoadError('Network error');
      setNags([]);
    } finally {
      setLoadingList(false);
    }
  }, [effectiveToken]);

  useEffect(() => {
    if (effectiveToken) void fetchNags();
  }, [effectiveToken, fetchNags]);

  const activeList = useMemo(() => nags.filter((n) => n.status === 'active'), [nags]);
  const archivedList = useMemo(() => nags.filter((n) => n.status === 'archived'), [nags]);
  const shown = tab === 'active' ? activeList : archivedList;

  const openProfile = () => {
    setProfileSaveError(null);
    setProfDraft({ phone: profilePhone, defaultVia: defaultChannel, timezone: profileTimezone });
    setSheet('profile');
  };

  const saveProfile = async () => {
    if (!effectiveToken) return;
    setProfileSaveError(null);
    setProfileSaving(true);
    try {
      const res = await fetch('/api/nag-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: effectiveToken, timezone: profDraft.timezone }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setProfileSaveError(json.error ?? 'Could not save timezone');
        return;
      }
      setProfileTimezone(profDraft.timezone);
      setProfilePhone(profDraft.phone);
      setDefaultChannel(profDraft.defaultVia);
      setSheet(null);
      await fetchNags();
    } catch {
      setProfileSaveError('Network error');
    } finally {
      setProfileSaving(false);
    }
  };

  const onSchedule = async () => {
    if (!effectiveToken || !compose.trim()) return;
    setParsing(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/nag-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: effectiveToken,
          text: compose.trim(),
          default_channel: defaultChannel,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLoadError(apiErrorMessage(res.status, json));
        return;
      }
      const d = draftFromParse(json.draft ?? {});
      d.channel = defaultChannel;
      setDraft(d);
      setEditingId(null);
      setSheet('confirm');
    } catch {
      setLoadError('Parse request failed');
    } finally {
      setParsing(false);
    }
  };

  const buildSchedulePayload = () => ({
    message: draft.message.trim(),
    channel: draft.channel,
    frequency: draft.frequency,
    time_hhmm: draft.time_hhmm,
    day_of_week: draft.frequency === 'weekly' ? draft.day_of_week : null,
    day_of_month: draft.frequency === 'monthly' ? draft.day_of_month : null,
    end_type: draft.end_type,
    until_date: draft.end_type === 'until_date' || draft.frequency === 'once' ? draft.until_date || null : null,
    occurrences_max:
      draft.end_type === 'occurrences' ? Number(draft.occurrences_max) || 5 : null,
  });

  const buildCreateBody = () => ({
    token: effectiveToken,
    ...buildSchedulePayload(),
  });

  const confirmCreate = async () => {
    if (!effectiveToken) return;
    setSaving(true);
    try {
      const res = await fetch('/api/nags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCreateBody()),
      });
      const json = await res.json();
      if (!res.ok) {
        setLoadError(apiErrorMessage(res.status, json));
        return;
      }
      setSheet(null);
      setCompose('');
      await fetchNags();
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!effectiveToken || !editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/nags/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: effectiveToken, ...buildSchedulePayload() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLoadError(apiErrorMessage(res.status, json));
        return;
      }
      setSheet(null);
      setEditingId(null);
      await fetchNags();
    } finally {
      setSaving(false);
    }
  };

  const archiveNag = async (id: string) => {
    if (!effectiveToken) return;
    await fetch(`/api/nags/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: effectiveToken, status: 'archived' }),
    });
    await fetchNags();
  };

  const restoreNag = async (id: string) => {
    if (!effectiveToken) return;
    await fetch(`/api/nags/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: effectiveToken, status: 'active' }),
    });
    await fetchNags();
  };

  const deleteNag = async (id: string) => {
    if (!effectiveToken) return;
    await fetch(`/api/nags/${id}?token=${encodeURIComponent(effectiveToken)}`, { method: 'DELETE' });
    await fetchNags();
  };

  /** Reuses POST /api/auth/send-magic-link: registered → nag link; else → signup at getzoro.com */
  const requestNagAccessLink = useCallback(
    async (
      emailRaw: string,
      setStatus: (s: string | null) => void,
      setBusy: (b: boolean) => void
    ) => {
      const em = emailRaw.trim().toLowerCase();
      if (!em) return;
      setBusy(true);
      setStatus(null);
      try {
        const res = await fetch('/api/auth/send-magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: em,
            redirectPath: '/nag',
            context: 'nag',
            inviteIfUnregistered: true,
          }),
        });
        const json = (await res.json()) as {
          error?: string;
          invited?: boolean;
          registered?: boolean;
          success?: boolean;
        };
        if (!res.ok) {
          setStatus(json.error ?? 'Failed');
          return;
        }
        if (json.invited) {
          setStatus(
            'Check your inbox — we sent you a link to sign up at getzoro.com.'
          );
          return;
        }
        if (json.success && json.registered) {
          setStatus('Check your inbox for your personal link to open Nags.');
          return;
        }
        setStatus('Something went wrong. Try again.');
      } catch {
        setStatus('Request failed');
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const sendMagicLink = () => requestNagAccessLink(magicEmail, setMagicStatus, setMagicBusy);

  const submitGetStarted = () =>
    requestNagAccessLink(getStartedEmail, setGetStartedStatus, setGetStartedBusy);

  const applyTokenInput = () => {
    setForceLogout(false);
    try {
      sessionStorage.removeItem(NAG_FORCE_LOGOUT);
    } catch {
      /* ignore */
    }
    persistStoredToken(tokenInput);
    setTokenInput('');
    setSandboxRes({ info: 'Token saved in this browser. You can use Schedule and the sandbox now.' });
  };

  const runSandbox = async () => {
    if (!effectiveToken) {
      setSandboxRes({
        error:
          'No token. Paste your magic-link token (the part after ?token= in the email URL), click Save token, or set NEXT_PUBLIC_NAG_DEV_TOKEN in .env.local for local testing.',
      });
      return;
    }
    const ex = SANDBOX_EXAMPLES[sandboxIdx];
    setSandboxBusy(true);
    setSandboxRes(null);
    try {
      if (ex.action === 'parse') {
        const res = await fetch('/api/nag-parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: effectiveToken,
            text: 'Remind me every Friday at 17:00 UTC to send the invoice until 2026-12-31',
            default_channel: 'email',
          }),
        });
        const json = await res.json();
        setSandboxRes(res.ok ? json : { error: json.error, status: res.status });
        return;
      }
      if (ex.action === 'list') {
        const res = await fetch(`/api/nags?token=${encodeURIComponent(effectiveToken)}&status=all`);
        const json = await res.json();
        setSandboxRes(res.ok ? json : { error: json.error, status: res.status });
        return;
      }
      if (ex.action === 'delete') {
        const id = firstNagId;
        if (!id) {
          setSandboxRes({ error: 'Create a nag first so there is an id to cancel.' });
          return;
        }
        const res = await fetch(`/api/nags/${id}?token=${encodeURIComponent(effectiveToken)}`, {
          method: 'DELETE',
        });
        const json = await res.json();
        setSandboxRes(res.ok ? json : { error: json.error, status: res.status });
        await fetchNags();
        return;
      }
      if (ex.action === 'patch') {
        const id = firstNagId;
        if (!id) {
          setSandboxRes({ error: 'Create a nag first to obtain an id.' });
          return;
        }
        const res = await fetch(`/api/nags/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: effectiveToken, time_hhmm: '09:00' }),
        });
        const json = await res.json();
        setSandboxRes(res.ok ? json : { error: json.error, status: res.status });
        await fetchNags();
        return;
      }
      if (ex.action === 'create') {
        const res = await fetch('/api/nags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: effectiveToken,
            message: 'Sandbox: send invoice',
            channel: 'email',
            frequency: 'weekly',
            time_hhmm: '17:00',
            day_of_week: 4,
            day_of_month: null,
            end_type: 'until_date',
            until_date: '2026-12-31',
            occurrences_max: null,
          }),
        });
        const json = await res.json();
        setSandboxRes(res.ok ? json : { error: json.error, status: res.status });
        await fetchNags();
      }
    } finally {
      setSandboxBusy(false);
    }
  };

  const SandboxPanel = ({ compact }: { compact?: boolean }) => (
    <div className={compact ? '' : ''}>
      {!compact && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${theme.borderClass} ${theme.cardBgClass}`}>
          <p className={`mb-2 font-semibold ${theme.textClass}`}>Link token</p>
          <p className={`mb-2 text-xs leading-relaxed ${theme.textSecondaryClass}`}>
            Copy the token from your magic-link URL only (not the words YOUR_TOKEN). Optional: set{' '}
            <code className="text-[11px]">NEXT_PUBLIC_NAG_DEV_TOKEN</code> in <code className="text-[11px]">.env.local</code>{' '}
            for automated local testing.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              autoComplete="off"
              placeholder="Paste token…"
              className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm ${theme.inputBgClass}`}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <button
              type="button"
              disabled={!tokenInput.trim()}
              onClick={applyTokenInput}
              className={`rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-40 ${theme.buttonClass}`}
            >
              Save token
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {SANDBOX_EXAMPLES.map((e, i) => (
          <button
            key={e.label}
            type="button"
            onClick={() => {
              setSandboxIdx(i);
              setSandboxRes(null);
            }}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              sandboxIdx === i ? `${theme.borderClass} ${theme.accentBgClass} ${theme.textClass}` : theme.textSecondaryClass
            } ${theme.borderClass}`}
          >
            <span className="mr-1 font-mono text-[10px]">{e.method}</span>
            {e.label}
          </button>
        ))}
      </div>
      <div className={`mt-4 rounded-lg border p-3 font-mono text-xs ${theme.borderClass} ${theme.cardBgClass}`}>
        <span className={SANDBOX_EXAMPLES[sandboxIdx].method === 'DELETE' ? 'font-bold text-red-500' : 'font-bold'}>
          {SANDBOX_EXAMPLES[sandboxIdx].method}
        </span>{' '}
        <span className={theme.textClass}>{SANDBOX_EXAMPLES[sandboxIdx].path}</span>
      </div>
      <button
        type="button"
        disabled={sandboxBusy}
        onClick={runSandbox}
        className={`mt-4 rounded-lg px-6 py-3 text-sm font-bold disabled:opacity-40 ${theme.buttonClass}`}
      >
        {sandboxBusy ? 'Sending…' : `Send ${SANDBOX_EXAMPLES[sandboxIdx].method}`}
      </button>
      <pre
        className={`mt-4 max-h-64 overflow-auto rounded-lg border p-3 text-xs ${theme.borderClass} ${theme.cardBgClass} ${theme.textClass}`}
      >
        {sandboxRes ? JSON.stringify(sandboxRes, null, 2) : 'Hit Send to see the JSON response.'}
      </pre>
    </div>
  );

  if (!effectiveToken) {
    return (
      <>
        <div className={`min-h-screen ${darkMode ? 'bg-[#09090c]' : 'bg-[#f5f5f7]'} ${theme.textClass}`}>
          <NagNav
            theme={theme}
            darkMode={darkMode}
            hasToken={false}
            onProfile={() => {}}
            onToggleTheme={toggleDarkMode}
          />
          <section className="px-5 py-20 text-center">
            <h1 className={`mx-auto max-w-[min(100%,420px)] text-[clamp(2rem,8vw,3.75rem)] font-black leading-tight tracking-tight ${theme.textClass}`}>
              Nags that
              <br />
              actually work.
            </h1>
            <p className={`mx-auto mt-4 max-w-sm text-[15px] leading-relaxed ${theme.textSecondaryClass}`}>
              Tell Zoro what to remind you. It nags you via WhatsApp or email until you&apos;re done.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setGetStartedEmail(magicEmail);
                  setGetStartedStatus(null);
                  setGetStartedOpen(true);
                }}
                className={`rounded-lg px-7 py-3 text-sm font-bold ${theme.buttonClass}`}
              >
                Get started
              </button>
              <a
                href="#sandbox"
                className={`rounded-lg border px-7 py-3 text-sm font-bold ${theme.borderClass} ${theme.textSecondaryClass}`}
              >
                For developers
              </a>
            </div>
            <p className={`mt-4 text-[11px] opacity-50 ${theme.textSecondaryClass}`}>No app. No download.</p>
          </section>

        <section className={`border-y px-5 py-16 ${theme.borderClass} ${darkMode ? 'bg-[#111115]' : 'bg-white'}`}>
          <div className="mx-auto max-w-[680px]">
            <p className={`mb-2 text-[10px] font-bold uppercase tracking-widest ${theme.textSecondaryClass}`}>
              How it works
            </p>
            <h2 className={`mb-8 text-[clamp(1.35rem,4vw,2rem)] font-extrabold tracking-tight ${theme.textClass}`}>
              Three steps. Zero friction.
            </h2>
            <div className="flex flex-wrap gap-3">
              {[
                ['1', 'Tell Zoro', 'Type anything natural. Zoro figures out the schedule.'],
                ['2', 'Confirm', 'Review parsed time, frequency, and end date.'],
                ['3', 'Get nagged', 'WhatsApp or email until done or date passes.'],
              ].map(([n, title, body]) => (
                <div
                  key={n}
                  className={`min-w-[180px] flex-1 rounded-xl border p-4 ${theme.borderClass} ${darkMode ? 'bg-[#09090c]' : 'bg-[#f5f5f7]'}`}
                >
                  <div
                    className={`mb-2 flex h-[26px] w-[26px] items-center justify-center rounded-md text-xs font-extrabold ${theme.buttonClass}`}
                  >
                    {n}
                  </div>
                  <div className={`mb-1 text-sm font-bold ${theme.textClass}`}>{title}</div>
                  <div className={`text-xs leading-relaxed ${theme.textSecondaryClass}`}>{body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-16">
          <div className="mx-auto max-w-[680px]">
            <p className={`mb-2 text-[10px] font-bold uppercase tracking-widest ${theme.textSecondaryClass}`}>
              Sign in
            </p>
            <h2 className={`mb-4 text-xl font-bold ${theme.textClass}`}>Magic link</h2>
            <p className={`mb-4 text-sm ${theme.textSecondaryClass}`}>
              If you already have a Zoro account, we&apos;ll email a link to open Nags. If not, we&apos;ll email you a link
              to sign up at <span className="font-medium">getzoro.com</span>.
            </p>
            <div className="flex max-w-md flex-col gap-2 sm:flex-row">
              <input
                type="email"
                placeholder="you@example.com"
                className={`flex-1 rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
              />
              <button
                type="button"
                disabled={magicBusy || !magicEmail.trim()}
                onClick={sendMagicLink}
                className={`rounded-lg px-5 py-2.5 text-sm font-bold disabled:opacity-40 ${theme.buttonClass}`}
              >
                {magicBusy ? '…' : 'Send link'}
              </button>
            </div>
            {magicStatus && <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">{magicStatus}</p>}
          </div>
        </section>

        <section id="sandbox" className={`scroll-mt-14 px-5 py-16 ${darkMode ? 'bg-[#09090c]' : 'bg-[#f5f5f7]'}`}>
          <div className="mx-auto max-w-[680px]">
            <p className={`mb-2 text-[10px] font-bold uppercase tracking-widest ${theme.textSecondaryClass}`}>
              Developers
            </p>
            <h2 className={`mb-2 text-[clamp(1.35rem,4vw,2rem)] font-extrabold tracking-tight ${theme.textClass}`}>
              API explorer
            </h2>
            <SandboxPanel />
          </div>
        </section>

          <footer className={`flex justify-between border-t px-5 py-6 ${theme.borderClass}`}>
            <span className={`text-sm font-extrabold ${theme.textSecondaryClass}`}>Zoro</span>
            <span className={`text-xs opacity-50 ${theme.textSecondaryClass}`}>Nag responsibly.</span>
          </footer>
        </div>

        {getStartedOpen && (
          <NagSheet
            theme={theme}
            onClose={() => {
              setGetStartedOpen(false);
              setGetStartedStatus(null);
            }}
          >
            <p className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${theme.textSecondaryClass}`}>
              Get started
            </p>
            <h2 className={`mb-2 text-lg font-bold ${theme.textClass}`}>Enter your email</h2>
            <p className={`mb-4 text-sm leading-relaxed ${theme.textSecondaryClass}`}>
              We use the same secure email flow as the rest of Zoro. You&apos;ll get either your Nags link or an invite to
              sign up at getzoro.com.
            </p>
            <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Email</label>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className={`mb-4 w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
              value={getStartedEmail}
              onChange={(e) => setGetStartedEmail(e.target.value)}
            />
            <button
              type="button"
              disabled={getStartedBusy || !getStartedEmail.trim()}
              onClick={submitGetStarted}
              className={`w-full rounded-lg py-3 text-sm font-bold disabled:opacity-40 ${theme.buttonClass}`}
            >
              {getStartedBusy ? 'Sending…' : 'Email me'}
            </button>
            {getStartedStatus && (
              <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">{getStartedStatus}</p>
            )}
          </NagSheet>
        )}
      </>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#09090c]' : 'bg-[#f5f5f7]'} ${theme.textClass}`}>
      <NagNav
        theme={theme}
        darkMode={darkMode}
        dashboard
        hasToken
        onSignOut={signOut}
        onProfile={openProfile}
        onToggleTheme={toggleDarkMode}
      />
      <div className="mx-auto max-w-[500px] px-5 py-8 pb-24">
        {loadError && (
          <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {loadError}
          </p>
        )}
        <div className={`mb-4 rounded-[14px] border p-4 ${theme.borderClass} ${theme.cardBgClass}`}>
          <textarea
            rows={2}
            className="w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed outline-none"
            placeholder="e.g., Remind me to send invoice every Friday until Dec"
            value={compose}
            onChange={(e) => setCompose(e.target.value)}
          />
          <div className={`my-3 h-px ${theme.borderClass} bg-current opacity-20`} />
          <div className="flex flex-wrap items-center gap-2">
            <div className={`flex rounded-md p-0.5 ${theme.accentBgClass}`}>
              {(['whatsapp', 'email'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDefaultChannel(v)}
                  className={`rounded px-2.5 py-1 text-[11px] font-semibold ${
                    defaultChannel === v ? `${theme.cardBgClass} ${theme.textClass}` : theme.textSecondaryClass
                  }`}
                >
                  {v === 'whatsapp' ? 'WhatsApp' : 'Email'}
                </button>
              ))}
            </div>
            <span className={`min-w-0 flex-1 truncate text-[11px] ${theme.textSecondaryClass}`}>
              {defaultChannel === 'whatsapp' ? profilePhone : profileEmail ?? '—'}
            </span>
            <button
              type="button"
              disabled={!compose.trim() || parsing}
              onClick={onSchedule}
              className={`shrink-0 rounded-lg px-4 py-2 text-[13px] font-bold disabled:opacity-40 ${theme.buttonClass}`}
            >
              {parsing ? 'Parsing…' : 'Schedule'}
            </button>
          </div>
        </div>

        <div className={`mb-3 flex rounded-lg p-0.5 ${theme.accentBgClass}`}>
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`flex-1 rounded-md py-2 text-[13px] font-semibold ${
              tab === 'active' ? `${theme.cardBgClass} ${theme.textClass}` : theme.textSecondaryClass
            }`}
          >
            Active · {activeList.length}
          </button>
          <button
            type="button"
            onClick={() => setTab('archived')}
            className={`flex-1 rounded-md py-2 text-[13px] font-semibold ${
              tab === 'archived' ? `${theme.cardBgClass} ${theme.textClass}` : theme.textSecondaryClass
            }`}
          >
            Archived · {archivedList.length}
          </button>
        </div>

        <div className={`rounded-[14px] border px-4 py-1 ${theme.borderClass} ${theme.cardBgClass}`}>
          {loadingList ? (
            <p className={`py-8 text-center text-sm ${theme.textSecondaryClass}`}>Loading…</p>
          ) : shown.length === 0 ? (
            <p className={`py-8 text-center text-sm ${theme.textSecondaryClass}`}>Nothing here.</p>
          ) : (
            shown.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-2 border-b py-3 last:border-b-0 ${theme.borderClass} ${
                  tab === 'active' ? 'cursor-pointer' : ''
                }`}
                onClick={() => {
                  if (tab === 'active') {
                    setDraft(nagToDraft(n));
                    setEditingId(n.id);
                    setSheet('edit');
                  }
                }}
                role="presentation"
              >
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm ${tab === 'archived' ? `line-through ${theme.textSecondaryClass}` : theme.textClass}`}
                  >
                    {n.message}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className={`rounded-full border px-2 py-0.5 uppercase ${theme.borderClass} ${theme.textSecondaryClass}`}>
                      {n.channel}
                    </span>
                    <span className={theme.textSecondaryClass}>{n.frequency}</span>
                    <span className={theme.textSecondaryClass}>{endLabel(n)}</span>
                    {tab === 'active' && (
                      <span className={theme.textSecondaryClass}>
                        next {formatNext(n.next_at, profileTimezone)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
                  {tab === 'active' ? (
                    <button
                      type="button"
                      className={`px-1 text-lg ${theme.textSecondaryClass}`}
                      onClick={() => archiveNag(n.id)}
                      title="Archive"
                    >
                      ↓
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`px-1 text-lg ${theme.textClass}`}
                      onClick={() => restoreNag(n.id)}
                      title="Restore"
                    >
                      ↑
                    </button>
                  )}
                  <button
                    type="button"
                    className={`px-1 text-lg leading-none ${theme.textSecondaryClass} hover:text-red-500`}
                    onClick={() => deleteNag(n.id)}
                    title="Cancel nag"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <section id="sandbox" className="mt-14 scroll-mt-14">
          <p className={`mb-2 text-[10px] font-bold uppercase tracking-widest ${theme.textSecondaryClass}`}>
            Sandbox
          </p>
          <h2 className={`mb-4 text-lg font-extrabold ${theme.textClass}`}>API explorer</h2>
          <SandboxPanel compact />
        </section>
      </div>

      {sheet && (
        <NagSheet theme={theme} onClose={() => { setSheet(null); setEditingId(null); }}>
          {sheet === 'profile' && (
            <div>
              <p className={`mb-4 text-[10px] font-bold uppercase tracking-wider ${theme.textSecondaryClass}`}>
                Profile
              </p>
              <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>
                Account email (nags send here)
              </label>
              <input
                readOnly
                aria-readonly="true"
                className={`mb-3 w-full cursor-not-allowed rounded-lg border px-3 py-2.5 text-sm opacity-90 ${theme.inputBgClass}`}
                value={profileEmail ?? '—'}
              />
              <p className={`mb-3 text-xs ${theme.textSecondaryClass}`}>
                From your Zoro account. To change it, update your registration email or contact support.
              </p>
              <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>
                Timezone
              </label>
              <p className={`mb-2 text-xs ${theme.textSecondaryClass}`}>
                Nags use this for schedule times, next-run display, and natural-language parsing.
              </p>
              <select
                className={`mb-3 w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                value={profDraft.timezone}
                onChange={(e) => setProfDraft((p) => ({ ...p, timezone: e.target.value }))}
              >
                {!NAG_TIMEZONE_OPTIONS.includes(profDraft.timezone) && (
                  <option value={profDraft.timezone}>{profDraft.timezone}</option>
                )}
                {NAG_TIMEZONE_OPTIONS.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
              <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>
                WhatsApp number
              </label>
              <input
                className={`mb-3 w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                value={profDraft.phone}
                onChange={(e) => setProfDraft((p) => ({ ...p, phone: e.target.value }))}
              />
              <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>
                Default channel
              </label>
              <div className={`mb-4 flex rounded-lg p-0.5 ${theme.accentBgClass}`}>
                {(['whatsapp', 'email'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setProfDraft((p) => ({ ...p, defaultVia: v }))}
                    className={`flex-1 rounded-md py-2 text-xs font-semibold ${
                      profDraft.defaultVia === v ? `${theme.cardBgClass} ${theme.textClass}` : theme.textSecondaryClass
                    }`}
                  >
                    {v === 'whatsapp' ? 'WhatsApp' : 'Email'}
                  </button>
                ))}
              </div>
              {profileSaveError && (
                <p className="mb-3 text-sm text-red-600 dark:text-red-400">{profileSaveError}</p>
              )}
              <button
                type="button"
                disabled={profileSaving}
                onClick={() => void saveProfile()}
                className={`w-full rounded-lg py-3 text-sm font-bold disabled:opacity-40 ${theme.buttonClass}`}
              >
                {profileSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}

          {(sheet === 'confirm' || sheet === 'edit') && (
            <div>
              <p className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${theme.textSecondaryClass}`}>
                {sheet === 'confirm' ? 'Confirm nag' : 'Edit nag'}
              </p>
              {sheet === 'confirm' && (
                <>
                  <p className={`mb-4 text-base font-bold ${theme.textClass}`}>{draft.message}</p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {(
                      [
                        ['Via', draft.channel === 'whatsapp' ? 'WhatsApp' : 'Email'],
                        ['Freq', draft.frequency],
                        ['Time', draft.time_hhmm],
                        [
                          'Until',
                          draft.end_type === 'forever'
                            ? 'forever'
                            : draft.end_type === 'occurrences'
                              ? `${draft.occurrences_max}×`
                              : draft.until_date || '—',
                        ],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className={`min-w-[70px] flex-1 rounded-lg p-2.5 ${theme.accentBgClass}`}>
                        <div className={`text-[9px] font-bold uppercase ${theme.textSecondaryClass}`}>{k}</div>
                        <div className="text-xs font-semibold">{v}</div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={confirmCreate}
                    className={`mb-2 w-full rounded-lg py-3 text-sm font-bold disabled:opacity-40 ${theme.buttonClass}`}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheet('edit')}
                    className={`w-full rounded-lg border py-3 text-sm font-semibold ${theme.borderClass} ${theme.textSecondaryClass}`}
                  >
                    Edit
                  </button>
                </>
              )}

              {sheet === 'edit' && (
                <>
                  <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Task</label>
                  <input
                    className={`mb-3 w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                    value={draft.message}
                    onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
                  />
                  <div className="mb-3 flex gap-2">
                    <div className="flex-1">
                      <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Time (UTC)</label>
                      <input
                        className={`w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                        value={draft.time_hhmm}
                        onChange={(e) => setDraft((d) => ({ ...d, time_hhmm: e.target.value }))}
                      />
                    </div>
                    <div className="flex-1">
                      <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Freq</label>
                      <select
                        className={`w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                        value={draft.frequency}
                        onChange={(e) => setDraft((d) => ({ ...d, frequency: e.target.value }))}
                      >
                        {['daily', 'weekly', 'monthly', 'once'].map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {draft.frequency === 'weekly' && (
                    <div className="mb-3">
                      <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Day</label>
                      <select
                        className={`w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                        value={draft.day_of_week ?? 4}
                        onChange={(e) => setDraft((d) => ({ ...d, day_of_week: Number(e.target.value) }))}
                      >
                        {WEEKDAYS.map((w) => (
                          <option key={w.v} value={w.v}>
                            {w.l}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {draft.frequency === 'monthly' && (
                    <div className="mb-3">
                      <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>
                        Day of month
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className={`w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                        value={draft.day_of_month ?? 1}
                        onChange={(e) => setDraft((d) => ({ ...d, day_of_month: Number(e.target.value) }))}
                      />
                    </div>
                  )}
                  {draft.frequency === 'once' && (
                    <div className="mb-3">
                      <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Date</label>
                      <input
                        type="date"
                        className={`w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                        value={draft.until_date}
                        onChange={(e) => setDraft((d) => ({ ...d, until_date: e.target.value }))}
                      />
                    </div>
                  )}
                  <NagEndEditor theme={theme} draft={draft} setDraft={setDraft} />
                  <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Channel</label>
                  <div className={`mb-4 flex rounded-lg p-0.5 ${theme.accentBgClass}`}>
                    {(['email', 'whatsapp'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, channel: v }))}
                        className={`flex-1 rounded-md py-2 text-xs font-semibold ${
                          draft.channel === v ? `${theme.cardBgClass} ${theme.textClass}` : theme.textSecondaryClass
                        }`}
                      >
                        {v === 'whatsapp' ? 'WhatsApp' : 'Email'}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => (editingId ? saveEdit() : confirmCreate())}
                    className={`w-full rounded-lg py-3 text-sm font-bold disabled:opacity-40 ${theme.buttonClass}`}
                  >
                    {editingId ? 'Save' : 'Confirm'}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteNag(editingId);
                        setSheet(null);
                        setEditingId(null);
                      }}
                      className="mt-2 w-full rounded-lg border border-red-500/30 py-3 text-sm font-semibold text-red-500"
                    >
                      Delete
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </NagSheet>
      )}
    </div>
  );
}
