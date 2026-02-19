'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { formatCurrency } from '@/components/retirement/utils';
import type { ExpenseBucket } from '@/components/retirement/types';
import type { CategorizedExpenses, BucketsPerFile } from './types';
import type { ThemeClasses } from './ExpenseBucketInput';

const BUCKET_KEYS = ['housing', 'food', 'transportation', 'healthcare', 'entertainment', 'other'] as const;
const BUCKET_LABELS: Record<string, string> = {
  housing: 'Housing & Utilities',
  food: 'Food & Dining',
  transportation: 'Transportation',
  healthcare: 'Healthcare & Insurance',
  entertainment: 'Entertainment & Leisure',
  other: 'Other Expenses',
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
}

export function CompareView({
  estimatedBuckets,
  bucketsPerFile,
  currency,
  darkMode,
  theme,
  userName,
}: CompareViewProps) {
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const numFiles = bucketsPerFile.length || 1;

  const actualTotals = useMemo(() => {
    const out: Record<string, number> = {};
    for (const key of BUCKET_KEYS) {
      let sum = 0;
      for (const { buckets } of bucketsPerFile) {
        const items = buckets[key];
        sum += Array.isArray(items) ? totalForBucket(items) : 0;
      }
      out[key] = numFiles > 0 ? sum / numFiles : 0;
    }
    return out;
  }, [bucketsPerFile, numFiles]);

  const hasData = bucketsPerFile.some(({ buckets }) =>
    BUCKET_KEYS.some((k) => (buckets[k]?.length ?? 0) > 0)
  );

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
        Actual amounts are averaged across {numFiles} file{numFiles !== 1 ? 's' : ''}. Click a category to see expenses grouped by file. Green = within 10%, orange = over, blue = under.
      </p>

      <div className="mb-6">
        <button
          type="button"
          onClick={handleGetReport}
          disabled={reportLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium"
        >
          <FileText className="w-4 h-4" />
          {reportLoading ? 'Generating…' : 'Get savings report'}
        </button>
        {(report !== null || reportLoading) && (
          <div className={`mt-4 p-4 rounded-lg border ${darkMode ? 'border-slate-700 bg-slate-900/50' : 'border-gray-200 bg-gray-50'}`}>
            {reportLoading ? (
              <p className={theme.textSecondaryClass}>Generating report…</p>
            ) : (
              <p className={`text-sm whitespace-pre-wrap ${theme.textClass}`}>{report || 'No report returned.'}</p>
            )}
          </div>
        )}
      </div>

      <div className={`rounded-lg border ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
        {BUCKET_KEYS.map((bucket) => {
          const estimated = estimatedBuckets[bucket]?.value ?? 0;
          const actual = actualTotals[bucket] ?? 0;
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
                  <div className={`rounded-lg border ${darkMode ? 'border-slate-700' : 'border-gray-200'} overflow-hidden`}>
                    <div className={`px-3 py-2 text-xs font-medium ${theme.textSecondaryClass} ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>
                      Actual expenses by file
                    </div>
                    {bucketsPerFile.map(({ fileName, buckets }) => {
                      const items = buckets[bucket] ?? [];
                      if (items.length === 0) return null;
                      return (
                        <div
                          key={fileName}
                          className={`border-b last:border-b-0 ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}
                        >
                          <div className={`px-3 py-2 text-xs font-medium ${theme.textClass} ${darkMode ? 'bg-slate-700/50' : 'bg-gray-100'}`}>
                            {fileName}
                          </div>
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
