'use client';

import React, { useState } from 'react';
import { Bell } from 'lucide-react';

type Context = 'income' | 'assets' | 'expenses';
type Recurrence = 'monthly' | 'quarterly' | 'annually';

type ThemeClasses = {
  textClass: string;
  textSecondaryClass: string;
  borderClass: string;
};

type Props = {
  token: string | null;
  context: Context;
  defaultDescription: string;
  darkMode: boolean;
  theme: ThemeClasses;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function AddReminderForm({ token, context, defaultDescription, darkMode, theme }: Props) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(defaultDescription);
  const [recurrence, setRecurrence] = useState<Recurrence>('monthly');
  const [recurrenceDay, setRecurrenceDay] = useState(1);
  const [recurrenceWeek, setRecurrenceWeek] = useState(1);
  const [recurrenceMonth, setRecurrenceMonth] = useState(1);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setStatus('sending');
    setError(null);
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          description: description.trim() || defaultDescription,
          context,
          recurrence,
          recurrence_day: recurrence === 'monthly' ? recurrenceDay : undefined,
          recurrence_week: recurrence === 'quarterly' ? recurrenceWeek : undefined,
          recurrence_month: recurrence === 'annually' ? recurrenceMonth : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Failed');
        setStatus('error');
        return;
      }
      setStatus('sent');
      setOpen(false);
    } catch {
      setError('Failed to create reminder');
      setStatus('error');
    }
  };

  return (
    <div className="mt-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex items-center gap-1 text-sm ${theme.textSecondaryClass} hover:${theme.textClass}`}
        >
          <Bell className="w-4 h-4" />
          Add reminder
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className={`p-3 rounded-lg border ${theme.borderClass} ${darkMode ? 'bg-slate-900/40' : 'bg-gray-50'}`}
        >
          <label className={`block text-xs font-medium mb-1 ${theme.textSecondaryClass}`}>Recurrence</label>
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as Recurrence)}
            className={`w-full px-2 py-1.5 rounded border text-sm mb-2 ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
          </select>

          {recurrence === 'monthly' && (
            <>
              <label className={`block text-xs font-medium mb-1 ${theme.textSecondaryClass}`}>Day of month</label>
              <select
                value={recurrenceDay}
                onChange={(e) => setRecurrenceDay(Number(e.target.value))}
                className={`w-full px-2 py-1.5 rounded border text-sm mb-2 ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </>
          )}
          {recurrence === 'quarterly' && (
            <>
              <label className={`block text-xs font-medium mb-1 ${theme.textSecondaryClass}`}>Week of quarter</label>
              <select
                value={recurrenceWeek}
                onChange={(e) => setRecurrenceWeek(Number(e.target.value))}
                className={`w-full px-2 py-1.5 rounded border text-sm mb-2 ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
              >
                {[1, 2, 3, 4].map((w) => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
            </>
          )}
          {recurrence === 'annually' && (
            <>
              <label className={`block text-xs font-medium mb-1 ${theme.textSecondaryClass}`}>Month</label>
              <select
                value={recurrenceMonth}
                onChange={(e) => setRecurrenceMonth(Number(e.target.value))}
                className={`w-full px-2 py-1.5 rounded border text-sm mb-2 ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
              >
                {MONTHS.map((name, i) => (
                  <option key={i} value={i + 1}>{name}</option>
                ))}
              </select>
            </>
          )}

          <label className={`block text-xs font-medium mb-1 ${theme.textSecondaryClass}`}>Note</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={defaultDescription}
            className={`w-full px-2 py-1.5 rounded border text-sm mb-2 ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
          />
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="submit"
              disabled={status === 'sending'}
              className={`py-1.5 px-3 rounded border text-sm ${theme.borderClass} ${theme.textClass} disabled:opacity-50`}
            >
              {status === 'sending' ? 'Adding…' : 'Add reminder'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setStatus('idle'); setError(null); }} className={`text-sm ${theme.textSecondaryClass}`}>
              Cancel
            </button>
            {status === 'sent' && <span className="text-sm text-green-600">Reminder set</span>}
            {error && <span className="text-sm text-red-500">{error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
