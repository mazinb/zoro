'use client';

import React from 'react';
import Link from 'next/link';
import { Moon, Sun } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';

export type NagThemeClasses = {
  borderClass: string;
  textClass: string;
  textSecondaryClass: string;
  cardBgClass: string;
  cardBorderClass: string;
  inputBgClass: string;
  buttonClass: string;
  accentBgClass: string;
};

type NagNavProps = {
  theme: NagThemeClasses;
  darkMode: boolean;
  dashboard?: boolean;
  hasToken: boolean;
  /** Landing only: full href for "Dashboard" when a token is available (URL, saved, or env). */
  dashboardHref?: string;
  onProfile: () => void;
  onToggleTheme: () => void;
};

/** Module-level component — do not define inside a parent that updates on every keystroke. */
export function NagNav({
  theme,
  darkMode,
  dashboard,
  hasToken,
  dashboardHref,
  onProfile,
  onToggleTheme,
}: NagNavProps) {
  return (
    <nav
      className={`sticky top-0 z-[99] flex h-[52px] items-center justify-between border-b px-5 ${theme.borderClass} ${darkMode ? 'bg-[#09090c]' : 'bg-[#f5f5f7]'}`}
    >
      <Link
        href="/"
        className={`flex items-center ${theme.textClass} cursor-pointer`}
        aria-label="Zoro"
      >
        <ZoroLogo className="h-7" isDark={darkMode} />
      </Link>
      <div className="flex items-center gap-2">
        {dashboard && hasToken && (
          <>
            <button
              type="button"
              onClick={onProfile}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${theme.borderClass} ${theme.textSecondaryClass}`}
            >
              Profile
            </button>
          </>
        )}
        {!dashboard && (
          <Link
            href={dashboardHref ?? '/nag'}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${theme.borderClass} ${theme.textSecondaryClass}`}
          >
            {dashboardHref ? 'Dashboard' : 'Sign in'}
          </Link>
        )}
        <button
          type="button"
          onClick={onToggleTheme}
          className={`flex items-center justify-center rounded-md border p-2 ${theme.borderClass} ${theme.textClass}`}
          aria-label="Toggle theme"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </nav>
  );
}

type NagSheetProps = {
  theme: NagThemeClasses;
  onClose: () => void;
  children: React.ReactNode;
  fullscreen?: boolean;
};

export function NagSheet({ theme, onClose, children, fullscreen = false }: NagSheetProps) {
  return (
    <div
      className={`fixed inset-0 z-[200] bg-black/50 ${fullscreen ? 'flex items-stretch justify-center' : 'flex items-end justify-center'}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={
          fullscreen
            ? `h-full w-full overflow-y-auto border-0 p-6 sm:p-8 ${theme.cardBgClass}`
            : `w-full max-w-[480px] rounded-t-[14px] border p-5 pb-10 ${theme.cardBorderClass} ${theme.cardBgClass}`
        }
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        {!fullscreen && <div className={`mx-auto mb-5 h-1 w-8 rounded-full ${theme.borderClass} bg-current opacity-30`} />}
        {children}
      </div>
    </div>
  );
}

export type NagDraft = {
  message: string;
  channel: string;
  /** Required when channel is webhook (verified endpoint id). */
  webhook_id: string;
  frequency: string;
  time_hhmm: string;
  day_of_week: number | null;
  day_of_month: number | null;
  end_type: string;
  until_date: string;
  occurrences_max: string;
  nag_until_done: boolean;
  /** Empty string = use frequency-based default on the server. */
  followup_interval_hours: string;
};

type NagEndEditorProps = {
  theme: NagThemeClasses;
  draft: NagDraft;
  setDraft: React.Dispatch<React.SetStateAction<NagDraft>>;
};

export function NagEndEditor({ theme, draft, setDraft }: NagEndEditorProps) {
  return (
    <div className="mb-3">
      <span className={`mb-2 block text-[10px] font-bold uppercase tracking-wider ${theme.textSecondaryClass}`}>
        Repeat until
      </span>
      <div className={`mb-2 flex rounded-lg p-0.5 ${theme.accentBgClass}`}>
        {(
          [
            ['forever', 'Forever'],
            ['until_date', 'End date'],
            ['occurrences', '# of times'],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => setDraft((d) => ({ ...d, end_type: v }))}
            className={`flex-1 rounded-md py-2 text-xs font-semibold ${
              draft.end_type === v ? `${theme.cardBgClass} ${theme.textClass}` : theme.textSecondaryClass
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {draft.end_type === 'until_date' && (
        <input
          type="date"
          className={`mb-2 w-full rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
          value={draft.until_date}
          onChange={(e) => setDraft((d) => ({ ...d, until_date: e.target.value }))}
        />
      )}
      {draft.end_type === 'occurrences' && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            className={`w-24 rounded-lg border px-3 py-2.5 text-sm ${theme.inputBgClass}`}
            value={draft.occurrences_max}
            onChange={(e) => setDraft((d) => ({ ...d, occurrences_max: e.target.value }))}
          />
          <span className={`text-sm ${theme.textSecondaryClass}`}>occurrences</span>
        </div>
      )}
    </div>
  );
}
