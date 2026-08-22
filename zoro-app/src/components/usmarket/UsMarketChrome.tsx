'use client';

import Link from 'next/link';
import { ArrowLeft, Moon, Sun } from 'lucide-react';

import { ZoroLogo } from '@/components/ZoroLogo';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';

export function UsMarketChrome({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);

  return (
    <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
      <nav className={`border-b ${theme.borderClass}`}>
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/usmarket"
              className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
              aria-label="US market hub"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href="/" className="flex items-center" aria-label="Home">
              <ZoroLogo className="h-10" isDark={darkMode} />
            </Link>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-10">
          <p className={`text-sm uppercase tracking-wide ${theme.textSecondaryClass}`}>US Market</p>
          <h1 className={`mt-2 text-3xl font-semibold ${theme.textClass}`}>{title}</h1>
          {subtitle && (
            <p className={`mt-3 max-w-3xl leading-7 ${theme.textSecondaryClass}`}>{subtitle}</p>
          )}
        </header>
        {children}
      </main>
    </div>
  );
}
