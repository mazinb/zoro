'use client';

import React from 'react';
import { TrendingUp } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Answers } from '../types';
import { countryData } from '../countryData';
import { formatInputValue, parseInputValue } from '../utils';

interface IncomeStepProps {
  darkMode: boolean;
  answers: Answers;
  cameFromResults: boolean;
  onUpdate: (updates: Partial<Answers>) => void;
  onContinue: () => void;
  onBackToResults: () => void;
}

export const IncomeStep: React.FC<IncomeStepProps> = ({
  darkMode,
  answers,
  cameFromResults,
  onUpdate,
  onContinue,
  onBackToResults,
}) => {
  const theme = useThemeClasses(darkMode);
  const currency = countryData[answers.country].currency;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <TrendingUp className="w-8 h-8 text-blue-500" />
        <h2 className={`text-3xl font-light ${theme.textClass}`}>Income & Assets (Optional)</h2>
      </div>
      <p className={`text-sm mb-6 ${theme.textSecondaryClass}`}>
        Help us understand your current financial situation. All fields are optional.
      </p>
      
      <div className="space-y-4">
        <div>
          <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${theme.textClass}`}>
            Liquid Net Worth
            <div className="relative group">
              <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Exclude house, car, and other illiquid assets. Include only stocks, bonds, mutual funds, and cash.
              </div>
            </div>
          </label>
          <div className="relative">
            <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
              {currency}
            </span>
            <input
              type="text"
              value={answers.liquidNetWorth ? formatInputValue(answers.liquidNetWorth, currency) : ''}
              onChange={(e) => {
                const parsed = parseInputValue(e.target.value);
                onUpdate({ liquidNetWorth: parsed });
              }}
              placeholder={currency === '₹' ? '5,00,000' : currency === '฿' ? '500,000' : '50,000'}
              className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                darkMode 
                  ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                  : 'bg-white border border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
        </div>

        <div>
          <label className={`text-sm font-medium mb-2 block ${theme.textClass}`}>
            Annual Income from Job
          </label>
          <div className="relative">
            <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
              {currency}
            </span>
            <input
              type="text"
              value={answers.annualIncomeJob ? formatInputValue(answers.annualIncomeJob, currency) : ''}
              onChange={(e) => {
                const parsed = parseInputValue(e.target.value);
                onUpdate({ annualIncomeJob: parsed });
              }}
              placeholder={currency === '₹' ? '10,00,000' : currency === '฿' ? '1,000,000' : '100,000'}
              className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                darkMode 
                  ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                  : 'bg-white border border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
        </div>

        <div>
          <label className={`text-sm font-medium mb-2 block ${theme.textClass}`}>
            Other Income
          </label>
          <div className="relative">
            <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
              {currency}
            </span>
            <input
              type="text"
              value={answers.otherIncome ? formatInputValue(answers.otherIncome, currency) : ''}
              onChange={(e) => {
                const parsed = parseInputValue(e.target.value);
                onUpdate({ otherIncome: parsed });
              }}
              placeholder={currency === '₹' ? '2,00,000' : currency === '฿' ? '200,000' : '20,000'}
              className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                darkMode 
                  ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                  : 'bg-white border border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
        </div>

        <div>
          <label className={`text-sm font-medium mb-2 block ${theme.textClass}`}>
            Pension
          </label>
          <div className="relative">
            <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
              {currency}
            </span>
            <input
              type="text"
              value={answers.pension ? formatInputValue(answers.pension, currency) : ''}
              onChange={(e) => {
                const parsed = parseInputValue(e.target.value);
                onUpdate({ pension: parsed });
              }}
              placeholder={currency === '₹' ? '3,00,000' : currency === '฿' ? '300,000' : '30,000'}
              className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                darkMode 
                  ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                  : 'bg-white border border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
        </div>

        <div>
          <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${theme.textClass}`}>
            Monthly Liabilities
            <div className="relative group">
              <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Include monthly EMI payments (car loan, home loan) or any other recurring payments (family support, school fees)
              </div>
            </div>
          </label>
          <div className="relative">
            <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
              {currency}
            </span>
            <input
              type="text"
              value={answers.liabilities ? formatInputValue(answers.liabilities, currency) : ''}
              onChange={(e) => {
                const parsed = parseInputValue(e.target.value);
                onUpdate({ liabilities: parsed });
              }}
              placeholder={currency === '₹' ? '50,000' : currency === '฿' ? '50,000' : '5,000'}
              className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                darkMode 
                  ? 'bg-slate-800 border border-slate-700 text-gray-100' 
                  : 'bg-white border border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
        </div>
      </div>

      <button
        onClick={cameFromResults ? onBackToResults : onContinue}
        className="mt-6 w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-lg"
      >
        {cameFromResults ? 'Back to Results' : 'Continue'}
      </button>
    </div>
  );
};

