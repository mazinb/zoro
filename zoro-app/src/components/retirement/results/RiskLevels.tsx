'use client';

import React from 'react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { RetirementResult } from '../types';
import { formatCurrency } from '../utils';

interface RiskLevelsProps {
  darkMode: boolean;
  result: RetirementResult;
}

export const RiskLevels: React.FC<RiskLevelsProps> = ({ darkMode, result }) => {
  const theme = useThemeClasses(darkMode);

  return (
    <div className="space-y-3 mb-6 md:mb-8">
      <div className={`p-3 md:p-4 rounded-lg ${darkMode ? 'bg-slate-750' : 'bg-gray-50'}`}>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <span className={theme.textClass}>Aggressive (higher risk)</span>
          <span className={`font-medium ${theme.textClass}`}>{formatCurrency(result.aggressive, result.currency)}</span>
        </div>
      </div>
      <div className={`p-3 md:p-4 rounded-lg ${darkMode ? 'bg-slate-750' : 'bg-gray-50'}`}>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <span className={theme.textClass}>Balanced (recommended)</span>
          <span className="font-medium text-blue-500">{formatCurrency(result.balanced, result.currency)}</span>
        </div>
      </div>
      <div className={`p-3 md:p-4 rounded-lg ${darkMode ? 'bg-slate-750' : 'bg-gray-50'}`}>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <span className={theme.textClass}>Very Safe (conservative)</span>
          <span className={`font-medium ${theme.textClass}`}>{formatCurrency(result.conservative, result.currency)}</span>
        </div>
      </div>
    </div>
  );
};

