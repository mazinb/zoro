'use client';

import React from 'react';
import { X } from 'lucide-react';
import { formatInputValue, parseInputValue } from '@/components/retirement/utils';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface NumberInputProps {
  value: string | null;
  onChange: (value: string | null) => void;
  currency: string;
  placeholder?: string;
  darkMode?: boolean;
  className?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  currency,
  placeholder,
  darkMode = false,
  className = '',
}) => {
  const theme = useThemeClasses(darkMode);

  return (
    <div className="relative">
      <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
        {currency}
      </span>
      <input
        type="text"
        value={value ? formatInputValue(value, currency) : ''}
        onChange={(e) => {
          const parsed = parseInputValue(e.target.value);
          onChange(parsed || null);
        }}
        placeholder={placeholder}
        className={`w-full pl-8 pr-10 py-3 rounded-lg ${
          darkMode
            ? 'bg-slate-800 border border-slate-700 text-gray-100'
            : 'bg-white border border-gray-300 text-gray-900'
        } focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-opacity-20 ${
            darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
          } transition-colors`}
          aria-label="Clear"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

