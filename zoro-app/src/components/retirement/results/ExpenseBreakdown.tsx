'use client';

import React from 'react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { ExpenseBucket, RetirementResult } from '../types';
import { formatCurrency, isValueInRange, getTotalMonthlyExpenses } from '../utils';

interface ExpenseBreakdownProps {
  darkMode: boolean;
  customBuckets: Record<string, ExpenseBucket> | null;
  result: RetirementResult;
  showExpenseBreakdown: boolean;
  editingExpenses: boolean;
  onToggleBreakdown: () => void;
  onToggleEditing: () => void;
  onBucketChange: (bucketKey: string, newValue: string) => void;
  onSliderChange: (bucketKey: string, newValue: string) => void;
}

export const ExpenseBreakdown: React.FC<ExpenseBreakdownProps> = ({
  darkMode,
  customBuckets,
  result,
  showExpenseBreakdown,
  editingExpenses,
  onToggleBreakdown,
  onToggleEditing,
  onBucketChange,
  onSliderChange,
}) => {
  const theme = useThemeClasses(darkMode);

  if (!customBuckets) return null;

  return (
    <div className={`p-4 md:p-6 rounded-lg mb-4 ${darkMode ? 'bg-slate-900/50 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
      <button
        onClick={onToggleBreakdown}
        className="w-full flex justify-between items-center"
      >
        <span className={`font-medium ${theme.textClass}`}>Monthly Expenses</span>
        <div className="flex items-center gap-3">
          <span className={`text-lg font-semibold text-blue-500`}>
            {formatCurrency(getTotalMonthlyExpenses(customBuckets), result.currency)}/month
          </span>
          <svg 
            className={`w-5 h-5 transition-transform ${showExpenseBreakdown ? 'rotate-180' : ''} ${theme.textClass}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {showExpenseBreakdown && (
        <div className={`p-4 md:p-6 rounded-lg mb-6 md:mb-8 ${darkMode ? 'bg-slate-900/50 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg md:text-xl font-medium ${theme.textClass}`}>Monthly Expense Breakdown</h3>
            <button
              onClick={onToggleEditing}
              className={`text-sm px-3 py-1 rounded ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-200 hover:bg-gray-300'} ${theme.textClass}`}
            >
              {editingExpenses ? 'Done' : 'Edit'}
            </button>
          </div>
          {editingExpenses ? (
            <div className="space-y-4">
              {Object.entries(customBuckets).map(([key, bucket]) => {
                const inRange = bucket.min && bucket.max ? isValueInRange(bucket.value, bucket) : true;
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className={`text-sm font-medium ${theme.textClass}`}>
                        {bucket.label}
                      </label>
                      <input
                        type="number"
                        value={bucket.value}
                        onChange={(e) => onBucketChange(key, e.target.value)}
                        className={`w-32 px-3 py-2 rounded text-sm font-medium ${
                          darkMode 
                            ? 'bg-slate-900 border border-slate-600 text-gray-100' 
                            : 'bg-white border border-gray-300 text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                    </div>
                    {bucket.min !== undefined && bucket.max !== undefined && (
                      <div className="space-y-1">
                        <input
                          type="range"
                          min={bucket.min}
                          max={bucket.max}
                          step={bucket.step || 1}
                          value={inRange ? bucket.value : bucket.min}
                          onChange={(e) => onSliderChange(key, e.target.value)}
                          disabled={!inRange}
                          className={`w-full h-2 rounded-lg appearance-none cursor-pointer slider ${
                            !inRange ? 'opacity-30 cursor-not-allowed' : ''
                          }`}
                          style={{
                            background: inRange 
                              ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((bucket.value - bucket.min) / (bucket.max - bucket.min)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} ${((bucket.value - bucket.min) / (bucket.max - bucket.min)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} 100%)`
                              : darkMode ? '#4b5563' : '#d1d5db'
                          }}
                        />
                        <div className={`flex justify-between text-xs ${theme.textSecondaryClass}`}>
                          <span>{formatCurrency(bucket.min, result.currency)}</span>
                          <span>{formatCurrency(bucket.max, result.currency)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className={`pt-4 mt-4 border-t ${darkMode ? 'border-slate-700' : 'border-gray-300'}`}>
                <div className="flex justify-between items-center">
                  <span className={`font-medium ${theme.textClass}`}>Total Monthly</span>
                  <span className={`text-lg font-semibold text-blue-500`}>
                    {formatCurrency(getTotalMonthlyExpenses(customBuckets), result.currency)}
                  </span>
                </div>
                <div className={`text-xs mt-1 ${theme.textSecondaryClass}`}>
                  Annual: {formatCurrency(getTotalMonthlyExpenses(customBuckets) * 12, result.currency)}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(customBuckets).map(([key, bucket]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className={`text-sm ${theme.textSecondaryClass}`}>{bucket.label}</span>
                  <span className={`font-medium ${theme.textClass}`}>
                    {formatCurrency(bucket.value, result.currency)}
                  </span>
                </div>
              ))}
              <div className={`pt-2 mt-2 border-t ${darkMode ? 'border-slate-700' : 'border-gray-300'}`}>
                <div className="flex justify-between items-center">
                  <span className={`font-medium ${theme.textClass}`}>Total Monthly</span>
                  <span className={`text-lg font-semibold text-blue-500`}>
                    {formatCurrency(getTotalMonthlyExpenses(customBuckets), result.currency)}
                  </span>
                </div>
                <div className={`text-xs mt-1 ${theme.textSecondaryClass}`}>
                  Annual: {formatCurrency(getTotalMonthlyExpenses(customBuckets) * 12, result.currency)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

