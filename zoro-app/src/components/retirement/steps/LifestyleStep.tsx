'use client';

import React from 'react';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface LifestyleStepProps {
  darkMode: boolean;
  onSelect: (lifestyle: string) => void;
}

export const LifestyleStep: React.FC<LifestyleStepProps> = ({ darkMode, onSelect }) => {
  const theme = useThemeClasses(darkMode);

  return (
    <div className="animate-fade-in">
      <h2 className={`text-3xl font-light mb-4 ${theme.textClass}`}>Imagine you are fully retired tomorrow.</h2>
      <p className={`text-lg mb-8 ${theme.textSecondaryClass}`}>
        Your money must last forever. How would you like to live?
      </p>
      <div className="space-y-3">
        {['Simple', 'Comfortable', 'Very Comfortable', 'Luxury'].map((option, idx) => (
          <button
            key={option}
            onClick={() => onSelect(option)}
            className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
              darkMode 
                ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700' 
                : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
            }`}
          >
            <div className={`font-medium text-lg ${theme.textClass}`}>{String.fromCharCode(65 + idx)}. {option}</div>
            <div className={`text-sm mt-1 ${theme.textSecondaryClass}`}>
              {option === 'Simple' && 'Calm, basic, stress-free life'}
              {option === 'Comfortable' && 'Middle/upper-middle lifestyle'}
              {option === 'Very Comfortable' && 'High flexibility and travel'}
              {option === 'Luxury' && 'No real constraints'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

