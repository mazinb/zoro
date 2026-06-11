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
    legalContentClass: [
      'max-w-none leading-relaxed',
      darkMode ? 'text-slate-200' : 'text-slate-700',
      '[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mb-5 [&_h2]:mt-0',
      darkMode ? '[&_h2]:text-white [&_h3]:text-white [&_strong]:text-white' : '[&_h2]:text-slate-900 [&_h3]:text-slate-900',
      '[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-10 [&_h3]:mb-4',
      '[&_p]:mb-5 [&_p]:leading-7',
      '[&_ul]:mb-5 [&_ul]:mt-2 [&_ul]:pl-6 [&_ul]:list-disc [&_ul]:space-y-2',
      '[&_li]:leading-7',
      darkMode ? '[&_a]:text-blue-400' : '[&_a]:text-blue-600',
      '[&_a]:hover:underline',
    ].join(' '),
  }), [darkMode]);
};

