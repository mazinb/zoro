'use client';

import React from 'react';
import { Shield } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface SafetyStepProps {
  darkMode: boolean;
  onSelect: (safety: string, defaults: { preRet: number; postRet: number; equityAlloc: number }) => void;
}

export const SafetyStep: React.FC<SafetyStepProps> = ({ darkMode, onSelect }) => {
  const theme = useThemeClasses(darkMode);

  const options = [
    { key: 'ultra_safe', letter: 'A', label: 'Ultra Safe', desc: 'I never want to worry', defaults: { preRet: 5, postRet: 3, equityAlloc: 40 } },
    { key: 'safe', letter: 'B', label: 'Safe', desc: 'Very conservative approach', defaults: { preRet: 6, postRet: 4, equityAlloc: 50 } },
    { key: 'balanced', letter: 'C', label: 'Balanced', desc: 'Balanced & realistic', defaults: { preRet: 8, postRet: 5, equityAlloc: 70 } },
    { key: 'aggressive', letter: 'D', label: 'Aggressive', desc: "I'm okay with some risk", defaults: { preRet: 10, postRet: 6, equityAlloc: 80 } }
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="w-8 h-8 text-blue-500" />
        <h2 className={`text-3xl font-light ${theme.textClass}`}>How safe does your plan need to be?</h2>
      </div>
      <div className="space-y-3">
        {options.map(option => (
          <button
            key={option.key}
            onClick={() => onSelect(option.key, option.defaults)}
            className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
              darkMode 
                ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700' 
                : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
            }`}
          >
            <div className={`font-medium text-lg ${theme.textClass}`}>{option.letter}. {option.label}</div>
            <div className={`text-sm mt-1 ${theme.textSecondaryClass}`}>
              {option.desc}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

