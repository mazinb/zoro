'use client';

import React from 'react';
import { Plane } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface TravelStepProps {
  darkMode: boolean;
  onSelect: (travel: string) => void;
}

export const TravelStep: React.FC<TravelStepProps> = ({ darkMode, onSelect }) => {
  const theme = useThemeClasses(darkMode);

  const options = [
    { key: 'rarely', letter: 'A', title: 'Rarely Travel', desc: '1 small trip per year' },
    { key: 'occasionally', letter: 'B', title: 'Occasional Traveler', desc: '2–3 trips per year' },
    { key: 'frequently', letter: 'C', title: 'Frequent Traveler', desc: '4–6 trips per year' },
    { key: 'constantly', letter: 'D', title: 'Always on the Move', desc: 'Travel whenever I feel like it' }
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <Plane className="w-8 h-8 text-blue-500" />
        <h2 className={`text-3xl font-light ${theme.textClass}`}>Travel frequency</h2>
      </div>
      <div className="space-y-3">
        {options.map(option => (
          <button
            key={option.key}
            onClick={() => onSelect(option.key)}
            className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
              darkMode 
                ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700' 
                : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
            }`}
          >
            <div className={`font-medium text-lg ${theme.textClass}`}>{option.letter}. {option.title}</div>
            <div className={`text-sm mt-1 ${theme.textSecondaryClass}`}>
              {option.desc}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

