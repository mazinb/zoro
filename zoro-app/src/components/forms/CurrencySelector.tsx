'use client';

import React, { useState } from 'react';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface CurrencySelectorProps {
  value: string | null;
  onChange: (currency: string) => void;
  darkMode?: boolean;
  disabled?: boolean;
}

const CURRENCIES = [
  { code: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'AED', name: 'UAE Dirham', flag: '🇦🇪' },
  { code: '฿', name: 'Thai Baht', flag: '🇹🇭' },
];

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  value,
  onChange,
  darkMode = false,
  disabled = false,
}) => {
  const theme = useThemeClasses(darkMode);
  const [isOpen, setIsOpen] = useState(false);
  const selectedCurrency = CURRENCIES.find((c) => c.code === value) || CURRENCIES[0];

  if (disabled) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-2xl">{selectedCurrency.flag}</span>
        <span className={`font-medium ${theme.textClass}`}>{selectedCurrency.code}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
          darkMode
            ? 'bg-slate-800 border-slate-700 hover:bg-slate-750'
            : 'bg-white border-gray-300 hover:bg-gray-50'
        }`}
      >
        <span className="text-xl">{selectedCurrency.flag}</span>
        <span className={`font-medium text-sm ${theme.textClass}`}>{selectedCurrency.code}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''} ${theme.textClass}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={`absolute z-20 mt-2 rounded-lg shadow-xl border min-w-[200px] ${
              darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
            }`}
          >
            {CURRENCIES.map((currency) => (
              <button
                key={currency.code}
                type="button"
                onClick={() => {
                  onChange(currency.code);
                  setIsOpen(false);
                }}
                className={`w-full p-3 text-left transition-all flex items-center gap-3 ${
                  currency.code === value
                    ? darkMode
                      ? 'bg-slate-750'
                      : 'bg-gray-50'
                    : darkMode
                    ? 'hover:bg-slate-700'
                    : 'hover:bg-gray-100'
                }`}
              >
                <span className="text-xl">{currency.flag}</span>
                <div className="flex flex-col">
                  <span className={`font-medium ${theme.textClass}`}>{currency.code}</span>
                  <span className={`text-xs ${theme.textSecondaryClass}`}>{currency.name}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

