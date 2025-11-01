'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Question, QuestionOption } from '@/types';

interface QuestionCardProps {
  option: QuestionOption;
  isSelected: boolean;
  darkMode: boolean;
  onClick: () => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  option,
  isSelected,
  darkMode,
  onClick
}) => {
  return (
    <Card
      darkMode={darkMode}
      hover
      onClick={onClick}
      className={`p-8 text-center transition-all ${
        isSelected ? 'border-blue-500 border-2' : 'border-2'
      }`}
    >
      <div className={`mb-3 flex justify-center transition-colors ${
        darkMode ? 'text-slate-400 group-hover:text-blue-600' : 'text-slate-600 group-hover:text-blue-600'
      }`}>
        {option.icon}
      </div>
      <div className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
        {option.label}
      </div>
    </Card>
  );
};

