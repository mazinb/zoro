'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Tag, ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/components/retirement/utils';
import type { CategorizedExpenses, ExpenseItem } from './types';
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
  transfer: 'To exclude (not expenses)',
  to_exclude: 'To exclude (not expenses)',
};

type ItemWithId = ExpenseItem & { id: string };

function totalForBucket(items: ItemWithId[]): number {
  return items.reduce((sum, i) => sum + (typeof i.amount === 'number' ? i.amount : 0), 0);
}

interface ReviewClassifyViewProps {
  initialBuckets: CategorizedExpenses;
  currency: string;
  darkMode: boolean;
  theme: ThemeClasses;
  monthLabel: string;
  onSave: (buckets: Record<string, { value: number }>) => Promise<void>;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

export function ReviewClassifyView({
  initialBuckets,
  currency,
  darkMode,
  theme,
  monthLabel,
  onSave,
  saveStatus,
}: ReviewClassifyViewProps) {
  const displayKeys = useMemo((): string[] => {
    const keys: string[] = [...BUCKET_KEYS];
    if (Array.isArray(initialBuckets.to_exclude) && initialBuckets.to_exclude.length > 0) keys.push('to_exclude');
    else if (Array.isArray(initialBuckets.transfer) && initialBuckets.transfer.length > 0) keys.push('transfer');
    return keys;
  }, [initialBuckets]);

  const [editableBuckets, setEditableBuckets] = useState<Record<string, ItemWithId[]>>(() => {
    const keys: string[] = [...BUCKET_KEYS];
    if (Array.isArray(initialBuckets.to_exclude) && initialBuckets.to_exclude.length > 0) keys.push('to_exclude');
    else if (Array.isArray(initialBuckets.transfer) && initialBuckets.transfer.length > 0) keys.push('transfer');
    const out: Record<string, ItemWithId[]> = {};
    let idCounter = 0;
    for (const k of keys) {
      const arr = initialBuckets[k];
      out[k] = Array.isArray(arr)
        ? arr.map((i) => ({ ...i, id: `item-${k}-${idCounter++}-${Math.random().toString(36).slice(2)}` }))
        : [];
    }
    return out;
  });
  const [openMenu, setOpenMenu] = useState<{ bucket: string; index: number } | null>(null);
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveSelectedToMenu, setMoveSelectedToMenu] = useState(false);

  const toggleBucket = useCallback((bucket: string) => {
    setExpandedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(bucket)) next.delete(bucket);
      else next.add(bucket);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedBuckets(new Set(Object.keys(editableBuckets)));
  }, [editableBuckets]);

  const collapseAll = useCallback(() => {
    setExpandedBuckets(new Set());
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllInBucket = useCallback((bucket: string) => {
    const items = editableBuckets[bucket] ?? [];
    const ids = items.map((i) => i.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }, [editableBuckets]);

  const moveItem = useCallback(
    (fromBucket: string, fromIndex: number, toBucket: string) => {
      if (fromBucket === toBucket) {
        setOpenMenu(null);
        return;
      }
      setEditableBuckets((prev) => {
        const fromArr = prev[fromBucket] ?? [];
        const item = fromArr[fromIndex] as ItemWithId | undefined;
        if (!item) return prev;
        const next = { ...prev };
        next[fromBucket] = fromArr.filter((_, i) => i !== fromIndex);
        const toArr = next[toBucket] ?? [];
        next[toBucket] = [...toArr, item];
        return next;
      });
      setOpenMenu(null);
    },
    []
  );

  const moveSelectedTo = useCallback((toBucket: string) => {
    if (selectedIds.size === 0) {
      setMoveSelectedToMenu(false);
      return;
    }
    setEditableBuckets((prev) => {
      const next: Record<string, ItemWithId[]> = { ...prev };
      const toMove: ItemWithId[] = [];
      for (const k of Object.keys(next)) {
        const arr = next[k] ?? [];
        const kept: ItemWithId[] = [];
        for (const item of arr) {
          if (selectedIds.has(item.id)) toMove.push(item);
          else kept.push(item);
        }
        next[k] = kept;
      }
      next[toBucket] = [...(next[toBucket] ?? []), ...toMove];
      return next;
    });
    setSelectedIds(new Set());
    setMoveSelectedToMenu(false);
  }, [selectedIds]);

  const bucketTotals = useMemo(() => {
    const out: Record<string, number> = {};
    for (const k of Object.keys(editableBuckets)) {
      out[k] = totalForBucket(editableBuckets[k] ?? []);
    }
    return out;
  }, [editableBuckets]);

  const handleSave = useCallback(async () => {
    const buckets: Record<string, { value: number }> = {};
    for (const k of BUCKET_KEYS) {
      buckets[k] = { value: bucketTotals[k] ?? 0 };
    }
    await onSave(buckets);
  }, [bucketTotals, onSave]);

  const totalAmount = useMemo(
    () => BUCKET_KEYS.reduce((s, k) => s + (bucketTotals[k] ?? 0), 0),
    [bucketTotals]
  );
  const hasData = totalAmount > 0;

  if (!hasData) {
    return (
      <div
        className={`p-6 rounded-lg ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'}`}
      >
        <p className={theme.textSecondaryClass}>No expenses to review. Try uploading a statement.</p>
      </div>
    );
  }

  return (
    <div
      className={`p-6 rounded-lg ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'}`}
    >
      <h3 className={`text-xl font-light mb-2 ${theme.textClass}`}>Review — {monthLabel}</h3>
      <p className={`mb-4 text-sm ${theme.textSecondaryClass}`}>
        Only category totals are saved. Move lines between categories if needed, then save.
      </p>

      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium"
        >
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save as final'}
        </button>
        {saveStatus === 'error' && <span className="text-sm text-red-500">Save failed</span>}
        <button
          type="button"
          onClick={expandAll}
          className={`text-sm px-3 py-1.5 rounded border ${theme.borderClass ?? (darkMode ? 'border-slate-600' : 'border-gray-300')} ${theme.textClass}`}
        >
          Expand all
        </button>
        <button
          type="button"
          onClick={collapseAll}
          className={`text-sm px-3 py-1.5 rounded border ${theme.borderClass ?? (darkMode ? 'border-slate-600' : 'border-gray-300')} ${theme.textClass}`}
        >
          Collapse all
        </button>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className={`text-sm ${theme.textSecondaryClass}`}>{selectedIds.size} selected</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoveSelectedToMenu((prev) => !prev)}
                className={`text-sm px-3 py-1.5 rounded border ${theme.borderClass ?? (darkMode ? 'border-slate-600' : 'border-gray-300')} ${theme.textClass}`}
              >
                Move selected to…
              </button>
              {moveSelectedToMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    aria-hidden
                    onClick={() => setMoveSelectedToMenu(false)}
                  />
                  <div
                    className={`absolute left-0 top-full mt-1 z-20 py-1 min-w-[200px] rounded-lg shadow-lg border ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'}`}
                  >
                    <div
                      className={`px-3 py-1.5 text-xs font-medium ${theme.textSecondaryClass} ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}
                    >
                      Move to category
                    </div>
                    {displayKeys.map((toKey) => (
                      <button
                        key={toKey}
                        type="button"
                        onClick={() => moveSelectedTo(toKey)}
                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${theme.textClass} ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
                      >
                        {BUCKET_LABELS[toKey] ?? toKey}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className={`text-sm px-3 py-1.5 rounded border ${theme.borderClass ?? (darkMode ? 'border-slate-600' : 'border-gray-300')} ${theme.textSecondaryClass}`}
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      <div className={`rounded-lg border ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
        {displayKeys.map((bucket) => {
          const items = editableBuckets[bucket] ?? [];
          const total = bucketTotals[bucket] ?? 0;
          const isExpanded = expandedBuckets.has(bucket);
          return (
            <div
              key={bucket}
              className={`border-b last:border-b-0 ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}
            >
              <button
                type="button"
                onClick={() => toggleBucket(bucket)}
                className={`w-full px-4 py-2 flex justify-between items-center ${darkMode ? 'bg-slate-800/50 hover:bg-slate-700/50' : 'bg-gray-50 hover:bg-gray-100'} transition-colors text-left`}
              >
                <span className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className={`w-4 h-4 ${theme.textSecondaryClass}`} />
                  ) : (
                    <ChevronRight className={`w-4 h-4 ${theme.textSecondaryClass}`} />
                  )}
                  <span className={`text-sm font-medium ${theme.textClass}`}>
                    {BUCKET_LABELS[bucket] ?? bucket}
                  </span>
                  <span className={`text-xs ${theme.textSecondaryClass}`}>
                    ({items.length} item{items.length !== 1 ? 's' : ''})
                  </span>
                </span>
                <span className={`text-sm font-medium ${theme.textSecondaryClass}`}>
                  {formatCurrency(total, currency)}
                </span>
              </button>
              {isExpanded && (
                <>
                  {items.length > 0 && (
                    <div className={`px-2 py-1 flex items-center gap-2 ${darkMode ? 'bg-slate-800/30' : 'bg-gray-50/50'}`}>
                      <button
                        type="button"
                        onClick={() => selectAllInBucket(bucket)}
                        className={`text-xs px-2 py-1 rounded ${theme.textSecondaryClass} hover:${theme.textClass}`}
                      >
                        Select all in category
                      </button>
                    </div>
                  )}
                  <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                    {items.map((item, index) => {
                      const it = item as ItemWithId;
                      const isSelected = selectedIds.has(it.id);
                      return (
                        <li
                          key={it.id}
                          className={`flex justify-between items-center px-4 py-2 text-sm ${theme.textClass} ${isSelected ? (darkMode ? 'bg-slate-700/30' : 'bg-blue-50') : ''}`}
                        >
                          <label className="flex items-center gap-2 min-w-0 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(it.id)}
                              className="rounded border-gray-300 shrink-0"
                            />
                            <span className="truncate pr-2">{item.description}</span>
                          </label>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`font-medium ${theme.textSecondaryClass}`}>
                              {formatCurrency(item.amount, currency)}
                            </span>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenMenu((prev) =>
                                    prev?.bucket === bucket && prev?.index === index
                                      ? null
                                      : { bucket, index }
                                  )
                                }
                                className={`p-1.5 rounded border ${theme.borderClass ?? (darkMode ? 'border-slate-600' : 'border-gray-300')} ${theme.textSecondaryClass} hover:${theme.textClass}`}
                                title="Change category"
                                aria-label="Change category"
                              >
                                <Tag className="w-4 h-4" />
                              </button>
                              {openMenu?.bucket === bucket && openMenu?.index === index && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    aria-hidden
                                    onClick={() => setOpenMenu(null)}
                                  />
                                  <div
                                    className={`absolute right-0 top-full mt-1 z-20 py-1 min-w-[180px] rounded-lg shadow-lg border ${darkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'}`}
                                  >
                                    <div
                                      className={`px-3 py-1.5 text-xs font-medium ${theme.textSecondaryClass} ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}
                                    >
                                      Move to category
                                    </div>
                                    {displayKeys.filter((k) => k !== bucket).map((toKey) => (
                                      <button
                                        key={toKey}
                                        type="button"
                                        onClick={() => moveItem(bucket, index, toKey)}
                                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${theme.textClass} ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
                                      >
                                        <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                                        {BUCKET_LABELS[toKey] ?? toKey}
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>

      <p className={`mt-4 text-sm ${theme.textSecondaryClass}`}>
        Total: {formatCurrency(totalAmount, currency)}. Save to store category totals only.
      </p>
    </div>
  );
}
