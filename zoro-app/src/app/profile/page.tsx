'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Moon, Sun, Mail, ChevronDown, ChevronRight, Bot, AlertCircle, Flag } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useDarkMode } from '@/hooks/useDarkMode';

type Usage = {
  daily_used: number;
  daily_limit: number;
  monthly_used: number;
  monthly_limit: number;
};

type Inbound = {
  id: string;
  from_address: string;
  subject: string | null;
  received_at: string;
  intent: string | null;
  intent_type: string | null;
  intent_confidence: number | null;
  intent_rationale: string | null;
  requires_human_review: boolean | null;
  user_flagged_for_review: boolean | null;
  user_review_comment: string | null;
  text_body: string | null;
  reply_preview: string | null;
};

type ProfileData = {
  usage: Usage;
  auto_responses_enabled: boolean;
  inbounds: Inbound[];
};

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [savingInboundId, setSavingInboundId] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/profile?token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Failed to load');
        setData(null);
        return;
      }
      setData(json);
      setError(null);
    } catch {
      setError('Something went wrong');
    }
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('Missing link. Use the link from your email.');
      return;
    }
    let cancelled = false;
    (async () => {
      await fetchProfile();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleToggleAutoResponses = async () => {
    if (!token || !data || toggling) return;
    setToggling(true);
    try {
      const next = !data.auto_responses_enabled;
      const res = await fetch(`/api/profile?token=${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_responses_enabled: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Update failed');
        return;
      }
      setData((prev) => (prev ? { ...prev, auto_responses_enabled: json.auto_responses_enabled } : null));
    } catch {
      setError('Update failed');
    } finally {
      setToggling(false);
    }
  };

  const agentUrl = token ? `/agent?token=${encodeURIComponent(token)}` : '/agent';

  const formatDate = (s: string) => {
    try {
      const d = new Date(s);
      return d.toLocaleDateString(undefined, { dateStyle: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { timeStyle: 'short' });
    } catch {
      return s;
    }
  };

  const formatIntent = (intent: string | null, intentType: string | null) => {
    if (!intent) return '—';
    if (intentType) return `${intent} (${intentType})`;
    return intent;
  };

  const updateInboundFlagOrComment = async (
    inboundId: string,
    updates: { user_flagged_for_review?: boolean; user_review_comment?: string }
  ) => {
    if (!token) return;
    setSavingInboundId(inboundId);
    try {
      const res = await fetch(`/api/profile/inbound?token=${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inbound_id: inboundId, ...updates }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Update failed');
        return;
      }
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          inbounds: prev.inbounds.map((inv) =>
            inv.id === inboundId
              ? {
                  ...inv,
                  user_flagged_for_review: json.user_flagged_for_review ?? inv.user_flagged_for_review,
                  user_review_comment: json.user_review_comment ?? inv.user_review_comment,
                }
              : inv
          ),
        };
      });
      setCommentDraft((d) => {
        const next = { ...d };
        delete next[inboundId];
        return next;
      });
    } catch {
      setError('Update failed');
    } finally {
      setSavingInboundId(null);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
        <nav className={`border-b ${theme.borderClass}`}>
          <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
            <button type="button" onClick={() => router.push('/')} className="flex items-center cursor-pointer" aria-label="Back to home">
              <ZoroLogo className="h-10" isDark={darkMode} />
            </button>
            <div className={theme.textSecondaryClass}>Loading…</div>
          </div>
        </nav>
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <p className={theme.textSecondaryClass}>Loading profile…</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
        <nav className={`border-b ${theme.borderClass}`}>
          <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
            <button type="button" onClick={() => router.push('/')} className="flex items-center cursor-pointer" aria-label="Back to home">
              <ZoroLogo className="h-10" isDark={darkMode} />
            </button>
          </div>
        </nav>
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h1 className={`text-2xl font-bold ${theme.textClass} mb-4`}>Invalid or expired link</h1>
          <p className={`${theme.textSecondaryClass} mb-6`}>{error}</p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Back to Zoro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
      <nav className={`border-b ${theme.borderClass}`}>
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <button type="button" onClick={() => router.push('/')} className="flex items-center cursor-pointer" aria-label="Zoro home">
            <ZoroLogo className="h-10" isDark={darkMode} />
          </button>
          <div className="flex items-center gap-4">
            <a
              href={agentUrl}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${theme.borderClass} ${theme.textClass} hover:opacity-90`}
            >
              <Bot className="w-4 h-4" /> Agent
            </a>
            <button
              type="button"
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass}`}
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className={`text-2xl font-bold ${theme.textClass} mb-2`}>Usage &amp; history</h1>
        <p className={`${theme.textSecondaryClass} mb-8`}>
          See how many replies your agent has sent and browse inbound emails with classification. You can disable auto-responses below.
        </p>

        {/* Usage */}
        <section className="mb-10">
          <h2 className={`text-lg font-semibold ${theme.textClass} mb-4`}>Email usage</h2>
          <p className={`${theme.textSecondaryClass} text-sm mb-4`}>
            Replies sent by your agent (used for rate limits).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg border ${theme.borderClass} ${theme.cardBgClass}`}>
              <div className={`text-sm ${theme.textSecondaryClass}`}>Daily</div>
              <div className={`text-xl font-semibold ${theme.textClass}`}>
                {data?.usage.daily_used ?? 0} / {data?.usage.daily_limit ?? 10}
              </div>
            </div>
            <div className={`p-4 rounded-lg border ${theme.borderClass} ${theme.cardBgClass}`}>
              <div className={`text-sm ${theme.textSecondaryClass}`}>Monthly</div>
              <div className={`text-xl font-semibold ${theme.textClass}`}>
                {data?.usage.monthly_used ?? 0} / {data?.usage.monthly_limit ?? 100}
              </div>
            </div>
          </div>
        </section>

        {/* Auto-responses */}
        <section className="mb-10">
          <h2 className={`text-lg font-semibold ${theme.textClass} mb-4`}>Auto-responses</h2>
          <p className={`${theme.textSecondaryClass} text-sm mb-4`}>
            When disabled, new inbound emails will not get automatic replies from your agent.
          </p>
          <button
            type="button"
            onClick={handleToggleAutoResponses}
            disabled={toggling}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${theme.borderClass} ${theme.textClass} disabled:opacity-50`}
          >
            {data?.auto_responses_enabled ? 'Disable auto-responses' : 'Enable auto-responses'}
          </button>
          {data && (
            <span className={`ml-3 text-sm ${theme.textSecondaryClass}`}>
              {data.auto_responses_enabled ? 'Currently enabled' : 'Currently disabled'}
            </span>
          )}
        </section>

        {/* Inbound history */}
        <section>
          <h2 className={`text-lg font-semibold ${theme.textClass} mb-4 flex items-center gap-2`}>
            <Mail className="w-5 h-5" /> Inbound email history
          </h2>
          <p className={`${theme.textSecondaryClass} text-sm mb-4`}>
            Click a row to see intent, confidence, and rationale.
          </p>

          {!data?.inbounds?.length ? (
            <p className={theme.textSecondaryClass}>No inbound emails yet.</p>
          ) : (
            <div className="space-y-2">
              {data.inbounds.map((inv) => {
                const isExpanded = expandedId === inv.id;
                const systemFlagged = inv.requires_human_review === true;
                const userFlagged = inv.user_flagged_for_review === true;
                const showFlag = systemFlagged || userFlagged;
                const commentValue = commentDraft[inv.id] !== undefined ? commentDraft[inv.id] : (inv.user_review_comment ?? '');
                return (
                  <div
                    key={inv.id}
                    className={`rounded-lg border ${theme.borderClass} ${theme.cardBgClass} overflow-hidden`}
                  >
                    <div className="flex items-start gap-2 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                        className={`flex-1 text-left flex items-start gap-3 ${theme.textClass} hover:opacity-90 min-w-0`}
                      >
                        <span className="mt-0.5 shrink-0">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{inv.subject ?? '(no subject)'}</div>
                          <div className={`text-sm ${theme.textSecondaryClass}`}>
                            {formatIntent(inv.intent, inv.intent_type)} · {formatDate(inv.received_at)}
                          </div>
                        </div>
                      </button>
                      {showFlag && (
                        <span
                          className={`shrink-0 mt-0.5 flex items-center gap-1 ${
                            userFlagged ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'
                          }`}
                          title={userFlagged ? 'Flagged by you for human review' : systemFlagged ? 'Flagged by system for human review' : ''}
                        >
                          <Flag className="w-4 h-4 fill-current" />
                          {userFlagged && systemFlagged && (
                            <span className="text-[10px] uppercase">+ you</span>
                          )}
                        </span>
                      )}
                    </div>
                    {isExpanded && (
                      <div className={`border-t ${theme.borderClass} px-4 py-4 space-y-3`}>
                        <div>
                          <div className={`text-xs font-semibold ${theme.textSecondaryClass} mb-0.5`}>Intent</div>
                          <p className={theme.textClass}>{formatIntent(inv.intent, inv.intent_type)}</p>
                        </div>
                        {inv.intent_confidence != null && (
                          <div>
                            <div className={`text-xs font-semibold ${theme.textSecondaryClass} mb-0.5`}>Confidence</div>
                            <p className={theme.textClass}>{Math.round((inv.intent_confidence ?? 0) * 100)}%</p>
                          </div>
                        )}
                        {inv.intent_rationale && (
                          <div>
                            <div className={`text-xs font-semibold ${theme.textSecondaryClass} mb-0.5`}>Rationale</div>
                            <p className={`text-sm ${theme.textClass}`}>{inv.intent_rationale}</p>
                          </div>
                        )}
                        {(systemFlagged || userFlagged) && (
                          <div className={`text-xs px-2 py-1.5 rounded inline-flex items-center gap-1 ${
                            userFlagged ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                          }`}>
                            {systemFlagged && <AlertCircle className="w-3 h-3 shrink-0" />}
                            {userFlagged && <Flag className="w-3 h-3 shrink-0 fill-current" />}
                            <span>
                              {systemFlagged && userFlagged ? 'Flagged by system and by you' : systemFlagged ? 'Flagged by system (intent)' : 'Flagged by you for human review'}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <label className={`text-xs font-semibold ${theme.textSecondaryClass}`} htmlFor={`flag-${inv.id}`}>
                              Flag for human review
                            </label>
                            <button
                              type="button"
                              onClick={() => updateInboundFlagOrComment(inv.id, { user_flagged_for_review: !userFlagged })}
                              disabled={savingInboundId === inv.id}
                              className={`text-xs px-2 py-1 rounded border ${theme.borderClass} ${userFlagged ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700' : theme.cardBgClass} ${theme.textClass} disabled:opacity-50`}
                            >
                              {userFlagged ? 'Unflag' : 'Flag'}
                            </button>
                          </div>
                          <div className="mt-1">
                            <label className={`text-xs font-semibold ${theme.textSecondaryClass} block mb-0.5`} htmlFor={`comment-${inv.id}`}>
                              Context / comment
                            </label>
                            <textarea
                              id={`comment-${inv.id}`}
                              value={commentValue}
                              onChange={(e) => setCommentDraft((d) => ({ ...d, [inv.id]: e.target.value }))}
                              placeholder="Add context for human review..."
                              rows={2}
                              className={`w-full p-2 rounded border text-sm ${theme.inputBgClass} ${theme.borderClass} ${theme.textClass}`}
                            />
                            <button
                              type="button"
                              onClick={() => updateInboundFlagOrComment(inv.id, { user_review_comment: commentValue })}
                              disabled={savingInboundId === inv.id || commentValue === (inv.user_review_comment ?? '')}
                              className={`mt-1 text-xs px-2 py-1 rounded border ${theme.borderClass} ${theme.textClass} disabled:opacity-50`}
                            >
                              {savingInboundId === inv.id ? 'Saving…' : 'Save comment'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
        <p className="text-slate-600 dark:text-slate-400">Loading…</p>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
