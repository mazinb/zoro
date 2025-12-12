'use client';

import React from 'react';
import { Home } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Answers } from '../types';

interface HousingStepProps {
  darkMode: boolean;
  answers: Answers;
  onSelect: (housing: string) => void;
}

export const HousingStep: React.FC<HousingStepProps> = ({ darkMode, answers, onSelect }) => {
  const theme = useThemeClasses(darkMode);

  const options = [
    { key: 'own_paid', letter: 'A', title: 'Already Own It', desc: 'A paid-off apartment or house' },
    { key: 'rent_modest', letter: 'B', title: 'Rent Something Modest', desc: '1–2 bedroom in a decent area' },
    { key: 'rent_nice', letter: 'C', title: 'Rent Something Nice', desc: 'Great location, comfort matters' },
    { key: 'own_premium', letter: 'D', title: 'Own a Nice Place', desc: 'Good neighborhood, no luxury, but premium' },
    { key: 'high_end', letter: 'E', title: 'High-End Living', desc: 'Top area / beachfront / prime real estate' }
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <Home className="w-8 h-8 text-blue-500" />
        <h2 className={`text-3xl font-light ${theme.textClass}`}>Housing situation</h2>
      </div>
      <div className="space-y-3">
        {options.map((option) => {
          const isSelected = answers.housing === option.key;
          return (
            <button
              key={option.key}
              onClick={() => onSelect(option.key)}
              className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
                isSelected
                  ? darkMode 
                    ? 'bg-blue-900/30 border-2 border-blue-500' 
                    : 'bg-blue-50 border-2 border-blue-500'
                  : darkMode 
                    ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700' 
                    : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
              }`}
            >
              <div className={`font-medium text-lg ${theme.textClass}`}>{option.letter}. {option.title}</div>
              <div className={`text-sm mt-1 ${theme.textSecondaryClass}`}>
                {option.desc}
              </div>
              {isSelected && (
                <div className={`text-xs mt-2 ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                  ✓ Selected (based on your lifestyle choice)
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

