'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { formatCurrency } from '@/components/retirement/utils';
import type { ExpenseBucket } from '@/components/retirement/types';
import type { CategorizedExpenses, BucketsPerFile } from './types';
import type { ThemeClasses } from './ExpenseBucketInput';

import { BUCKET_KEYS } from './types';
const BUCKET_LABELS: Record<string, string> = {
  housing: 'Housing & Utilities',
  food: 'Food & Dining',
  transportation: 'Transportation',
  healthcare: 'Healthcare & Insurance',
  entertainment: 'Entertainment & Leisure',
  other: 'Other Expenses',
  one_time: 'One-off / non-recurring',
  travel: 'Travel',
};

function diffStatus(estimated: number, actual: number): 'close' | 'over' | 'under' {
  if (estimated === 0 && actual === 0) return 'close';
  if (estimated === 0) return 'over';
  const pct = Math.abs(actual - estimated) / estimated;
  if (pct <= 0.1) return 'close';
  return actual > estimated ? 'over' : 'under';
}

function totalForBucket(items: { amount: number }[]): number {
  return items.reduce((sum, i) => sum + (typeof i.amount === 'number' ? i.amount : 0), 0);
}

interface CompareViewProps {
  estimatedBuckets: Record<string, ExpenseBucket>;
  bucketsPerFile: BucketsPerFile[];
  currency: string;
  darkMode: boolean;
  theme: ThemeClasses;
  userName?: string;
  /** Save current estimates to DB (new table). When called from compare view, pass comparedToActuals: true. */
  onSaveEstimatesToDb?: (buckets: Record<string, { value: number }>, comparedToActuals: boolean) => Promise<void>;
  /** Optional token for saving to DB */
  token?: string | null;
  /** When viewing a saved month (bucketTotals only), allow updating saved totals. */
  savedMonth?: string | null;
  onSaveMonthlyTotals?: (buckets: Record<string, { value: number }>) => Promise<void>;
}

const isSavedMonthView = (bucketsPerFile: BucketsPerFile[]) =>
  bucketsPerFile.length > 0 && bucketsPerFile.every((e) => e.bucketTotals && Object.keys(e.bucketTotals).length > 0);

export function CompareView({
  estimatedBuckets,
  bucketsPerFile,
  currency,
  darkMode,
  theme,
  userName,
  onSaveEstimatesToDb,
  token,
  savedMonth,
  onSaveMonthlyTotals,
}: CompareViewProps) {
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMonthlyStatus, setSaveMonthlyStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [revisedValues, setRevisedValues] = useState<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const k of BUCKET_KEYS) {
      out[k] = estimatedBuckets[k]?.value ?? 0;
    }
    return out;
  });

  useEffect(() => {
    setRevisedValues((prev) => {
      const out = { ...prev };
      let changed = false;
      for (const k of BUCKET_KEYS) {
        const v = estimatedBuckets[k]?.value ?? 0;
        if (out[k] !== v) {
          out[k] = v;
          changed = true;
        }
      }
      return changed ? out : prev;
    });
  }, [estimatedBuckets]);

  const numFiles = bucketsPerFile.length || 1;

  const actualTotals = useMemo(() => {
    const out: Record<string, number> = {};
    for (const key of BUCKET_KEYS) {
      let sum = 0;
      for (const entry of bucketsPerFile) {
        if (entry.bucketTotals && typeof entry.bucketTotals[key] === 'number') {
          sum += entry.bucketTotals[key];
        } else {
          const items = entry.buckets[key];
          sum += Array.isArray(items) ? totalForBucket(items) : 0;
        }
      }
      out[key] = numFiles > 0 ? sum / numFiles : 0;
    }
    return out;
  }, [bucketsPerFile, numFiles]);

  const hasData = bucketsPerFile.some(
    ({ buckets, bucketTotals }) =>
      (bucketTotals && Object.values(bucketTotals).some((v) => v > 0)) ||
      BUCKET_KEYS.some((k) => (buckets[k]?.length ?? 0) > 0)
  );

  const canEditSavedMonth = !!savedMonth && !!onSaveMonthlyTotals && isSavedMonthView(bucketsPerFile);
  const [editedActualTotals, setEditedActualTotals] = useState<Record<string, number>>({});
  useEffect(() => {
    if (canEditSavedMonth) {
      const out: Record<string, number> = {};
      for (const k of BUCKET_KEYS) {
        out[k] = actualTotals[k] ?? 0;
      }
      setEditedActualTotals(out);
    }
  }, [canEditSavedMonth, actualTotals]);

  const isUpdatingEstimates = useMemo(() => {
    return BUCKET_KEYS.some(
      (k) => (revisedValues[k] ?? 0) !== (estimatedBuckets[k]?.value ?? 0)
    );
  }, [revisedValues, estimatedBuckets]);

  const handleRevisedChange = (bucket: string, value: number) => {
    setRevisedValues((prev) => ({ ...prev, [bucket]: value }));
  };

  const handleSaveToDb = async () => {
    if (!onSaveEstimatesToDb || !token) return;
    setSaveStatus('saving');
    try {
      const bucketsToSave: Record<string, { value: number }> = {};
      for (const k of BUCKET_KEYS) {
        bucketsToSave[k] = { value: revisedValues[k] ?? estimatedBuckets[k]?.value ?? 0 };
      }
      await onSaveEstimatesToDb(bucketsToSave, true);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  };

  const handleSaveMonthlyTotals = async () => {
    if (!onSaveMonthlyTotals) return;
    setSaveMonthlyStatus('saving');
    try {
      const bucketsToSave: Record<string, { value: number }> = {};
      for (const k of BUCKET_KEYS) {
        bucketsToSave[k] = { value: editedActualTotals[k] ?? actualTotals[k] ?? 0 };
      }
      await onSaveMonthlyTotals(bucketsToSave);
      setSaveMonthlyStatus('saved');
      setTimeout(() => setSaveMonthlyStatus('idle'), 2000);
    } catch {
      setSaveMonthlyStatus('error');
    }
  };

  if (!hasData) {
    return (
      <div className={`p-6 rounded-lg ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'}`}>
        <p className={theme.textSecondaryClass}>No expenses extracted. Try uploading a bank statement PDF.</p>
      </div>
    );
  }

  const handleGetReport = async () => {
    setReport(null);
    setReportLoading(true);
    try {
      const estimated: Record<string, number> = {};
      const actual: Record<string, number> = {};
      for (const k of BUCKET_KEYS) {
        estimated[k] = estimatedBuckets[k]?.value ?? 0;
        actual[k] = actualTotals[k] ?? 0;
      }
      const res = await fetch('/api/expenses/analyze-savings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimated, actual, currency, name: userName || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Report failed');
      setReport(json.data?.report ?? '');
    } catch (e) {
      setReport(e instanceof Error ? e.message : 'Could not load report.');
    } finally {
      setReportLoading(false);
    }
  };

  const toggleBucket = (bucket: string) => {
    setExpandedBucket((prev) => (prev === bucket ? null : bucket));
  };

  return (
    <div className={`p-6 rounded-lg ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'}`}>
      <h3 className={`text-xl font-light mb-2 ${theme.textClass}`}>Compare estimate vs actual</h3>
      <p className={`text-sm mb-4 ${theme.textSecondaryClass}`}>
        Actual amounts are averaged across {numFiles} file{numFiles !== 1 ? 's' : ''}. You can enter revised estimates below (e.g. from actuals). Report uses your original estimates only. Click a category to see expenses by file. Green = within 10%, orange = over, blue = under.
      </p>

      <div className="mb-6 flex flex-wrap gap-3 items-center">
        {!isUpdatingEstimates && (
          <button
            type="button"
            onClick={handleGetReport}
            disabled={reportLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium"
          >
            <FileText className="w-4 h-4" />
            {reportLoading ? 'Generating…' : 'Get savings report'}
          </button>
        )}
        {isUpdatingEstimates && (
          <span className={`text-sm ${theme.textSecondaryClass}`}>
            Report hidden while you edit estimates. Save or reset to original to see report.
          </span>
        )}
        {onSaveEstimatesToDb && token && (
          <button
            type="button"
            onClick={handleSaveToDb}
            disabled={saveStatus === 'saving'}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${theme.borderClass ?? (darkMode ? 'border-slate-700' : 'border-gray-200')} ${theme.textClass} text-sm font-medium disabled:opacity-50`}
          >
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save estimates to history'}
          </button>
        )}
        {saveStatus === 'error' && <span className="text-sm text-red-500">Save failed</span>}
        {canEditSavedMonth && (
          <>
            <button
              type="button"
              onClick={handleSaveMonthlyTotals}
              disabled={saveMonthlyStatus === 'saving'}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${theme.borderClass ?? (darkMode ? 'border-slate-700' : 'border-gray-200')} ${theme.textClass} text-sm font-medium disabled:opacity-50`}
            >
              {saveMonthlyStatus === 'saving' ? 'Saving…' : saveMonthlyStatus === 'saved' ? 'Saved' : 'Update saved totals'}
            </button>
            {saveMonthlyStatus === 'error' && <span className="text-sm text-red-500">Update failed</span>}
          </>
        )}
      </div>
      {canEditSavedMonth && (
        <div className={`mb-4 p-4 rounded-lg border ${darkMode ? 'border-slate-600 bg-slate-900/50' : 'border-gray-200 bg-gray-50'}`}>
          <p className={`text-sm font-medium mb-2 ${theme.textClass}`}>Edit saved totals for {savedMonth} (manual edit only; no re-import)</p>
          <div className="flex flex-wrap gap-4">
            {BUCKET_KEYS.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <label className={`text-xs ${theme.textSecondaryClass}`}>{BUCKET_LABELS[k] ?? k}</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={editedActualTotals[k] ?? 0}
                  onChange={(e) => setEditedActualTotals((prev) => ({ ...prev, [k]: parseFloat(e.target.value) || 0 }))}
                  className={`w-24 px-2 py-1 rounded border text-sm ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
                />
                <span className={`text-xs ${theme.textSecondaryClass}`}>{currency}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {(report !== null || reportLoading) && (
        <div className={`mt-4 p-4 rounded-lg border ${darkMode ? 'border-slate-700 bg-slate-900/50' : 'border-gray-200 bg-gray-50'}`}>
            {reportLoading ? (
              <p className={theme.textSecondaryClass}>Generating report…</p>
            ) : (
              <p className={`text-sm whitespace-pre-wrap ${theme.textClass}`}>{report || 'No report returned.'}</p>
            )}
        </div>
      )}

      <div className={`rounded-lg border ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
        {BUCKET_KEYS.map((bucket) => {
          const estimated = estimatedBuckets[bucket]?.value ?? 0;
          const actual = actualTotals[bucket] ?? 0;
          const revised = revisedValues[bucket] ?? estimated;
          const status = diffStatus(estimated, actual);
          const isExpanded = expandedBucket === bucket;

          return (
            <div
              key={bucket}
              className={`border-b last:border-b-0 ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}
            >
              <button
                type="button"
                onClick={() => toggleBucket(bucket)}
                className={`w-full flex flex-wrap items-center gap-2 justify-between p-4 text-left ${darkMode ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'} transition-colors`}
              >
                <span className={`text-sm font-medium ${theme.textClass}`}>
                  {BUCKET_LABELS[bucket] ?? bucket}
                </span>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-sm ${theme.textSecondaryClass}`}>
                    Est: {formatCurrency(estimated, currency)}
                  </span>
                  <span className={`text-sm ${theme.textSecondaryClass}`}>
                    Actual (avg): {formatCurrency(actual, currency)}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      status === 'close'
                        ? 'text-green-500'
                        : status === 'over'
                          ? 'text-orange-500'
                          : 'text-blue-500'
                    }`}
                  >
                    {status === 'close' ? 'Close' : status === 'over' ? 'Over' : 'Under'}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className={`w-4 h-4 ${theme.textSecondaryClass}`} />
                  ) : (
                    <ChevronRight className={`w-4 h-4 ${theme.textSecondaryClass}`} />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className={`px-4 pb-4 pt-0 ${darkMode ? 'bg-slate-800/50' : 'bg-gray-50/50'}`}>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <label className={`text-xs font-medium ${theme.textSecondaryClass}`}>
                      Revised estimate (optional, input from actuals):
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={revised}
                      onChange={(e) => handleRevisedChange(bucket, parseFloat(e.target.value) || 0)}
                      className={`w-28 px-2 py-1 rounded border text-sm ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'} ${theme.textClass}`}
                    />
                    <span className={`text-xs ${theme.textSecondaryClass}`}>{currency}</span>
                    <button
                      type="button"
                      onClick={() => handleRevisedChange(bucket, actual)}
                      className={`text-xs underline ${theme.textSecondaryClass} hover:${theme.textClass}`}
                    >
                      Use actual (avg)
                    </button>
                  </div>
                  <div className={`rounded-lg border ${darkMode ? 'border-slate-700' : 'border-gray-200'} overflow-hidden`}>
                    <div className={`px-3 py-2 text-xs font-medium ${theme.textSecondaryClass} ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>
                      Actual expenses by file
                    </div>
                    {bucketsPerFile.map(({ fileName, buckets, bucketTotals }) => {
                      const items = buckets[bucket] ?? [];
                      const totalOnly = bucketTotals && typeof bucketTotals[bucket] === 'number';
                      if (items.length === 0 && !totalOnly) return null;
                      return (
                        <div
                          key={fileName}
                          className={`border-b last:border-b-0 ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}
                        >
                          <div className={`px-3 py-2 text-xs font-medium ${theme.textClass} ${darkMode ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                            {fileName}
                          </div>
                          {totalOnly ? (
                            <div className={`px-4 py-2 text-sm ${theme.textSecondaryClass}`}>
                              Saved total: {formatCurrency(bucketTotals![bucket], currency)} (no transaction details stored)
                            </div>
                          ) : (
                            <ul className="divide-y divide-slate-700/50 dark:divide-gray-200/50">
                              {items.map((item, i) => (
                                <li
                                  key={`${fileName}-${i}`}
                                  className={`flex justify-between items-baseline px-4 py-2 text-sm ${theme.textClass}`}
                                >
                                  <span className="truncate pr-2">{item.description}</span>
                                  <span className={`font-medium shrink-0 ${theme.textSecondaryClass}`}>
                                    {formatCurrency(item.amount, currency)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
