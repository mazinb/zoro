'use client';

import React from 'react';
import { Heart } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface HealthcareStepProps {
  darkMode: boolean;
  onSelect: (healthcare: string) => void;
}

export const HealthcareStep: React.FC<HealthcareStepProps> = ({ darkMode, onSelect }) => {
  const theme = useThemeClasses(darkMode);

  const options = [
    { key: 'basic', letter: 'A', title: 'Basic Coverage', desc: "Public + basic private, I'm okay waiting" },
    { key: 'reliable', letter: 'B', title: 'Private Care', desc: 'Reliable private hospitals and insurance' },
    { key: 'top_tier', letter: 'C', title: 'Premium International', desc: 'Top-tier international healthcare' },
    { key: 'vip', letter: 'D', title: 'VIP Treatment', desc: 'VIP, medical tourism, best of the best' }
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <Heart className="w-8 h-8 text-blue-500" />
        <h2 className={`text-3xl font-light ${theme.textClass}`}>Health in retirement</h2>
      </div>
      <div className="space-y-3">
        {options.map((option) => (
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

