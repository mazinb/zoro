'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface BlogNavigationProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const BlogNavigation: React.FC<BlogNavigationProps> = ({
  darkMode,
  onToggleDarkMode
}) => {
  const theme = useThemeClasses(darkMode);

  return (
    <>
      {/* Navigation */}
      <nav className={`border-b ${theme.borderClass} ${theme.cardBgClass} shadow-md`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center" aria-label="Home">
              <ZoroLogo className="h-8" isDark={darkMode} />
            </Link>
            <div className="flex items-center gap-4">
              <button
                onClick={onToggleDarkMode}
                className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Header with View Toggle */}
      <header className={`${theme.cardBgClass} shadow-md border-b ${theme.borderClass}`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className={`text-3xl font-bold ${theme.textClass}`}>Wealth Management Insights</h1>
          </div>
          <p className={theme.textSecondaryClass}>
            Expert guidance for Indians and NRIs on financial planning, investments, and wealth building
          </p>
        </div>
      </header>
    </>
  );
};

