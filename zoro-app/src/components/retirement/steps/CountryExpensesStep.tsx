'use client';

import React from 'react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { ExpenseBucket, Answers } from '../types';
import { countryData, getCountriesSorted } from '../countryData';
import { formatCurrency, isValueInRange, getTotalMonthlyExpenses } from '../utils';

interface CountryExpensesStepProps {
  darkMode: boolean;
  answers: Answers;
  customBuckets: Record<string, ExpenseBucket> | null;
  showExpenses: boolean;
  showCountryDropdown: boolean;
  cameFromResults: boolean;
  onCountrySelect: (country: string) => void;
  onToggleCountryDropdown: () => void;
  onContinueToExpenses: () => void;
  onBucketChange: (bucketKey: string, newValue: string) => void;
  onSliderChange: (bucketKey: string, newValue: string) => void;
  onContinue: () => void;
  onBackToResults: () => void;
}

export const CountryExpensesStep: React.FC<CountryExpensesStepProps> = ({
  darkMode,
  answers,
  customBuckets,
  showExpenses,
  showCountryDropdown,
  cameFromResults,
  onCountrySelect,
  onToggleCountryDropdown,
  onContinueToExpenses,
  onBucketChange,
  onSliderChange,
  onContinue,
  onBackToResults,
}) => {
  const theme = useThemeClasses(darkMode);

  return (
    <div className="animate-fade-in">
      <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>Where will you spend most of your retired life?</h2>
      
      {/* Country Dropdown */}
      <div className="relative mb-8">
        <button
          onClick={onToggleCountryDropdown}
          className={`w-full p-5 rounded-lg text-left transition-all flex items-center justify-between ${
            darkMode 
              ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700' 
              : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">{countryData[answers.country].flag}</span>
            <span className={`font-medium text-lg ${theme.textClass}`}>{answers.country}</span>
          </div>
          <svg 
            className={`w-5 h-5 transition-transform ${showCountryDropdown ? 'rotate-180' : ''} ${theme.textClass}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showCountryDropdown && (
          <div className={`absolute z-10 w-full mt-2 rounded-lg shadow-xl ${
            darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'
          }`}>
            {getCountriesSorted().map(country => (
              <button
                key={country}
                onClick={() => onCountrySelect(country)}
                className={`w-full p-4 text-left transition-all flex items-center gap-3 hover:bg-opacity-50 ${
                  darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'
                } ${country === answers.country ? (darkMode ? 'bg-slate-750' : 'bg-gray-50') : ''}`}
              >
                <span className="text-2xl">{countryData[country].flag}</span>
                <span className={`font-medium ${theme.textClass}`}>{country}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Expense Buckets */}
      {showExpenses && customBuckets && (
        <div className={`p-6 rounded-lg mb-6 ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'}`}>
          <h3 className={`text-xl font-light mb-2 ${theme.textClass}`}>Review Monthly Expenses</h3>
          <p className={`text-sm mb-6 ${theme.textSecondaryClass}`}>
            Adjust these values to match your expected lifestyle
          </p>
          
          <div className="space-y-6">
            {Object.entries(customBuckets).map(([key, bucket]) => {
              const inRange = bucket.min && bucket.max ? isValueInRange(bucket.value, bucket) : true;
              return (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between items-center mb-1">
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
                        <span>{formatCurrency(bucket.min, countryData[answers.country].currency)}</span>
                        <span>{formatCurrency(bucket.max, countryData[answers.country].currency)}</span>
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
                {formatCurrency(getTotalMonthlyExpenses(customBuckets), countryData[answers.country].currency)}
              </span>
            </div>
            <div className={`text-sm mt-2 ${theme.textSecondaryClass}`}>
              Annual: {formatCurrency(getTotalMonthlyExpenses(customBuckets) * 12, countryData[answers.country].currency)}
            </div>
          </div>
        </div>
      )}

      {!showExpenses ? (
        <button
          onClick={onContinueToExpenses}
          className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-lg"
        >
          Review Expenses
        </button>
      ) : (
        <button
          onClick={cameFromResults ? onBackToResults : onContinue}
          className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-lg"
        >
          {cameFromResults ? 'Back to Results' : 'Continue'}
        </button>
      )}
    </div>
  );
};

