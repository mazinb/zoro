'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Moon, Sun, User, Bot, FileEdit } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useDarkMode } from '@/hooks/useDarkMode';

type AgentData = {
  soul_text: string;
  user_text: string;
  last_agent_edit_at: string | null;
  can_edit_today: boolean;
};

function AgentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);

  const [data, setData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editSoul, setEditSoul] = useState('');
  const [editUser, setEditUser] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('Missing link. Use the link from your email.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/agent?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? 'Failed to load');
          setData(null);
          return;
        }
        setData(json);
        setEditSoul(json.soul_text ?? '');
        setEditUser(json.user_text ?? '');
        setError(null);
      } catch (e) {
        if (!cancelled) setError('Something went wrong');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleSave = async () => {
    if (!token || saving || !data) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/agent?token=${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soul_text: editSoul, user_text: editUser }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveMessage(json.error ?? 'Update failed');
        return;
      }
      setData({ ...json });
      setEditing(false);
      setSaveMessage('Updated. You can edit again tomorrow.');
    } catch {
      setSaveMessage('Update failed');
    } finally {
      setSaving(false);
    }
  };

  const profileUrl = token ? `/profile?token=${encodeURIComponent(token)}` : '/profile';

  if (loading) {
    return (
      <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
        <nav className={`border-b ${theme.borderClass}`}>
          <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
            <button type="button" onClick={() => router.push('/')} className="flex items-center cursor-pointer" aria-label="Back to home">
              <ZoroLogo className="h-10" isDark={darkMode} />
            </button>
            <div className={`${theme.textSecondaryClass}`}>Loading…</div>
          </div>
        </nav>
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <p className={theme.textSecondaryClass}>Loading agent settings…</p>
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
              href={profileUrl}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${theme.borderClass} ${theme.textClass} hover:opacity-90`}
            >
              <User className="w-4 h-4" /> Profile
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
        <h1 className={`text-2xl font-bold ${theme.textClass} mb-2`}>Agent &amp; user context</h1>
        <p className={`${theme.textSecondaryClass} mb-8`}>
          These files define how your agent (Zoro) sees you and itself. You can update them once per day.
        </p>

        {saveMessage && (
          <div className={`mb-6 p-4 rounded-lg border ${theme.borderClass} ${theme.cardBgClass}`}>
            <p className={theme.textClass}>{saveMessage}</p>
          </div>
        )}

        {data && !data.can_edit_today && !editing && (
          <p className={`mb-6 ${theme.textSecondaryClass}`}>
            You’ve already updated today. You can edit again tomorrow.
          </p>
        )}

        {/* USER.md */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <User className={`w-5 h-5 ${theme.textClass}`} />
            <h2 className={`text-lg font-semibold ${theme.textClass}`}>USER.md</h2>
          </div>
          {editing ? (
            <textarea
              value={editUser}
              onChange={(e) => setEditUser(e.target.value)}
              rows={14}
              className={`w-full p-4 rounded-lg border ${theme.inputBgClass} ${theme.borderClass} font-mono text-sm`}
              placeholder="About you (for the agent)"
            />
          ) : (
            <pre className={`p-4 rounded-lg border ${theme.borderClass} ${theme.cardBgClass} overflow-x-auto whitespace-pre-wrap font-mono text-sm ${theme.textClass}`}>
              {data?.user_text || '—'}
            </pre>
          )}
        </section>

        {/* Agent (SOUL) */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Bot className={`w-5 h-5 ${theme.textClass}`} />
            <h2 className={`text-lg font-semibold ${theme.textClass}`}>Agent (SOUL)</h2>
          </div>
          {editing ? (
            <textarea
              value={editSoul}
              onChange={(e) => setEditSoul(e.target.value)}
              rows={14}
              className={`w-full p-4 rounded-lg border ${theme.inputBgClass} ${theme.borderClass} font-mono text-sm`}
              placeholder="Agent persona / SOUL"
            />
          ) : (
            <pre className={`p-4 rounded-lg border ${theme.borderClass} ${theme.cardBgClass} overflow-x-auto whitespace-pre-wrap font-mono text-sm ${theme.textClass}`}>
              {data?.soul_text || '—'}
            </pre>
          )}
        </section>

        {data?.can_edit_today && (
          <div className="flex items-center gap-4">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <FileEdit className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(false); setEditSoul(data.soul_text); setEditUser(data.user_text); setSaveMessage(null); }}
                  className={`px-5 py-2.5 rounded-lg border ${theme.borderClass} ${theme.textClass}`}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-blue-500 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800"
              >
                <FileEdit className="w-4 h-4" /> Edit (once per day)
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function AgentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
        <p className="text-slate-600 dark:text-slate-400">Loading…</p>
      </div>
    }>
      <AgentContent />
    </Suspense>
  );
}
