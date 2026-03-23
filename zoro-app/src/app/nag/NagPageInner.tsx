'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { NagEndEditor, NagNav, NagSheet, type NagDraft } from './nag-chrome';
import { NAG_LANDING_TOOLS, landingSectionTitle, type NagLandingTool } from './nag-dev-tools';

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
  nag_until_done?: boolean;
  followup_interval_hours?: number | null;
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

function followupOptionsForFrequency(frequency: string): { value: string; label: string }[] {
  switch (frequency) {
    case 'daily':
      return [
        { value: '', label: 'Default (24h)' },
        { value: '6', label: 'Every 6h' },
        { value: '12', label: 'Every 12h' },
        { value: '24', label: 'Every 24h' },
      ];
    case 'weekly':
      return [
        { value: '', label: 'Default (48h)' },
        { value: '24', label: 'Daily' },
        { value: '48', label: 'Every 2 days' },
        { value: '168', label: 'Weekly' },
      ];
    case 'monthly':
      return [
        { value: '', label: 'Default (weekly)' },
        { value: '72', label: 'Every 3 days' },
        { value: '168', label: 'Weekly' },
        { value: '336', label: 'Every 2 weeks' },
      ];
    case 'once':
      return [
        { value: '', label: 'Default (12h)' },
        { value: '6', label: 'Every 6h' },
        { value: '12', label: 'Every 12h' },
        { value: '24', label: 'Every 24h' },
      ];
    default:
      return [{ value: '', label: 'Default' }];
  }
}

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
    nag_until_done: false,
    followup_interval_hours: '',
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
    nag_until_done: d.nag_until_done === true,
    followup_interval_hours:
      typeof d.followup_interval_hours === 'number' ? String(d.followup_interval_hours) : '',
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
    nag_until_done: n.nag_until_done === true,
    followup_interval_hours:
      n.followup_interval_hours != null && n.followup_interval_hours !== undefined
        ? String(n.followup_interval_hours)
        : '',
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
    return 'Invalid or expired token. Use the link from your email again, or request a new one from Get started.';
  }
  if (status === 503 && json.error) {
    return json.error;
  }
  return json.error ?? `Request failed (${status})`;
}

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

  const [sentLog, setSentLog] = useState<
    { nag_id: string | null; sent_at: string; subject: string | null; body_preview: string | null }[]
  >([]);

  const [tab, setTab] = useState<'active' | 'archived'>('active');

  const [getStartedOpen, setGetStartedOpen] = useState(false);
  const [getStartedEmail, setGetStartedEmail] = useState('');
  const [getStartedName, setGetStartedName] = useState('');
  const [getStartedPhase, setGetStartedPhase] = useState<'email' | 'existing' | 'new' | 'sent'>('email');
  const [getStartedStatus, setGetStartedStatus] = useState<string | null>(null);
  const [getStartedCheckBusy, setGetStartedCheckBusy] = useState(false);
  const [getStartedSendBusy, setGetStartedSendBusy] = useState(false);

  /** Inline email flow on landing (between How it works and Developers) */
  const [landEmail, setLandEmail] = useState('');
  const [landPhase, setLandPhase] = useState<'email' | 'existing' | 'new' | 'sent'>('email');
  const [landName, setLandName] = useState('');
  const [landStatus, setLandStatus] = useState<string | null>(null);
  const [landCheckBusy, setLandCheckBusy] = useState(false);
  const [landSendBusy, setLandSendBusy] = useState(false);

  /** Last natural-language line used for Schedule / Re-parse */
  const [parseSourceText, setParseSourceText] = useState('');
  const [reparsing, setReparsing] = useState(false);

  const [profilePhone, setProfilePhone] = useState('+1 555 010 1234');
  const [profDraft, setProfDraft] = useState({
    phone: '',
    defaultVia: 'email' as 'email' | 'whatsapp',
    timezone: 'UTC',
  });

  const [selectedDevTool, setSelectedDevTool] = useState<NagLandingTool>(() => NAG_LANDING_TOOLS[0]!);
  const [devToolBodyText, setDevToolBodyText] = useState('');
  const [devToolResult, setDevToolResult] = useState<unknown>(null);
  const [devToolBusy, setDevToolBusy] = useState(false);
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

  const fetchSentLog = useCallback(async () => {
    if (!effectiveToken) return;
    try {
      const res = await fetch(
        `/api/nags/sent-log?token=${encodeURIComponent(effectiveToken)}&limit=40`
      );
      const json = (await res.json()) as {
        log?: { nag_id: string | null; sent_at: string; subject: string | null; body_preview: string | null }[];
      };
      if (res.ok) setSentLog(json.log ?? []);
    } catch {
      /* ignore */
    }
  }, [effectiveToken]);

  useEffect(() => {
    if (effectiveToken) void fetchNags();
  }, [effectiveToken, fetchNags]);

  useEffect(() => {
    if (effectiveToken) void fetchSentLog();
  }, [effectiveToken, fetchSentLog]);

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

  const parseTextIntoDraft = useCallback(
    async (raw: string, opts?: { keepEditingId?: boolean }): Promise<boolean> => {
      const text = raw.trim();
      if (!effectiveToken || !text) return false;
      setLoadError(null);
      try {
        const res = await fetch('/api/nag-parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: effectiveToken,
            text,
            default_channel: defaultChannel,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setLoadError(apiErrorMessage(res.status, json));
          return false;
        }
        const d = draftFromParse(json.draft ?? {});
        d.channel = defaultChannel;
        setDraft(d);
        if (!opts?.keepEditingId) {
          setEditingId(null);
        }
        return true;
      } catch {
        setLoadError('Parse request failed');
        return false;
      }
    },
    [effectiveToken, defaultChannel]
  );

  const onSchedule = async () => {
    if (!effectiveToken || !compose.trim()) return;
    setParsing(true);
    try {
      const ok = await parseTextIntoDraft(compose.trim());
      if (ok) {
        setParseSourceText(compose.trim());
        setSheet('confirm');
      }
    } finally {
      setParsing(false);
    }
  };

  const reparseFromDescription = async () => {
    if (!parseSourceText.trim()) return;
    setReparsing(true);
    try {
      await parseTextIntoDraft(parseSourceText.trim(), { keepEditingId: editingId != null });
    } finally {
      setReparsing(false);
    }
  };

  const buildSchedulePayload = () => {
    const emailEscalate = draft.channel === 'email' && draft.nag_until_done;
    const followRaw = draft.followup_interval_hours.trim();
    const followNum = followRaw === '' ? null : Number(followRaw);
    return {
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
      nag_until_done: emailEscalate,
      followup_interval_hours:
        emailEscalate && followNum !== null && !Number.isNaN(followNum) ? followNum : null,
    };
  };

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
      await fetchSentLog();
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
      await fetchSentLog();
    } finally {
      setSaving(false);
    }
  };

  const markTaskDone = async (id: string) => {
    if (!effectiveToken) return;
    try {
      const res = await fetch(`/api/nags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: effectiveToken, task_completed: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLoadError(apiErrorMessage(res.status, json));
        return;
      }
      await fetchNags();
    } catch {
      setLoadError('Network error');
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

  useEffect(() => {
    const t = selectedDevTool;
    setDevToolBodyText(
      t.sampleBody && Object.keys(t.sampleBody).length > 0 ? JSON.stringify(t.sampleBody, null, 2) : ''
    );
  }, [selectedDevTool]);

  const openGetStartedModal = useCallback(() => {
    setGetStartedPhase('email');
    setGetStartedName('');
    setGetStartedStatus(null);
    setGetStartedOpen(true);
  }, []);

  const checkGetStartedEmail = async () => {
    const em = getStartedEmail.trim().toLowerCase();
    if (!em) return;
    setGetStartedCheckBusy(true);
    setGetStartedStatus(null);
    try {
      const res = await fetch('/api/auth/nag-email-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em }),
      });
      const json = (await res.json()) as { error?: string; registered?: boolean };
      if (!res.ok) {
        setGetStartedStatus(json.error ?? 'Could not verify email.');
        return;
      }
      setGetStartedPhase(json.registered ? 'existing' : 'new');
    } catch {
      setGetStartedStatus('Network error.');
    } finally {
      setGetStartedCheckBusy(false);
    }
  };

  const sendNagAccessEmail = async (name?: string) => {
    const em = getStartedEmail.trim().toLowerCase();
    if (!em) return;
    setGetStartedSendBusy(true);
    setGetStartedStatus(null);
    try {
      const res = await fetch('/api/auth/nag-request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: em,
          ...(name?.trim() ? { name: name.trim() } : {}),
        }),
      });
      const json = (await res.json()) as { error?: string; success?: boolean; created?: boolean };
      if (!res.ok) {
        setGetStartedStatus(json.error ?? 'Failed to send.');
        return;
      }
      if (json.success) {
        setGetStartedPhase('sent');
        setGetStartedStatus(
          json.created
            ? 'We created your account and emailed a private link. Open it on this device to start.'
            : 'We emailed a private link to open Nags. It replaces a password — check your inbox.'
        );
      }
    } catch {
      setGetStartedStatus('Request failed.');
    } finally {
      setGetStartedSendBusy(false);
    }
  };

  const checkLandingEmail = async () => {
    const em = landEmail.trim().toLowerCase();
    if (!em) return;
    setLandCheckBusy(true);
    setLandStatus(null);
    try {
      const res = await fetch('/api/auth/nag-email-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em }),
      });
      const json = (await res.json()) as { error?: string; registered?: boolean };
      if (!res.ok) {
        setLandStatus(json.error ?? 'Could not verify email.');
        return;
      }
      setLandPhase(json.registered ? 'existing' : 'new');
    } catch {
      setLandStatus('Network error.');
    } finally {
      setLandCheckBusy(false);
    }
  };

  const sendLandingAccessEmail = async (name?: string) => {
    const em = landEmail.trim().toLowerCase();
    if (!em) return;
    setLandSendBusy(true);
    setLandStatus(null);
    try {
      const res = await fetch('/api/auth/nag-request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: em,
          ...(name?.trim() ? { name: name.trim() } : {}),
        }),
      });
      const json = (await res.json()) as { error?: string; success?: boolean; created?: boolean };
      if (!res.ok) {
        setLandStatus(json.error ?? 'Failed to send.');
        return;
      }
      if (json.success) {
        setLandPhase('sent');
        setLandStatus(
          json.created
            ? 'We created your account and emailed a private link. Open it on this device to start.'
            : 'We emailed a private link to open Nags. Check your inbox.'
        );
      }
    } catch {
      setLandStatus('Request failed.');
    } finally {
      setLandSendBusy(false);
    }
  };

  const resetLandingEmailFlow = () => {
    setLandPhase('email');
    setLandName('');
    setLandStatus(null);
  };

  const runLandingMockTool = async () => {
    const tool = selectedDevTool;
    let parsed: unknown = null;
    if (tool.method !== 'GET' && tool.method !== 'DELETE') {
      try {
        const raw = devToolBodyText.trim();
        parsed = raw ? JSON.parse(raw) : tool.sampleBody ?? null;
      } catch {
        setDevToolResult({ error: 'Body is not valid JSON.' });
        return;
      }
    }
    setDevToolBusy(true);
    setDevToolResult(null);
    await new Promise((r) => setTimeout(r, 80));
    try {
      setDevToolResult(tool.mockResponse(parsed));
    } finally {
      setDevToolBusy(false);
    }
  };

  const docsOrigin =
    (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '') || null;

  const methodPillClass = (method: NagLandingTool['method']) => {
    const base =
      'inline-flex min-w-[3rem] shrink-0 justify-center rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider';
    if (darkMode) {
      if (method === 'GET') return `${base} bg-emerald-500/20 text-emerald-300`;
      if (method === 'POST') return `${base} bg-sky-500/20 text-sky-300`;
      if (method === 'PATCH') return `${base} bg-amber-500/25 text-amber-200`;
      return `${base} bg-rose-500/20 text-rose-300`;
    }
    if (method === 'GET') return `${base} bg-emerald-100 text-emerald-900`;
    if (method === 'POST') return `${base} bg-sky-100 text-sky-900`;
    if (method === 'PATCH') return `${base} bg-amber-100 text-amber-950`;
    return `${base} bg-rose-100 text-rose-900`;
  };

  const LandingEndpointsPanel = () => {
    let prevSection = '';
    const fullUrl = (path: string) => (docsOrigin ? `${docsOrigin}${path}` : `YOUR_ORIGIN${path}`);

    return (
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <p className={`mb-3 text-[10px] font-bold uppercase tracking-widest ${theme.textSecondaryClass}`}>
            HTTP API
          </p>
          <p className={`mb-3 text-[11px] leading-snug ${theme.textSecondaryClass}`}>
            Same routes in production. Names in monospace match the Nags MCP server when shown; empty means HTTP-only
            (cron, shared auth).
          </p>
          <ul className={`rounded-xl border ${theme.borderClass} ${theme.cardBgClass} p-2`} role="list">
            {NAG_LANDING_TOOLS.map((t) => {
              const showSection = t.section !== prevSection;
              prevSection = t.section;
              return (
                <React.Fragment key={t.id}>
                  {showSection && (
                    <li className="list-none px-2 pb-2 pt-3 first:pt-1">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest ${theme.textSecondaryClass} opacity-80`}
                      >
                        {landingSectionTitle(t.section)}
                      </span>
                    </li>
                  )}
                  <li className="list-none">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDevTool(t);
                        setDevToolResult(null);
                      }}
                      className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2.5 text-left transition-colors ${
                        selectedDevTool.id === t.id
                          ? `${theme.accentBgClass} ${theme.textClass}`
                          : `hover:bg-black/5 dark:hover:bg-white/5 ${theme.textSecondaryClass}`
                      }`}
                    >
                      <span className={methodPillClass(t.method)}>{t.method}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[12px] font-semibold leading-tight">{t.rowTitle}</span>
                        <span
                          className={`mt-1 block text-[11px] leading-snug ${
                            selectedDevTool.id === t.id ? 'opacity-95' : 'opacity-80'
                          }`}
                        >
                          {t.description}
                        </span>
                      </span>
                    </button>
                  </li>
                </React.Fragment>
              );
            })}
          </ul>
        </div>

        <div className="min-w-0 lg:col-span-7">
          <p className={`mb-3 text-[10px] font-bold uppercase tracking-widest ${theme.textSecondaryClass}`}>
            REST · same contract in production
          </p>
          <div className={`rounded-xl border p-4 sm:p-5 ${theme.borderClass} ${theme.cardBgClass}`}>
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-current/10 pb-4">
              <span className={methodPillClass(selectedDevTool.method)}>{selectedDevTool.method}</span>
              <span className={`font-mono text-[13px] font-semibold sm:text-sm ${theme.textClass}`}>
                {selectedDevTool.rowTitle}
              </span>
            </div>
            {selectedDevTool.mcpName.trim() && selectedDevTool.mcpName !== selectedDevTool.rowTitle && (
              <p className={`mb-3 text-[11px] ${theme.textSecondaryClass}`}>
                MCP tool: <span className="font-mono">{selectedDevTool.mcpName}</span>
              </p>
            )}
            <p className={`mb-4 text-sm leading-relaxed ${theme.textSecondaryClass}`}>{selectedDevTool.description}</p>
            <div
              className={`overflow-x-auto rounded-lg border px-3 py-2.5 font-mono text-[11px] leading-relaxed ${theme.borderClass} ${darkMode ? 'bg-black/30' : 'bg-black/[0.03]'}`}
            >
              <span className={`select-all ${theme.textClass}`}>{fullUrl(selectedDevTool.path)}</span>
            </div>
            {!docsOrigin && (
              <p className={`mt-2 text-[11px] leading-relaxed ${theme.textSecondaryClass}`}>
                In production, <code className="font-mono text-[10px]">YOUR_ORIGIN</code> is your deployed site (e.g.{' '}
                <code className="font-mono text-[10px]">https://www.getzoro.com</code>). Set{' '}
                <code className="font-mono text-[10px]">NEXT_PUBLIC_APP_URL</code> or{' '}
                <code className="font-mono text-[10px]">NEXT_PUBLIC_BASE_URL</code> at build time to preview full URLs
                here.
              </p>
            )}

            {selectedDevTool.sampleBody != null && Object.keys(selectedDevTool.sampleBody).length > 0 && (
              <label className={`mt-5 block ${theme.textSecondaryClass}`}>
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide">Sample body (JSON)</span>
                <textarea
                  rows={9}
                  className={`w-full rounded-lg border px-3 py-2 font-mono text-[11px] leading-relaxed ${theme.inputBgClass}`}
                  value={devToolBodyText}
                  onChange={(e) => setDevToolBodyText(e.target.value)}
                  spellCheck={false}
                />
              </label>
            )}

            <button
              type="button"
              disabled={devToolBusy}
              onClick={() => void runLandingMockTool()}
              className={`mt-5 w-full rounded-lg py-3 text-sm font-bold disabled:opacity-40 sm:w-auto sm:px-8 ${theme.buttonClass}`}
            >
              {devToolBusy ? '…' : `Show sample response · ${selectedDevTool.rowTitle}`}
            </button>
            <pre
              className={`mt-4 max-h-80 overflow-auto rounded-lg border p-4 text-[11px] leading-relaxed ${theme.borderClass} ${darkMode ? 'bg-black/25' : 'bg-black/[0.02]'} ${theme.textClass}`}
            >
              {devToolResult
                ? JSON.stringify(devToolResult, null, 2)
                : 'Select a tool, then show sample JSON (offline — no request is sent).'}
            </pre>
          </div>
        </div>
      </div>
    );
  };

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
                onClick={() => openGetStartedModal()}
                className={`rounded-lg px-7 py-3 text-sm font-bold ${theme.buttonClass}`}
              >
                Get started
              </button>
              <a
                href="#developer"
                className={`rounded-lg border px-7 py-3 text-sm font-bold ${theme.borderClass} ${theme.textSecondaryClass}`}
              >
                Developers
              </a>
            </div>
            <p className={`mt-4 text-[11px] opacity-50 ${theme.textSecondaryClass}`}>
              For you: email link. For devs: endpoint reference below.
            </p>
          </section>

        <section className={`border-y px-5 py-16 ${theme.borderClass} ${darkMode ? 'bg-[#111115]' : 'bg-white'}`}>
          <div className="mx-auto max-w-[680px]">
            <p className={`mb-2 text-[10px] font-bold uppercase tracking-widest ${theme.textSecondaryClass}`}>
              How it works
            </p>
            <h2 className={`mb-8 text-[clamp(1.35rem,4vw,2rem)] font-extrabold tracking-tight ${theme.textClass}`}>
              Three steps. Zero friction.
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ['1', 'Tell Zoro', 'Type anything natural. Zoro figures out the schedule.'],
                ['2', 'Confirm', 'Review parsed time, frequency, and end date.'],
                ['3', 'Get nagged', 'WhatsApp or email until done or date passes.'],
              ].map(([n, title, body]) => (
                <div
                  key={n}
                  className={`min-w-0 rounded-xl border p-4 ${theme.borderClass} ${darkMode ? 'bg-[#09090c]' : 'bg-[#f5f5f7]'}`}
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

        <section
          className={`border-t px-5 py-16 ${theme.borderClass} ${darkMode ? 'bg-[#09090c]' : 'bg-[#f5f5f7]'}`}
        >
          <div className={`mx-auto max-w-[480px] rounded-xl border p-6 ${theme.borderClass} ${theme.cardBgClass}`}>
            <p className={`mb-2 text-[10px] font-bold uppercase tracking-widest ${theme.textSecondaryClass}`}>
              Sign in
            </p>
            <h2 className={`mb-2 text-xl font-bold ${theme.textClass}`}>Enter your email</h2>
            <p className={`mb-5 text-sm leading-relaxed ${theme.textSecondaryClass}`}>
              No password — we&apos;ll email you a private link to open Nags. New here? We&apos;ll ask for your first name
              next.
            </p>

            {landPhase === 'email' && (
              <>
                <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={`mb-3 w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                  value={landEmail}
                  onChange={(e) => setLandEmail(e.target.value)}
                />
                <button
                  type="button"
                  disabled={landCheckBusy || !landEmail.trim()}
                  onClick={() => void checkLandingEmail()}
                  className={`w-full rounded-lg py-3 text-sm font-bold disabled:opacity-40 ${theme.buttonClass}`}
                >
                  {landCheckBusy ? 'Checking…' : 'Continue'}
                </button>
              </>
            )}

            {landPhase === 'existing' && (
              <>
                <p className={`mb-4 text-sm leading-relaxed ${theme.textSecondaryClass}`}>
                  We found an account for <span className="font-medium text-current">{landEmail.trim()}</span>. We&apos;ll
                  send one email with your link.
                </p>
                <button
                  type="button"
                  disabled={landSendBusy}
                  onClick={() => void sendLandingAccessEmail()}
                  className={`w-full rounded-lg py-3 text-sm font-bold disabled:opacity-40 ${theme.buttonClass}`}
                >
                  {landSendBusy ? 'Sending…' : 'Send link'}
                </button>
                <button
                  type="button"
                  onClick={resetLandingEmailFlow}
                  className={`mt-3 w-full rounded-lg border py-2.5 text-sm font-semibold ${theme.borderClass} ${theme.textSecondaryClass}`}
                >
                  Different email
                </button>
              </>
            )}

            {landPhase === 'new' && (
              <>
                <p className={`mb-4 text-sm leading-relaxed ${theme.textSecondaryClass}`}>
                  New email — add your first name, then we create your account and send the link.
                </p>
                <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Name</label>
                <input
                  type="text"
                  autoComplete="given-name"
                  placeholder="Alex"
                  className={`mb-3 w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                  value={landName}
                  onChange={(e) => setLandName(e.target.value)}
                />
                <button
                  type="button"
                  disabled={landSendBusy || !landName.trim()}
                  onClick={() => void sendLandingAccessEmail(landName)}
                  className={`w-full rounded-lg py-3 text-sm font-bold disabled:opacity-40 ${theme.buttonClass}`}
                >
                  {landSendBusy ? 'Sending…' : 'Create account & send link'}
                </button>
                <button
                  type="button"
                  onClick={resetLandingEmailFlow}
                  className={`mt-3 w-full rounded-lg border py-2.5 text-sm font-semibold ${theme.borderClass} ${theme.textSecondaryClass}`}
                >
                  Back
                </button>
              </>
            )}

            {landPhase === 'sent' && (
              <>
                <p className={`text-sm leading-relaxed ${theme.textSecondaryClass}`}>{landStatus}</p>
                <button
                  type="button"
                  onClick={() => {
                    resetLandingEmailFlow();
                    setLandEmail('');
                  }}
                  className={`mt-6 w-full rounded-lg py-3 text-sm font-bold ${theme.buttonClass}`}
                >
                  Done
                </button>
              </>
            )}

            {landPhase !== 'sent' && landStatus && (
              <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">{landStatus}</p>
            )}
          </div>
        </section>

        <section
          id="developer"
          className={`scroll-mt-14 border-t px-5 py-16 sm:py-20 ${theme.borderClass} ${darkMode ? 'bg-[#09090c]' : 'bg-[#f5f5f7]'}`}
        >
          <div className="mx-auto max-w-5xl">
            <header className="mb-10 max-w-3xl">
              <p className={`mb-2 text-[10px] font-bold uppercase tracking-widest ${theme.textSecondaryClass}`}>
                Developers
              </p>
              <h2
                className={`text-[clamp(1.5rem,4vw,2.25rem)] font-extrabold leading-tight tracking-tight ${theme.textClass}`}
              >
                MCP tools & REST API
              </h2>
              <p className={`mt-3 text-sm leading-relaxed sm:text-[15px] ${theme.textSecondaryClass}`}>
                Names match the <span className="font-mono text-[12px] text-current/90">zoro-nags</span> MCP server in
                this repo. Each tool calls one origin-relative route — deploy the same app to production and swap the host;
                paths stay <code className="font-mono text-[11px]">/api/…</code>. Sample responses below are static (no
                network).
              </p>
            </header>
            <LandingEndpointsPanel />
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
              setGetStartedPhase('email');
            }}
          >
            <p className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${theme.textSecondaryClass}`}>
              Get started
            </p>

            {getStartedPhase === 'email' && (
              <>
                <h2 className={`mb-2 text-lg font-bold ${theme.textClass}`}>Your email</h2>
                <p className={`mb-4 text-sm leading-relaxed ${theme.textSecondaryClass}`}>
                  We check whether you already have a Zoro account. Next step depends on that — no password, just a link in
                  your inbox.
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
                  disabled={getStartedCheckBusy || !getStartedEmail.trim()}
                  onClick={() => void checkGetStartedEmail()}
                  className={`w-full rounded-lg py-3 text-sm font-bold disabled:opacity-40 ${theme.buttonClass}`}
                >
                  {getStartedCheckBusy ? 'Checking…' : 'Continue'}
                </button>
              </>
            )}

            {getStartedPhase === 'existing' && (
              <>
                <h2 className={`mb-2 text-lg font-bold ${theme.textClass}`}>Welcome back</h2>
                <p className={`mb-4 text-sm leading-relaxed ${theme.textSecondaryClass}`}>
                  We found an account for <span className="font-medium">{getStartedEmail.trim()}</span>. We&apos;ll send one
                  email with a private link to open Nags on this device.
                </p>
                <button
                  type="button"
                  disabled={getStartedSendBusy}
                  onClick={() => void sendNagAccessEmail()}
                  className={`w-full rounded-lg py-3 text-sm font-bold disabled:opacity-40 ${theme.buttonClass}`}
                >
                  {getStartedSendBusy ? 'Sending…' : 'Send link'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGetStartedPhase('email');
                    setGetStartedStatus(null);
                  }}
                  className={`mt-3 w-full rounded-lg border py-2.5 text-sm font-semibold ${theme.borderClass} ${theme.textSecondaryClass}`}
                >
                  Different email
                </button>
              </>
            )}

            {getStartedPhase === 'new' && (
              <>
                <h2 className={`mb-2 text-lg font-bold ${theme.textClass}`}>New here</h2>
                <p className={`mb-4 text-sm leading-relaxed ${theme.textSecondaryClass}`}>
                  No account for this email yet. Add your first name, then we create your account and email a sign-in link.
                  Same link you&apos;ll use later — keep it private like a password.
                </p>
                <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Name</label>
                <input
                  type="text"
                  autoComplete="given-name"
                  placeholder="Alex"
                  className={`mb-3 w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                  value={getStartedName}
                  onChange={(e) => setGetStartedName(e.target.value)}
                />
                <button
                  type="button"
                  disabled={getStartedSendBusy || !getStartedName.trim()}
                  onClick={() => void sendNagAccessEmail(getStartedName)}
                  className={`w-full rounded-lg py-3 text-sm font-bold disabled:opacity-40 ${theme.buttonClass}`}
                >
                  {getStartedSendBusy ? 'Sending…' : 'Create account & send link'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGetStartedPhase('email');
                    setGetStartedStatus(null);
                  }}
                  className={`mt-3 w-full rounded-lg border py-2.5 text-sm font-semibold ${theme.borderClass} ${theme.textSecondaryClass}`}
                >
                  Back
                </button>
              </>
            )}

            {getStartedPhase === 'sent' && (
              <>
                <h2 className={`mb-2 text-lg font-bold ${theme.textClass}`}>Check your email</h2>
                <p className={`text-sm leading-relaxed ${theme.textSecondaryClass}`}>{getStartedStatus}</p>
                <button
                  type="button"
                  onClick={() => {
                    setGetStartedOpen(false);
                    setGetStartedPhase('email');
                    setGetStartedStatus(null);
                  }}
                  className={`mt-6 w-full rounded-lg py-3 text-sm font-bold ${theme.buttonClass}`}
                >
                  Done
                </button>
              </>
            )}

            {getStartedPhase !== 'sent' && getStartedStatus && (
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

        {sentLog.length > 0 && (
          <div className={`mb-4 rounded-[14px] border p-3 ${theme.borderClass} ${theme.cardBgClass}`}>
            <p className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${theme.textSecondaryClass}`}>
              Recent reminder emails
            </p>
            <p className={`mb-2 text-[11px] leading-snug ${theme.textSecondaryClass}`}>
              Pulled from your Zoro outbound email log (same memory as the assistant). New sends appear after
              delivery.
            </p>
            <ul className="max-h-40 space-y-2 overflow-y-auto text-xs">
              {sentLog.map((e, idx) => (
                <li key={`${e.sent_at}-${idx}`} className={`border-b pb-2 last:border-0 ${theme.borderClass}`}>
                  <div className={`font-medium ${theme.textClass}`}>
                    {formatNext(e.sent_at, profileTimezone)}
                  </div>
                  {e.subject && (
                    <div className={`truncate ${theme.textSecondaryClass}`}>{e.subject}</div>
                  )}
                  {e.body_preview && (
                    <div className={`mt-0.5 line-clamp-2 ${theme.textSecondaryClass}`}>{e.body_preview}</div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

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
                    setParseSourceText(n.message);
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
                    {n.nag_until_done && n.channel === 'email' && (
                      <span className={`rounded-full border border-amber-500/40 px-2 py-0.5 text-amber-700 dark:text-amber-300 ${theme.borderClass}`}>
                        until done
                      </span>
                    )}
                    {tab === 'active' && (
                      <span className={theme.textSecondaryClass}>
                        next {formatNext(n.next_at, profileTimezone)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
                  {tab === 'active' && n.nag_until_done && n.channel === 'email' && (
                    <button
                      type="button"
                      className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${theme.borderClass} ${theme.textClass}`}
                      onClick={() => void markTaskDone(n.id)}
                      title="Mark task done for this cycle"
                    >
                      Done
                    </button>
                  )}
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
                        ...(draft.frequency === 'weekly' && draft.day_of_week != null
                          ? ([
                              [
                                'Day',
                                WEEKDAYS.find((w) => w.v === draft.day_of_week)?.l ?? '—',
                              ],
                            ] as const)
                          : draft.frequency === 'daily'
                            ? ([['Day', 'Every day']] as const)
                            : draft.frequency === 'monthly' && draft.day_of_month != null
                              ? ([['Day', `${draft.day_of_month} of month`]] as const)
                              : []),
                        ['Time', `${draft.time_hhmm} · ${profileTimezone}`],
                        [
                          'Until',
                          draft.end_type === 'forever'
                            ? 'forever'
                            : draft.end_type === 'occurrences'
                              ? `${draft.occurrences_max}×`
                              : draft.until_date || '—',
                        ],
                        ...(draft.channel === 'email'
                          ? ([
                              [
                                'Until done',
                                draft.nag_until_done
                                  ? followupOptionsForFrequency(draft.frequency).find(
                                      (o) => o.value === draft.followup_interval_hours
                                    )?.label ?? 'Default'
                                  : 'Off',
                              ],
                            ] as const)
                          : []),
                      ] as const
                    ).map(([k, v], i) => (
                      <div key={`${i}-${k}`} className={`min-w-[70px] flex-1 rounded-lg p-2.5 ${theme.accentBgClass}`}>
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
                  <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>
                    Describe schedule
                  </label>
                  <textarea
                    rows={2}
                    className={`mb-2 w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                    placeholder="e.g. mow the lawn every Wednesday at 5pm"
                    value={parseSourceText}
                    onChange={(e) => setParseSourceText(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={reparsing || !parseSourceText.trim()}
                    onClick={() => void reparseFromDescription()}
                    className={`mb-4 w-full rounded-lg border py-2.5 text-sm font-semibold disabled:opacity-40 ${theme.borderClass} ${theme.textClass}`}
                  >
                    {reparsing ? 'Parsing…' : 'Re-parse from text'}
                  </button>
                  <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Task</label>
                  <input
                    className={`mb-3 w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                    value={draft.message}
                    onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
                  />
                  <div className="mb-3 flex gap-2">
                    <div className="flex-1">
                      <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>
                        Time ({profileTimezone})
                      </label>
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
                        onChange={(e) => {
                          const nf = e.target.value;
                          setDraft((d) => {
                            const opts = followupOptionsForFrequency(nf).map((x) => x.value);
                            const keep = opts.includes(d.followup_interval_hours);
                            return {
                              ...d,
                              frequency: nf,
                              followup_interval_hours: keep ? d.followup_interval_hours : '',
                            };
                          });
                        }}
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
                  {draft.channel === 'email' && (
                    <div className="mb-4">
                      <label
                        className={`mb-2 flex cursor-pointer items-start gap-2 text-sm ${theme.textClass}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={draft.nag_until_done}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              nag_until_done: e.target.checked,
                              followup_interval_hours: e.target.checked ? d.followup_interval_hours : '',
                            }))
                          }
                        />
                        <span>
                          <span className="font-semibold">Nag until I mark it done</span>
                          <span className={`mt-0.5 block text-xs font-normal ${theme.textSecondaryClass}`}>
                            After each reminder, send follow-ups on the interval below until you tap Mark done.
                          </span>
                        </span>
                      </label>
                      {draft.nag_until_done && (
                        <div className="mt-2">
                          <label
                            className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}
                          >
                            Follow-up interval
                          </label>
                          <select
                            className={`w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                            value={draft.followup_interval_hours}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, followup_interval_hours: e.target.value }))
                            }
                          >
                            {followupOptionsForFrequency(draft.frequency).map((o, oi) => (
                              <option key={`${oi}-${o.value}-${o.label}`} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                  <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Channel</label>
                  <div className={`mb-4 flex rounded-lg p-0.5 ${theme.accentBgClass}`}>
                    {(['email', 'whatsapp'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            channel: v,
                            ...(v !== 'email' ? { nag_until_done: false, followup_interval_hours: '' } : {}),
                          }))
                        }
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
