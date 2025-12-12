'use client';

import React from 'react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { RetirementResult, Answers } from '../types';
import { formatCurrency } from '../utils';

interface MainResultCardProps {
  darkMode: boolean;
  result: RetirementResult;
  answers: Answers;
}

export const MainResultCard: React.FC<MainResultCardProps> = ({ darkMode, result, answers }) => {
  const theme = useThemeClasses(darkMode);

  return (
    <div className={`p-6 md:p-8 rounded-2xl ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200 shadow-lg'}`}>
      <h2 className={`text-2xl md:text-3xl font-light mb-4 md:mb-6 ${theme.textClass}`}>Your Retirement Number</h2>
      
      <p className={`text-base md:text-lg mb-6 md:mb-8 ${theme.textClass}`}>
        To sustain your selected lifestyle forever in <span className="font-medium text-blue-500">{answers.country}</span>, you need approximately:
      </p>

      <div className="text-center py-6 md:py-8 mb-6 md:mb-8">
        <div className="text-4xl md:text-6xl font-light text-blue-500 mb-4 animate-number-reveal">
          {formatCurrency(result.required, result.currency)}
        </div>
        <div className={`text-sm ${theme.textSecondaryClass} mb-4`}>
          Annual spend: {formatCurrency(result.annualSpend, result.currency)}
        </div>
      </div>
    </div>
  );
};

