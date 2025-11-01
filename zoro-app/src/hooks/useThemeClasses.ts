import { useMemo } from 'react';

export const useThemeClasses = (darkMode: boolean) => {
  return useMemo(() => ({
    bgClass: darkMode ? 'bg-slate-900' : 'bg-white',
    textClass: darkMode ? 'text-white' : 'text-slate-900',
    textSecondaryClass: darkMode ? 'text-slate-400' : 'text-slate-600',
    borderClass: darkMode ? 'border-slate-800' : 'border-slate-100',
    cardBgClass: darkMode ? 'bg-slate-800' : 'bg-white',
    cardBorderClass: darkMode ? 'border-slate-700' : 'border-slate-200',
    cardHoverClass: darkMode ? 'hover:border-blue-500 hover:bg-slate-700' : 'hover:border-blue-500 hover:bg-slate-50',
    inputBgClass: darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900',
    buttonClass: darkMode ? 'bg-white text-slate-900 hover:bg-slate-100' : 'bg-slate-900 text-white hover:bg-slate-800',
    accentBgClass: darkMode ? 'bg-slate-800' : 'bg-slate-50',
  }), [darkMode]);
};

