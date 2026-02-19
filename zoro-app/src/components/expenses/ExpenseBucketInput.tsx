'use client';

import React from 'react';
import { ExpenseBucket } from '@/components/retirement/types';
import { formatCurrency, isValueInRange, getTotalMonthlyExpenses } from '@/components/retirement/utils';

export type ThemeClasses = {
  textClass: string;
  textSecondaryClass: string;
  borderClass?: string;
};

interface ExpenseBucketInputProps {
  buckets: Record<string, ExpenseBucket>;
  onChange: (key: string, value: number) => void;
  currency: string;
  darkMode: boolean;
  theme: ThemeClasses;
}

export function ExpenseBucketInput({
  buckets,
  onChange,
  currency,
  darkMode,
  theme,
}: ExpenseBucketInputProps) {
  const handleBucketChange = (key: string, value: string) => {
    const num = parseFloat(value);
    if (!Number.isNaN(num)) onChange(key, num);
  };

  const handleSliderChange = (key: string, value: string) => {
    const num = parseFloat(value);
    if (!Number.isNaN(num)) onChange(key, num);
  };

  return (
    <div className={`p-6 rounded-lg mb-6 ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'}`}>
      <h3 className={`text-xl font-light mb-2 ${theme.textClass}`}>Review Monthly Expenses</h3>
      <p className={`text-sm mb-6 ${theme.textSecondaryClass}`}>
        Estimate your monthly spending by category (we&apos;ll compare with your statement later)
      </p>

      <div className="space-y-6">
        {Object.entries(buckets).map(([key, bucket]) => {
          const inRange = bucket.min != null && bucket.max != null ? isValueInRange(bucket.value, bucket) : true;
          return (
            <div key={key} className="space-y-2">
              <div className="flex justify-between items-center mb-1">
                <label className={`text-sm font-medium ${theme.textClass}`}>
                  {bucket.label}
                </label>
                <input
                  type="number"
                  value={bucket.value}
                  onChange={(e) => handleBucketChange(key, e.target.value)}
                  className={`w-32 px-3 py-2 rounded text-sm font-medium ${
                    darkMode
                      ? 'bg-slate-900 border border-slate-600 text-gray-100'
                      : 'bg-gray-100 border border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              {bucket.min !== undefined && bucket.max !== undefined && (
                <div className="space-y-1">
                  <input
                    type="range"
                    min={bucket.min}
                    max={bucket.max}
                    step={bucket.step ?? 1}
                    value={inRange ? bucket.value : bucket.min}
                    onChange={(e) => handleSliderChange(key, e.target.value)}
                    disabled={!inRange}
                    className={`w-full h-2 rounded-lg appearance-none cursor-pointer slider ${
                      !inRange ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                    style={{
                      background: inRange
                        ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((bucket.value - bucket.min) / (bucket.max - bucket.min)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} ${((bucket.value - bucket.min) / (bucket.max - bucket.min)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} 100%)`
                        : darkMode ? '#4b5563' : '#d1d5db',
                    }}
                  />
                  <div className={`flex justify-between text-xs ${theme.textSecondaryClass}`}>
                    <span>{formatCurrency(bucket.min, currency)}</span>
                    <span>{formatCurrency(bucket.max, currency)}</span>
                  </div>
                </div>
              )}
              {!inRange && bucket.min !== undefined && bucket.max !== undefined && (
                <p className={`text-xs ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                  Value outside range - slider disabled
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className={`mt-6 pt-6 border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
        <div className="flex justify-between items-center">
          <span className={`text-lg font-medium ${theme.textClass}`}>Total Monthly</span>
          <span className="text-2xl font-light text-blue-500">
            {formatCurrency(getTotalMonthlyExpenses(buckets), currency)}
          </span>
        </div>
        <div className={`text-sm mt-2 ${theme.textSecondaryClass}`}>
          Annual: {formatCurrency(getTotalMonthlyExpenses(buckets) * 12, currency)}
        </div>
      </div>
    </div>
  );
}
