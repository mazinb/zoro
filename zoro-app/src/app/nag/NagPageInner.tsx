'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { NagEndEditor, NagNav, NagSheet, type NagDraft } from './nag-chrome';
import { NAG_LANDING_TOOLS, landingSectionTitle, type NagLandingTool } from './nag-dev-tools';
import { SmitheryConnectBar } from '@/components/nag/SmitheryConnectBar';
import { McpLandingToolsExplorer } from '@/components/mcp/McpLandingToolsExplorer';
import { HelpCircle, X } from 'lucide-react';

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
  webhook_id?: string | null;
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

function buildPublicOrigin(): string {
  const v = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || '').trim();
  if (v) return v.replace(/\/$/, '');
  return 'https://www.getzoro.com';
}

const NAG_MCP_URL = `${buildPublicOrigin()}/api/mcp/nags`;

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
    webhook_id: '',
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
    webhook_id: typeof d.webhook_id === 'string' ? d.webhook_id : '',
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
    webhook_id: typeof n.webhook_id === 'string' ? n.webhook_id : '',
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

type NagWebhookRow = { id: string; url: string; verified_at: string | null; created_at: string };

function shortHookUrl(u: string, max = 40): string {
  if (u.length <= max) return u;
  return `${u.slice(0, max - 1)}…`;
}

function viaLabel(n: Nag, hooks: NagWebhookRow[]): string {
  if (n.channel === 'webhook' && n.webhook_id) {
    const h = hooks.find((x) => x.id === n.webhook_id);
    return h ? shortHookUrl(h.url) : 'Webhook';
  }
  if (n.channel === 'whatsapp') return 'WhatsApp';
  return 'Email';
}

function draftViaLabel(d: NagDraft, hooks: NagWebhookRow[]): string {
  if (d.channel === 'webhook' && d.webhook_id) {
    const h = hooks.find((x) => x.id === d.webhook_id);
    return h ? shortHookUrl(h.url, 28) : 'Webhook';
  }
  if (d.channel === 'whatsapp') return 'WhatsApp';
  return 'Email';
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
  const completeNagFromUrl = searchParams.get('complete_nag')?.trim() ?? '';
  const completedFromUrl = searchParams.get('completed') === '1';
  const envDevToken = (process.env.NEXT_PUBLIC_NAG_DEV_TOKEN ?? '').trim();

  const [forceLogout, setForceLogout] = useState(false);
  useEffect(() => {
    try {
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
      sessionStorage.setItem(NAG_TOKEN_STORAGE, urlToken.trim());
    } catch {
      /* ignore */
    }
  }, [urlToken]);

  // Intentional: require an explicit token in URL (or env dev token) for /nag.
  // We do not auto-sign-in from prior sessionStorage tokens.
  const effectiveToken = urlToken || (!forceLogout && envDevToken) || '';

  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);

  const [nags, setNags] = useState<Nag[]>([]);
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [nagDeveloper, setNagDeveloper] = useState(false);
  const [profileWebhooks, setProfileWebhooks] = useState<NagWebhookRow[]>([]);
  const [profileTimezone, setProfileTimezone] = useState('UTC');
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [completionNotice, setCompletionNotice] = useState<string | null>(null);

  const [compose, setCompose] = useState('');
  const [defaultChannel, setDefaultChannel] = useState<'email' | 'whatsapp'>('email');
  const [parsing, setParsing] = useState(false);

  const [sheet, setSheet] = useState<'confirm' | 'edit' | 'profile' | null>(null);
  const [draft, setDraft] = useState<NagDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  type ReminderLogEntry = {
    nag_id: string | null;
    sent_at: string;
    subject: string | null;
    body_preview: string | null;
  };
  const [profileReminderLog, setProfileReminderLog] = useState<ReminderLogEntry[]>([]);
  const [profileReminderLogLoading, setProfileReminderLogLoading] = useState(false);
  const [profileReminderLogError, setProfileReminderLogError] = useState<string | null>(null);
  const [profileReminderLogOpen, setProfileReminderLogOpen] = useState(false);
  const [restoreConfirmNag, setRestoreConfirmNag] = useState<Nag | null>(null);
  const completionHandledRef = useRef<string>('');

  const [tab, setTab] = useState<'active' | 'archived'>('active');

  const [getStartedOpen, setGetStartedOpen] = useState(false);
  const [getStartedEmail, setGetStartedEmail] = useState('');
  const [getStartedName, setGetStartedName] = useState('');
  const [getStartedPhase, setGetStartedPhase] = useState<'email' | 'existing' | 'new' | 'sent'>('email');
  const [getStartedStatus, setGetStartedStatus] = useState<string | null>(null);
  const [getStartedCheckBusy, setGetStartedCheckBusy] = useState(false);
  const [getStartedSendBusy, setGetStartedSendBusy] = useState(false);

  const [profilePhone, setProfilePhone] = useState('+1 555 010 1234');
  const [tokenCopied, setTokenCopied] = useState(false);
  const [tokenResetBusy, setTokenResetBusy] = useState(false);
  const [tokenResetError, setTokenResetError] = useState<string | null>(null);
  const [tokenResetNotice, setTokenResetNotice] = useState<string | null>(null);
  const [mcpGuideOpen, setMcpGuideOpen] = useState(false);
  const [mcpLandingGuideOpen, setMcpLandingGuideOpen] = useState(false);
  const [mcpJsonCopied, setMcpJsonCopied] = useState(false);
  const [profDraft, setProfDraft] = useState({
    phone: '',
    defaultVia: 'email' as 'email' | 'whatsapp',
    timezone: 'UTC',
  });
  const [resetTokenConfirm, setResetTokenConfirm] = useState(false);
  const [devSheetOpen, setDevSheetOpen] = useState(false);
  const [devSheetEmail, setDevSheetEmail] = useState('');
  const [devSheetSending, setDevSheetSending] = useState(false);
  const [devSheetMessage, setDevSheetMessage] = useState<'idle' | 'sent' | 'not_registered' | 'error'>('idle');
  const [devSheetError, setDevSheetError] = useState<string | null>(null);
  const openMcpGuide = useCallback(() => {
    setMcpGuideOpen(true);
  }, []);

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
      setNagDeveloper(Boolean(json.profile?.nag_developer));
      setProfileWebhooks(
        Array.isArray(json.profile?.webhooks)
          ? (json.profile.webhooks as NagWebhookRow[])
          : []
      );
      setProfileTimezone(
        typeof json.profile?.timezone === 'string' && json.profile.timezone.trim()
          ? json.profile.timezone.trim()
          : 'UTC'
      );
    } catch {
      setLoadError('Network error');
      setNags([]);
    } finally {
      setLoadingList(false);
    }
  }, [effectiveToken]);

  const loadProfileReminderLog = useCallback(async () => {
    if (!effectiveToken) return;
    setProfileReminderLogLoading(true);
    setProfileReminderLogError(null);
    try {
      const res = await fetch(
        `/api/nags/sent-log?token=${encodeURIComponent(effectiveToken)}&limit=40`
      );
      const json = (await res.json()) as { error?: string; log?: ReminderLogEntry[] };
      if (!res.ok) {
        setProfileReminderLogError(json.error ?? `Could not load log (${res.status})`);
        setProfileReminderLog([]);
        return;
      }
      setProfileReminderLog(json.log ?? []);
    } catch {
      setProfileReminderLogError('Network error while loading reminder log.');
      setProfileReminderLog([]);
    } finally {
      setProfileReminderLogLoading(false);
    }
  }, [effectiveToken]);

  useEffect(() => {
    if (effectiveToken) void fetchNags();
  }, [effectiveToken, fetchNags]);

  useEffect(() => {
    if (nagDeveloper && defaultChannel === 'whatsapp') {
      setDefaultChannel('email');
    }
  }, [nagDeveloper, defaultChannel]);

  useEffect(() => {
    if (completedFromUrl) {
      setCompletionNotice(
        'Marked complete. The nag is in Archived — open that tab if you want to restore it or delete it.'
      );
    }
  }, [completedFromUrl]);

  useEffect(() => {
    const nagId = completeNagFromUrl;
    if (!nagId || !effectiveToken) return;

    const key = `${effectiveToken}:${nagId}`;
    if (completionHandledRef.current === key) return;
    completionHandledRef.current = key;

    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetch(`/api/nags/${nagId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: effectiveToken, task_completed: true }),
        });
        const json = await res.json();
        if (!res.ok) {
          if (!cancelled) setLoadError(apiErrorMessage(res.status, json));
          return;
        }
        if (!cancelled) {
          setCompletionNotice(
            'Task marked complete from your email link. It is in Archived — open that tab to restore or delete.'
          );
          setTab('archived');
          await fetchNags();
          if (profileReminderLogOpen) void loadProfileReminderLog();
          const next = new URLSearchParams(searchParams.toString());
          next.delete('complete_nag');
          next.set('completed', '1');
          if (urlToken) next.set('token', urlToken);
          router.replace(`/nag?${next.toString()}`);
        }
      } catch {
        if (!cancelled) setLoadError('Could not mark task complete from link. Please try again.');
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    completeNagFromUrl,
    effectiveToken,
    fetchNags,
    loadProfileReminderLog,
    profileReminderLogOpen,
    router,
    searchParams,
    urlToken,
  ]);

  const activeList = useMemo(() => nags.filter((n) => n.status === 'active'), [nags]);
  const archivedList = useMemo(() => nags.filter((n) => n.status === 'archived'), [nags]);
  const shown = tab === 'active' ? activeList : archivedList;
  const openProfile = () => {
    setProfileSaveError(null);
    setTokenResetError(null);
    setTokenResetNotice(null);
    setTokenCopied(false);
    setResetTokenConfirm(false);
    setProfileReminderLogOpen(false);
    setProfileReminderLog([]);
    setProfileReminderLogError(null);
    setProfDraft({
      phone: profilePhone,
      defaultVia: defaultChannel,
      timezone: profileTimezone,
    });
    setSheet('profile');
  };

  const copyToken = async () => {
    if (!effectiveToken) return;
    try {
      await navigator.clipboard.writeText(effectiveToken);
      setTokenCopied(true);
      window.setTimeout(() => setTokenCopied(false), 1400);
    } catch {
      setTokenResetError('Could not copy token. Copy it manually.');
    }
  };

  const resetToken = async () => {
    if (!effectiveToken) return;
    setTokenResetError(null);
    setTokenResetNotice(null);
    setTokenResetBusy(true);
    try {
      const res = await fetch('/api/auth/nag-reset-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: effectiveToken }),
      });
      const json = (await res.json()) as { error?: string; token?: string; message?: string };
      if (!res.ok) {
        setTokenResetError(json.error ?? 'Could not reset token.');
        return;
      }
      const nextToken = typeof json.token === 'string' ? json.token.trim() : '';
      if (nextToken) {
        try {
          sessionStorage.setItem(NAG_TOKEN_STORAGE, nextToken);
        } catch {
          /* ignore */
        }
        if (urlToken) {
          const next = new URLSearchParams(searchParams.toString());
          next.set('token', nextToken);
          router.replace(`/nag?${next.toString()}`);
        }
      }
      setTokenResetNotice(
        json.message ?? 'Token reset. Your access token has been refreshed on this device.'
      );
    } catch {
      setTokenResetError('Network error while resetting token.');
    } finally {
      setTokenResetBusy(false);
    }
  };

  const copyMcpJson = async (tokenToUse: string) => {
    // Copy exactly the snippet shown in the modal so it can be pasted into `mcp.json`
    // under `mcpServers` without extra wrapping braces.
    const safeToken = String(tokenToUse).replace(/"/g, '\\"');
    const payloadSnippet = `"zoro-nags": {\n  "url": "${NAG_MCP_URL}",\n  "headers": {\n    "token": "${safeToken}"\n  }\n}`;
    try {
      await navigator.clipboard.writeText(payloadSnippet);
      setMcpJsonCopied(true);
      window.setTimeout(() => setMcpJsonCopied(false), 1400);
    } catch {
      setTokenResetError('Could not copy MCP JSON.');
    }
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
            default_channel: nagDeveloper ? 'email' : defaultChannel,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setLoadError(apiErrorMessage(res.status, json));
          return false;
        }
        const d = draftFromParse(json.draft ?? {});
        d.channel = nagDeveloper ? 'email' : defaultChannel;
        if (d.channel !== 'webhook') d.webhook_id = '';
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
    [effectiveToken, defaultChannel, nagDeveloper]
  );

  const onSchedule = async () => {
    if (!effectiveToken || !compose.trim()) return;
    setParsing(true);
    try {
      const ok = await parseTextIntoDraft(compose.trim());
      if (ok) {
        setSheet('confirm');
      }
    } finally {
      setParsing(false);
    }
  };

  const buildSchedulePayload = () => {
    const emailEscalate = draft.channel === 'email' && draft.nag_until_done;
    const followRaw = draft.followup_interval_hours.trim();
    const followNum = followRaw === '' ? null : Number(followRaw);
    const payload: Record<string, unknown> = {
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
    if (draft.channel === 'webhook') {
      const w = draft.webhook_id.trim();
      if (w) payload.webhook_id = w;
    }
    return payload;
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
      if (profileReminderLogOpen) void loadProfileReminderLog();
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
      if (profileReminderLogOpen) void loadProfileReminderLog();
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
      setCompletionNotice('Marked done. Moved to Archived — switch tabs to restore or delete.');
      setTab('archived');
      await fetchNags();
      if (profileReminderLogOpen) void loadProfileReminderLog();
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
    setTab('archived');
  };

  const confirmRestoreNag = async () => {
    const id = restoreConfirmNag?.id;
    if (!effectiveToken || !id) return;
    try {
      const res = await fetch(`/api/nags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: effectiveToken, status: 'active' }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLoadError(apiErrorMessage(res.status, json));
        return;
      }
      setRestoreConfirmNag(null);
      setTab('active');
      setCompletionNotice('Restored to Active. Next send time was recalculated from your schedule.');
      await fetchNags();
    } catch {
      setLoadError('Network error');
    }
  };

  const deleteNag = async (id: string) => {
    if (!effectiveToken) return;
    await fetch(`/api/nags/${id}?token=${encodeURIComponent(effectiveToken)}`, { method: 'DELETE' });
    await fetchNags();
  };

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

  const handleDevSheetMagicLink = useCallback(async () => {
    const email = devSheetEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setDevSheetError('Valid email required.');
      return;
    }
    setDevSheetSending(true);
    setDevSheetError(null);
    setDevSheetMessage('idle');
    try {
      const res = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectPath: '/nag/developer', context: 'nag' }),
      });
      const json = (await res.json()) as { error?: string; registered?: boolean };
      if (!res.ok) {
        setDevSheetMessage('error');
        setDevSheetError(json.error ?? 'Something went wrong.');
        return;
      }
      if (json.registered === false) {
        setDevSheetMessage('not_registered');
        setDevSheetError(null);
        return;
      }
      setDevSheetMessage('sent');
      setDevSheetError(null);
    } catch (e) {
      setDevSheetMessage('error');
      setDevSheetError(e instanceof Error ? e.message : 'Failed to send link.');
    } finally {
      setDevSheetSending(false);
    }
  }, [devSheetEmail]);

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

  const docsOrigin = buildPublicOrigin();

  if (!effectiveToken) {
    return (
      <>
        <div className={`min-h-screen ${darkMode ? 'bg-[#09090c]' : 'bg-[#f5f5f7]'} ${theme.textClass}`}>
          <NagNav
            theme={theme}
            darkMode={darkMode}
            dashboard
            hasToken={false}
            onProfile={() => {}}
            onToggleTheme={toggleDarkMode}
          />
          <section className="px-5 py-20 text-center">
            <h1 className={`mx-auto max-w-[min(100%,420px)] text-[clamp(2rem,8vw,3.75rem)] font-black leading-tight tracking-tight ${theme.textClass}`}>
              Reminders that
              <br />
              actually work.
            </h1>
            <p className={`mx-auto mt-4 max-w-sm text-[15px] leading-relaxed ${theme.textSecondaryClass}`}>
              Tell Zoro what you need to do and it will nag you till it is get&apos;s done
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => openGetStartedModal()}
                className={`rounded-lg px-7 py-3 text-sm font-bold ${theme.buttonClass}`}
              >
                Get started
              </button>
              <button
                type="button"
                onClick={() => {
                  setDevSheetOpen(true);
                  setDevSheetMessage('idle');
                  setDevSheetError(null);
                }}
                className={`rounded-lg border px-7 py-3 text-sm font-bold ${theme.borderClass} ${theme.textSecondaryClass}`}
              >
                Developers
              </button>
            </div>
            <p className={`mt-4 text-[11px] opacity-50 ${theme.textSecondaryClass}`}>
              Password-less secure login. You are always in control
            </p>
            <div className="mx-auto mt-6 max-w-[680px] text-left">
              <SmitheryConnectBar compact darkMode={darkMode} />
            </div>
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
                ['1', 'Tell Zoro', 'Describe what needs to be done and by when'],
                ['2', 'Confirm', 'You are always in control, update at any time'],
                ['3', 'Get nagged', 'Get nagged until you say that you are done'],
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

        <section className={`px-5 py-16 ${theme.borderClass} ${darkMode ? 'bg-[#09090c]' : 'bg-[#f5f5f7]'}`}>
          <div className="mx-auto max-w-[680px]">
            <p className={`mb-2 text-[10px] font-bold uppercase tracking-widest ${theme.textSecondaryClass}`}>
              Get started
            </p>
            <h2 className={`mb-4 text-[clamp(1.35rem,4vw,2rem)] font-extrabold tracking-tight ${theme.textClass}`}>
              Get your private link
            </h2>
            <p className={`mb-6 max-w-[520px] text-sm leading-relaxed ${theme.textSecondaryClass}`}>
              We&apos;ll check if you already have an account and email a link with your token.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                  value={getStartedEmail}
                  onChange={(e) => setGetStartedEmail(e.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={getStartedCheckBusy || !getStartedEmail.trim()}
                onClick={() => {
                  setGetStartedOpen(true);
                  setGetStartedPhase('email');
                  setGetStartedStatus(null);
                  setGetStartedName('');
                  void checkGetStartedEmail();
                }}
                className={`rounded-lg px-7 py-3 text-sm font-bold disabled:opacity-40 ${theme.buttonClass}`}
              >
                {getStartedCheckBusy ? 'Checking…' : 'Continue'}
              </button>
            </div>
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
              <div className="flex items-start gap-2">
                <h2
                  className={`text-[clamp(1.5rem,4vw,2.25rem)] font-extrabold leading-tight tracking-tight ${theme.textClass}`}
                >
                  MCP tools & REST API
                </h2>
              <button
                type="button"
                  title="MCP connection steps"
                  aria-label="MCP connection steps"
                  onClick={() => setMcpLandingGuideOpen(true)}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                  className={`flex h-[32px] w-[32px] items-center justify-center rounded-md border text-xs font-black ${theme.borderClass} ${theme.textSecondaryClass} hover:bg-black/5 dark:hover:bg-white/5 pointer-events-auto`}
              >
                  <HelpCircle size={16} />
              </button>
              </div>
            </header>

            <McpLandingToolsExplorer
              tools={NAG_LANDING_TOOLS as unknown as NagLandingTool[]}
              sectionTitle={landingSectionTitle}
              theme={theme}
              darkMode={darkMode}
              docsOrigin={docsOrigin}
              title="HTTP API"
              subtitle="Same /api routes."
            />
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
                <h2 className={`mb-4 text-lg font-bold ${theme.textClass}`}>Your email</h2>
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

        {devSheetOpen && (
          <NagSheet
            theme={theme}
            onClose={() => {
              setDevSheetOpen(false);
              setDevSheetMessage('idle');
              setDevSheetError(null);
            }}
          >
            <p className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${theme.textSecondaryClass}`}>
              Developers
            </p>
            <h2 className={`mb-2 text-lg font-bold ${theme.textClass}`}>By devs, for devs</h2>
            <p className={`mb-4 text-sm leading-relaxed ${theme.textSecondaryClass}`}>
              Use your email magic link. HTTPS webhooks live in Profile after you enable developer mode.
            </p>
            <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Email</label>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className={`mb-2 w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
              value={devSheetEmail}
              onChange={(e) => {
                setDevSheetEmail(e.target.value);
                setDevSheetMessage('idle');
                setDevSheetError(null);
              }}
            />
            {devSheetError && <p className="mb-2 text-sm text-red-500">{devSheetError}</p>}
            {devSheetMessage === 'not_registered' && (
              <p className={`mb-2 text-xs ${theme.textSecondaryClass}`}>Not on Zoro yet — use Get started on the page.</p>
            )}
            {devSheetMessage === 'sent' && (
              <p className={`mb-2 text-xs ${theme.textSecondaryClass}`}>Link sent. Check your inbox.</p>
            )}
            <button
              type="button"
              disabled={devSheetSending || !devSheetEmail.trim()}
              onClick={() => void handleDevSheetMagicLink()}
              className={`w-full rounded-lg py-3 text-sm font-bold disabled:opacity-40 ${theme.buttonClass}`}
            >
              {devSheetSending ? 'Sending…' : 'Email magic link'}
            </button>
          </NagSheet>
        )}

        {mcpLandingGuideOpen && (
          <NagSheet theme={theme} onClose={() => setMcpLandingGuideOpen(false)}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <p className={`text-[10px] font-bold uppercase tracking-wider ${theme.textSecondaryClass}`}>Add MCP server</p>
              <button
                type="button"
                onClick={() => setMcpLandingGuideOpen(false)}
                aria-label="Close"
                className={`mt-[-2px] inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border ${theme.borderClass} ${theme.textSecondaryClass} hover:bg-black/5 dark:hover:bg-white/5`}
              >
                <X size={14} />
              </button>
            </div>
            <p className={`mb-3 text-xs leading-relaxed ${theme.textSecondaryClass}`}>
              The server runs remotely via HTTP/SSE. Set HTTP header `token` (or legacy `x-nag-mcp-token`) so tools can authenticate.
            </p>
            <ol className={`mb-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed ${theme.textSecondaryClass}`}>
              <li>In Cursor, open MCP server settings (global MCP JSON).</li>
              <li>Paste this config, then set your `YOUR_TOKEN`:</li>
            </ol>
            <pre
              className={`mb-3 overflow-auto rounded-md border p-2 font-mono text-[11px] leading-relaxed ${theme.borderClass}`}
            >
              {`"zoro-nags": {\n  "url": "${NAG_MCP_URL}",\n  "headers": {\n    "token": "YOUR_TOKEN"\n  }\n}`}
            </pre>
            <button
              type="button"
              onClick={() => void copyMcpJson('YOUR_TOKEN')}
              className={`mb-1 w-full rounded-lg py-3 text-sm font-bold ${theme.buttonClass}`}
            >
              {mcpJsonCopied ? 'Copied' : 'Copy'}
            </button>
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
        onProfile={openProfile}
        onToggleTheme={toggleDarkMode}
      />
      <div className="mx-auto max-w-[500px] px-5 py-8 pb-24">
        {loadError && (
          <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {loadError}
          </p>
        )}
        {completionNotice && (
          <p className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            {completionNotice}
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
              {(nagDeveloper ? (['email'] as const) : (['whatsapp', 'email'] as const)).map((v) => (
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
              {nagDeveloper || defaultChannel === 'email' ? profileEmail ?? '—' : profilePhone}
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
                      {viaLabel(n, profileWebhooks)}
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
                  {n.nag_until_done && n.channel === 'email' && (
                    <button
                      type="button"
                      className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${theme.borderClass} ${theme.textClass}`}
                      onClick={() => void markTaskDone(n.id)}
                      title="Mark task done"
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
                      onClick={() => setRestoreConfirmNag(n)}
                      title="Restore to active"
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

        <div className="mt-4">
          <SmitheryConnectBar darkMode={darkMode} token={effectiveToken} />
        </div>

      </div>

      {sheet && (
        <NagSheet
          theme={theme}
          fullscreen={sheet === 'profile'}
          onClose={() => {
            setSheet(null);
            setEditingId(null);
          }}
        >
          {sheet === 'profile' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${theme.textSecondaryClass}`}>Profile</p>
                <button
                  type="button"
                  onClick={() => setSheet(null)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${theme.borderClass} ${theme.textSecondaryClass}`}
                >
                  Back to dashboard
                </button>
              </div>
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
                Read-only for now.
              </p>
              <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>
                Access token
              </label>
              <div className="mb-2 flex items-center gap-2">
                <input
                  readOnly
                  aria-readonly="true"
                  className={`w-full rounded-lg border px-3 py-2.5 font-mono text-[11px] ${theme.inputBgClass}`}
                  value={effectiveToken || '—'}
                />
                <button
                  type="button"
                  onClick={() => void copyToken()}
                  disabled={!effectiveToken}
                  className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40 ${theme.borderClass} ${theme.textSecondaryClass}`}
                >
                  {tokenCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className={`mb-2 text-xs leading-relaxed ${theme.textSecondaryClass}`}>
                This token gives access to your nags. Keep it private.
              </p>
              <div className="mb-2 flex items-center gap-2">
                {!resetTokenConfirm ? (
                  <button
                    type="button"
                    onClick={() => setResetTokenConfirm(true)}
                    disabled={tokenResetBusy}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40 ${theme.borderClass} ${theme.textSecondaryClass}`}
                  >
                    Reset
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void resetToken()}
                      disabled={tokenResetBusy}
                      className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40 border-red-500/40 text-red-600 dark:text-red-300`}
                    >
                      {tokenResetBusy ? 'Resetting…' : 'Confirm reset'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetTokenConfirm(false)}
                      className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold ${theme.borderClass} ${theme.textSecondaryClass}`}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
              <p className={`mb-3 text-xs leading-relaxed ${theme.textSecondaryClass}`}>
                Reset rotates your access token and invalidates old token access immediately.
              </p>
              <button
                type="button"
                onClick={() => openMcpGuide()}
                className={`mb-4 w-full rounded-lg border py-2.5 text-sm font-semibold ${theme.borderClass} ${theme.textSecondaryClass}`}
              >
                Connect via MCP
              </button>
              {tokenResetError && (
                <p className="mb-3 text-sm text-red-600 dark:text-red-400">{tokenResetError}</p>
              )}
              {tokenResetNotice && (
                <p className="mb-3 text-sm text-emerald-700 dark:text-emerald-300">{tokenResetNotice}</p>
              )}
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
              <button
                type="button"
                onClick={() =>
                  router.push(
                    effectiveToken
                      ? `/nag/developer?token=${encodeURIComponent(effectiveToken)}`
                      : '/nag/developer'
                  )
                }
                className={`mb-4 w-full rounded-lg border py-2.5 text-sm font-semibold ${theme.borderClass} ${theme.textSecondaryClass}`}
              >
                Developer settings
              </button>

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
              <p className={`mb-2 mt-8 text-[10px] font-bold uppercase tracking-wider ${theme.textSecondaryClass}`}>
                Reminder log
              </p>
              <p className={`mb-3 text-xs leading-relaxed ${theme.textSecondaryClass}`}>
                Emails we sent for your nags. Nothing loads until you tap below — we do not prefetch this list.
              </p>
              {!profileReminderLogOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setProfileReminderLogOpen(true);
                    void loadProfileReminderLog();
                  }}
                  className={`w-full rounded-lg border py-2.5 text-sm font-semibold ${theme.borderClass} ${theme.textSecondaryClass}`}
                >
                  Show reminder log
                </button>
              ) : (
                <>
                  {profileReminderLogLoading && (
                    <p className={`mb-3 text-sm ${theme.textSecondaryClass}`}>Loading…</p>
                  )}
                  {profileReminderLogError && (
                    <p className="mb-3 text-sm text-red-600 dark:text-red-400">{profileReminderLogError}</p>
                  )}
                  {!profileReminderLogLoading &&
                    profileReminderLog.length === 0 &&
                    !profileReminderLogError && (
                      <p className={`mb-3 text-sm ${theme.textSecondaryClass}`}>No entries yet.</p>
                    )}
                  {profileReminderLog.length > 0 && (
                    <ul className={`mb-3 max-h-52 space-y-2 overflow-y-auto rounded-lg border p-2 text-xs ${theme.borderClass}`}>
                      {profileReminderLog.map((e, idx) => (
                        <li
                          key={`${e.sent_at}-${idx}`}
                          className={`border-b pb-2 last:border-0 ${theme.borderClass}`}
                        >
                          <div className={`font-medium ${theme.textClass}`}>
                            {formatNext(e.sent_at, profileTimezone)}
                          </div>
                          {e.subject && (
                            <div className={`truncate ${theme.textSecondaryClass}`}>{e.subject}</div>
                          )}
                          {e.body_preview && (
                            <div className={`mt-0.5 line-clamp-2 ${theme.textSecondaryClass}`}>
                              {e.body_preview}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setProfileReminderLogOpen(false);
                      setProfileReminderLog([]);
                      setProfileReminderLogError(null);
                    }}
                    className={`w-full rounded-lg border py-2 text-xs font-semibold ${theme.borderClass} ${theme.textSecondaryClass}`}
                  >
                    Hide reminder log
                  </button>
                </>
              )}
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
                        ['Via', draftViaLabel(draft, profileWebhooks)],
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
                    disabled={
                      saving || (draft.channel === 'webhook' && !draft.webhook_id.trim())
                    }
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
                  <div className={`mb-4 flex flex-wrap gap-0.5 rounded-lg p-0.5 ${theme.accentBgClass}`}>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          channel: 'email',
                          webhook_id: '',
                        }))
                      }
                      className={`rounded-md px-2 py-2 text-xs font-semibold ${
                        draft.channel === 'email'
                          ? `${theme.cardBgClass} ${theme.textClass}`
                          : theme.textSecondaryClass
                      }`}
                    >
                      Email
                    </button>
                    {!nagDeveloper && (
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            channel: 'whatsapp',
                            webhook_id: '',
                            nag_until_done: false,
                            followup_interval_hours: '',
                          }))
                        }
                        className={`rounded-md px-2 py-2 text-xs font-semibold ${
                          draft.channel === 'whatsapp'
                            ? `${theme.cardBgClass} ${theme.textClass}`
                            : theme.textSecondaryClass
                        }`}
                      >
                        WhatsApp
                      </button>
                    )}
                    {nagDeveloper &&
                      profileWebhooks
                        .filter((h) => h.verified_at)
                        .map((h) => (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() =>
                              setDraft((d) => ({
                                ...d,
                                channel: 'webhook',
                                webhook_id: h.id,
                                nag_until_done: false,
                                followup_interval_hours: '',
                              }))
                            }
                            className={`max-w-[140px] truncate rounded-md px-2 py-2 text-xs font-semibold ${
                              draft.channel === 'webhook' && draft.webhook_id === h.id
                                ? `${theme.cardBgClass} ${theme.textClass}`
                                : theme.textSecondaryClass
                            }`}
                            title={h.url}
                          >
                            {shortHookUrl(h.url, 20)}
                          </button>
                        ))}
                  </div>
                  <button
                    type="button"
                    disabled={
                      saving || (draft.channel === 'webhook' && !draft.webhook_id.trim())
                    }
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

      {restoreConfirmNag && (
        <NagSheet theme={theme} onClose={() => setRestoreConfirmNag(null)}>
          <p className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${theme.textSecondaryClass}`}>
            Restore to active
          </p>
          <p className={`mb-4 text-sm leading-relaxed ${theme.textSecondaryClass}`}>
            This nag will leave Archived and return to your Active list. We will recalculate the next send time from
            your schedule and reminders can resume (including follow-ups if &quot;until done&quot; is on).
          </p>
          <div className={`mb-4 rounded-xl border p-3 ${theme.borderClass} ${theme.cardBgClass}`}>
            <p className={`mb-2 text-sm font-semibold ${theme.textClass}`}>{restoreConfirmNag.message}</p>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className={`rounded-full border px-2 py-0.5 uppercase ${theme.borderClass} ${theme.textSecondaryClass}`}>
                {viaLabel(restoreConfirmNag, profileWebhooks)}
              </span>
              <span className={theme.textSecondaryClass}>{restoreConfirmNag.frequency}</span>
              <span className={theme.textSecondaryClass}>{endLabel(restoreConfirmNag)}</span>
            </div>
            {restoreConfirmNag.nag_until_done && restoreConfirmNag.channel === 'email' && (
              <p className={`mt-2 text-[11px] ${theme.textSecondaryClass}`}>Follow-up emails until done: on</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void confirmRestoreNag()}
            className={`mb-2 w-full rounded-lg py-3 text-sm font-bold ${theme.buttonClass}`}
          >
            Confirm restore
          </button>
          <button
            type="button"
            onClick={() => setRestoreConfirmNag(null)}
            className={`w-full rounded-lg border py-3 text-sm font-semibold ${theme.borderClass} ${theme.textSecondaryClass}`}
          >
            Cancel
          </button>
        </NagSheet>
      )}

      {mcpGuideOpen && (
        <NagSheet theme={theme} onClose={() => setMcpGuideOpen(false)}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <p className={`text-[10px] font-bold uppercase tracking-wider ${theme.textSecondaryClass}`}>Add MCP server</p>
            <button
              type="button"
              onClick={() => setMcpGuideOpen(false)}
              aria-label="Close"
              className={`mt-[-2px] inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border ${theme.borderClass} ${theme.textSecondaryClass} hover:bg-black/5 dark:hover:bg-white/5`}
            >
              <X size={14} />
            </button>
          </div>
          <p className={`mb-3 text-xs leading-relaxed ${theme.textSecondaryClass}`}>
            The server runs remotely via HTTP/SSE. Set HTTP header `token` (or legacy `x-nag-mcp-token`) so tools can authenticate.
          </p>
          <ol className={`mb-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed ${theme.textSecondaryClass}`}>
            <li>In Cursor, open MCP server settings (global MCP JSON).</li>
            <li>Paste this config, then set your `YOUR_TOKEN`:</li>
          </ol>
          <pre
            className={`mb-3 overflow-auto rounded-md border p-2 font-mono text-[11px] leading-relaxed ${theme.borderClass}`}
          >
            {`"zoro-nags": {\n  "url": "${NAG_MCP_URL}",\n  "headers": {\n    "token": "${effectiveToken}"\n  }\n}`}
          </pre>
          <button
            type="button"
            onClick={() => void copyMcpJson(effectiveToken)}
            className={`mb-1 w-full rounded-lg py-3 text-sm font-bold ${theme.buttonClass}`}
          >
            {mcpJsonCopied ? 'Copied' : 'Copy'}
          </button>
        </NagSheet>
      )}
    </div>
  );
}
