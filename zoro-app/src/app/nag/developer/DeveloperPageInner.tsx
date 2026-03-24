'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { NagNav } from '../nag-chrome';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';

const NAG_TOKEN_STORAGE = 'nag_dev_token';

type NagWebhookRow = { id: string; url: string; verified_at: string | null; created_at: string };
type NagPersonalityOptions = { tone: 'friendly' | 'direct' | 'firm'; style: 'short' | 'balanced' | 'detailed' };
type NagPersonalityState = {
  enabled: boolean;
  personality: string;
  soulText: string;
  userText: string;
  options: NagPersonalityOptions;
};

function shortHookUrl(u: string, max = 48): string {
  if (u.length <= max) return u;
  return `${u.slice(0, max - 1)}…`;
}

export function DeveloperPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);

  const urlToken = searchParams.get('token')?.trim() ?? '';
  const envDevToken = (process.env.NEXT_PUBLIC_NAG_DEV_TOKEN ?? '').trim();
  const [storedToken, setStoredToken] = useState('');
  const effectiveToken = urlToken || storedToken || envDevToken || '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [developerMode, setDeveloperMode] = useState(false);
  const [savingDeveloperMode, setSavingDeveloperMode] = useState(false);
  const [developerNotice, setDeveloperNotice] = useState<string | null>(null);

  const [webhooks, setWebhooks] = useState<NagWebhookRow[]>([]);
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [webhookAddBusy, setWebhookAddBusy] = useState(false);
  const [webhookRowBusy, setWebhookRowBusy] = useState<string | null>(null);
  const [hookMsg, setHookMsg] = useState<string | null>(null);

  const [personalityDraft, setPersonalityDraft] = useState<NagPersonalityState>({
    enabled: false,
    personality: '',
    soulText: '',
    userText: '',
    options: { tone: 'friendly', style: 'balanced' },
  });
  const [savedPersonality, setSavedPersonality] = useState<NagPersonalityState>({
    enabled: false,
    personality: '',
    soulText: '',
    userText: '',
    options: { tone: 'friendly', style: 'balanced' },
  });
  const [personalitySaveBusy, setPersonalitySaveBusy] = useState(false);
  const [personalitySaveNotice, setPersonalitySaveNotice] = useState<string | null>(null);
  const [personalitySaveError, setPersonalitySaveError] = useState<string | null>(null);

  const hasPersonalityChanges = useMemo(
    () => JSON.stringify(personalityDraft) !== JSON.stringify(savedPersonality),
    [personalityDraft, savedPersonality]
  );

  useEffect(() => {
    try {
      const s = sessionStorage.getItem(NAG_TOKEN_STORAGE);
      if (s?.trim()) setStoredToken(s.trim());
      if (urlToken) sessionStorage.setItem(NAG_TOKEN_STORAGE, urlToken);
    } catch {
      /* ignore */
    }
  }, [urlToken]);

  const load = async () => {
    if (!effectiveToken) return;
    setLoading(true);
    setError(null);
    try {
      const [nagsRes, pRes] = await Promise.all([
        fetch(`/api/nags?token=${encodeURIComponent(effectiveToken)}&status=all`),
        fetch(`/api/nag-personality?token=${encodeURIComponent(effectiveToken)}`),
      ]);

      const nagsJson = await nagsRes.json();
      if (!nagsRes.ok) {
        setError(nagsJson.error ?? 'Could not load developer settings.');
        return;
      }

      setEmail(nagsJson.profile?.email ?? null);
      setDeveloperMode(Boolean(nagsJson.profile?.nag_developer));
      setWebhooks(Array.isArray(nagsJson.profile?.webhooks) ? (nagsJson.profile.webhooks as NagWebhookRow[]) : []);

      const pJson = await pRes.json();
      if (pRes.ok) {
        const next: NagPersonalityState = {
          enabled: pJson.enabled === true,
          personality: typeof pJson.personality === 'string' ? pJson.personality : '',
          soulText: typeof pJson.soul_text === 'string' ? pJson.soul_text : '',
          userText: typeof pJson.user_text === 'string' ? pJson.user_text : '',
          options: {
            tone: pJson.options?.tone === 'direct' || pJson.options?.tone === 'firm' ? pJson.options.tone : 'friendly',
            style: pJson.options?.style === 'short' || pJson.options?.style === 'detailed' ? pJson.options.style : 'balanced',
          },
        };
        setPersonalityDraft(next);
        setSavedPersonality(next);
      }
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveToken]);

  const setDeveloperModeRemote = async (next: boolean) => {
    if (!effectiveToken || savingDeveloperMode) return;
    const prev = developerMode;
    setDeveloperMode(next);
    setSavingDeveloperMode(true);
    setDeveloperNotice(null);
    setError(null);
    try {
      const res = await fetch('/api/nag-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: effectiveToken, nag_developer: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        setDeveloperMode(prev);
        setError(json.error ?? 'Could not update developer mode.');
        return;
      }
      setDeveloperNotice(next ? 'Developer mode enabled.' : 'Developer mode disabled.');
      await load();
    } catch {
      setDeveloperMode(prev);
      setError('Network error.');
    } finally {
      setSavingDeveloperMode(false);
    }
  };

  const addWebhook = async () => {
    const u = webhookUrlInput.trim();
    if (!effectiveToken || !u) return;
    setHookMsg(null);
    setWebhookAddBusy(true);
    try {
      const res = await fetch('/api/nag-webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: effectiveToken, url: u }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setHookMsg(json.error ?? 'Could not add webhook.');
        return;
      }
      setWebhookUrlInput('');
      setHookMsg('Added. Verify to enable.');
      await load();
    } catch {
      setHookMsg('Network error.');
    } finally {
      setWebhookAddBusy(false);
    }
  };

  const verifyWebhookRow = async (id: string) => {
    if (!effectiveToken) return;
    setHookMsg(null);
    setWebhookRowBusy(id);
    try {
      const res = await fetch(`/api/nag-webhooks/${id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: effectiveToken }),
      });
      const json = (await res.json()) as { error?: string; detail?: string };
      if (!res.ok) {
        setHookMsg(json.detail ?? json.error ?? 'Verify failed.');
        return;
      }
      setHookMsg('Verified.');
      await load();
    } catch {
      setHookMsg('Network error.');
    } finally {
      setWebhookRowBusy(null);
    }
  };

  const pingWebhookRow = async (id: string) => {
    if (!effectiveToken) return;
    setHookMsg(null);
    setWebhookRowBusy(id);
    try {
      const res = await fetch(`/api/nag-webhooks/${id}/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: effectiveToken }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setHookMsg(json.error ?? 'Ping failed.');
        return;
      }
      setHookMsg('Ping OK.');
    } catch {
      setHookMsg('Network error.');
    } finally {
      setWebhookRowBusy(null);
    }
  };

  const deleteWebhookRow = async (id: string) => {
    if (!effectiveToken) return;
    setHookMsg(null);
    setWebhookRowBusy(id);
    try {
      const res = await fetch(`/api/nag-webhooks/${id}?token=${encodeURIComponent(effectiveToken)}`, {
        method: 'DELETE',
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setHookMsg(json.error ?? 'Could not remove.');
        return;
      }
      setHookMsg('Removed.');
      await load();
    } catch {
      setHookMsg('Network error.');
    } finally {
      setWebhookRowBusy(null);
    }
  };

  const savePersonality = async () => {
    if (!effectiveToken || !hasPersonalityChanges) return;
    setPersonalitySaveBusy(true);
    setPersonalitySaveError(null);
    setPersonalitySaveNotice(null);
    try {
      const res = await fetch('/api/nag-personality', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: effectiveToken,
          enabled: personalityDraft.enabled,
          personality: personalityDraft.personality,
          soul_text: personalityDraft.soulText,
          user_text: personalityDraft.userText,
          options: personalityDraft.options,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPersonalitySaveError(json.error ?? 'Could not save personality');
        return;
      }
      setSavedPersonality(personalityDraft);
      setPersonalitySaveNotice('Personality saved.');
    } catch {
      setPersonalitySaveError('Network error while saving personality');
    } finally {
      setPersonalitySaveBusy(false);
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#09090c]' : 'bg-[#f5f5f7]'} ${theme.textClass}`}>
      <NagNav
        theme={theme}
        darkMode={darkMode}
        dashboard
        hasToken={Boolean(effectiveToken)}
        onProfile={() =>
          router.push(effectiveToken ? `/nag?token=${encodeURIComponent(effectiveToken)}` : '/nag')
        }
        onToggleTheme={toggleDarkMode}
      />
      <main className="mx-auto max-w-[560px] px-5 py-8 pb-20">
        <div className={`mb-4 rounded-[14px] border p-4 ${theme.borderClass} ${theme.cardBgClass}`}>
          <p className={`mb-1 text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Developer settings</p>
          <p className={`mb-3 text-sm ${theme.textSecondaryClass}`}>{email ?? '—'}</p>

          {!effectiveToken && (
            <p className="text-sm text-amber-600 dark:text-amber-300">
              Missing token. Open this page from your magic link.
            </p>
          )}
          {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          {developerNotice && <p className="mb-2 text-sm text-emerald-700 dark:text-emerald-300">{developerNotice}</p>}

          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Developer mode</p>
              <p className={`text-xs leading-snug ${theme.textSecondaryClass}`}>Email + verified HTTPS webhooks only.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={developerMode}
              onClick={() => void setDeveloperModeRemote(!developerMode)}
              disabled={!effectiveToken || savingDeveloperMode}
              className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors ${
                developerMode ? 'bg-emerald-500' : darkMode ? 'bg-zinc-700' : 'bg-zinc-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 translate-y-1 transform rounded-full bg-white shadow transition ${
                  developerMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {savingDeveloperMode && <p className={`mb-2 text-xs ${theme.textSecondaryClass}`}>Saving…</p>}
        </div>

        {developerMode && (
          <div className={`mb-4 rounded-[14px] border p-4 ${theme.borderClass} ${theme.cardBgClass}`}>
            <p className={`mb-2 text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Webhooks</p>
            <p className={`mb-2 text-[11px] leading-snug ${theme.textSecondaryClass}`}>
              Verify expects JSON with the same <span className="font-mono">challenge</span> and header{' '}
              <span className="font-mono">X-Zoro-Webhook-Secret</span>.
            </p>
            <ol className={`mb-3 list-decimal space-y-1 pl-4 text-[11px] ${theme.textSecondaryClass}`}>
              <li>Add your HTTPS endpoint URL.</li>
              <li>Click Verify and echo the same challenge in JSON.</li>
              <li>Click Ping to confirm delivery.</li>
              <li>Select that webhook as channel when creating nags.</li>
            </ol>
            {hookMsg && <p className={`mb-2 text-xs ${theme.textClass}`}>{hookMsg}</p>}
            <div className="mb-2 flex gap-2">
              <input
                type="url"
                placeholder="https://…"
                className={`min-w-0 flex-1 rounded-lg border px-2 py-2 text-xs ${theme.inputBgClass}`}
                value={webhookUrlInput}
                onChange={(e) => setWebhookUrlInput(e.target.value)}
              />
              <button
                type="button"
                disabled={!effectiveToken || webhookAddBusy || !webhookUrlInput.trim()}
                onClick={() => void addWebhook()}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-40 ${theme.buttonClass}`}
              >
                {webhookAddBusy ? '…' : 'Add'}
              </button>
            </div>
            <ul className="space-y-2">
              {webhooks.map((h) => (
                <li key={h.id} className={`flex flex-col gap-1.5 rounded-md border px-2 py-2 text-[11px] ${theme.borderClass}`}>
                  <span className={`truncate font-mono ${theme.textSecondaryClass}`}>{shortHookUrl(h.url, 52)}</span>
                  <div className="flex flex-wrap gap-1">
                    {!h.verified_at ? (
                      <button
                        type="button"
                        disabled={webhookRowBusy === h.id}
                        onClick={() => void verifyWebhookRow(h.id)}
                        className={`rounded border px-2 py-1 text-[10px] font-bold ${theme.borderClass} ${theme.textClass}`}
                      >
                        Verify
                      </button>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400">Verified</span>
                    )}
                    {h.verified_at && (
                      <button
                        type="button"
                        disabled={webhookRowBusy === h.id}
                        onClick={() => void pingWebhookRow(h.id)}
                        className={`rounded border px-2 py-1 text-[10px] font-bold ${theme.borderClass} ${theme.textSecondaryClass}`}
                      >
                        Ping
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={webhookRowBusy === h.id}
                      onClick={() => void deleteWebhookRow(h.id)}
                      className={`rounded border px-2 py-1 text-[10px] font-bold ${theme.borderClass} text-red-600 dark:text-red-400`}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
              {webhooks.length === 0 && <li className={`text-xs ${theme.textSecondaryClass}`}>No webhooks yet.</li>}
            </ul>
          </div>
        )}

        <div className={`rounded-[14px] border p-4 ${theme.borderClass} ${theme.cardBgClass}`}>
          <p className={`mb-2 text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Personality</p>
          <div className="mb-3 flex items-center justify-between">
            <span className={`text-sm font-semibold ${theme.textClass}`}>
              {`personality - ${personalityDraft.enabled ? 'enabled' : 'disabled'}`}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={personalityDraft.enabled}
              onClick={() => setPersonalityDraft((p) => ({ ...p, enabled: !p.enabled }))}
              className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors ${
                personalityDraft.enabled ? 'bg-emerald-500' : darkMode ? 'bg-zinc-700' : 'bg-zinc-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 translate-y-1 transform rounded-full bg-white shadow transition ${
                  personalityDraft.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {personalityDraft.enabled && (
            <>
              <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Personality</label>
              <textarea
                rows={3}
                value={personalityDraft.personality}
                onChange={(e) => setPersonalityDraft((p) => ({ ...p, personality: e.target.value }))}
                className={`mb-3 w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                placeholder="How Zoro should sound and act"
              />
              <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Soul</label>
              <textarea
                rows={5}
                value={personalityDraft.soulText}
                onChange={(e) => setPersonalityDraft((p) => ({ ...p, soulText: e.target.value }))}
                className={`mb-3 w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                placeholder="SOUL context"
              />
              <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>User</label>
              <textarea
                rows={4}
                value={personalityDraft.userText}
                onChange={(e) => setPersonalityDraft((p) => ({ ...p, userText: e.target.value }))}
                className={`mb-3 w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                placeholder="User context"
              />
              <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Tone</label>
              <select
                className={`mb-3 w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                value={personalityDraft.options.tone}
                onChange={(e) =>
                  setPersonalityDraft((p) => ({ ...p, options: { ...p.options, tone: e.target.value as NagPersonalityOptions['tone'] } }))
                }
              >
                <option value="friendly">Friendly</option>
                <option value="direct">Direct</option>
                <option value="firm">Firm</option>
              </select>
              <label className={`mb-1 block text-[10px] font-bold uppercase ${theme.textSecondaryClass}`}>Style</label>
              <select
                className={`mb-4 w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
                value={personalityDraft.options.style}
                onChange={(e) =>
                  setPersonalityDraft((p) => ({ ...p, options: { ...p.options, style: e.target.value as NagPersonalityOptions['style'] } }))
                }
              >
                <option value="short">Short</option>
                <option value="balanced">Balanced</option>
                <option value="detailed">Detailed</option>
              </select>
            </>
          )}
          {personalitySaveError && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{personalitySaveError}</p>}
          {personalitySaveNotice && <p className="mb-3 text-sm text-emerald-700 dark:text-emerald-300">{personalitySaveNotice}</p>}
          <button
            type="button"
            disabled={!effectiveToken || personalitySaveBusy || !hasPersonalityChanges}
            onClick={() => void savePersonality()}
            className={`w-full rounded-lg py-3 text-sm font-bold disabled:opacity-40 ${theme.buttonClass}`}
          >
            {personalitySaveBusy ? 'Saving personality…' : 'Save personality'}
          </button>
        </div>

        {loading && <p className={`mt-3 text-sm ${theme.textSecondaryClass}`}>Loading…</p>}
      </main>
    </div>
  );
}

