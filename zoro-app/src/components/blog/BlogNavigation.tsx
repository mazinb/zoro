'use client';

import React, { useState } from 'react';
import { Moon, Sun, Settings, Bookmark, LogOut, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { ZoroLogo } from '@/components/ZoroLogo';
import { ZoroZIcon } from './ZoroZIcon';
import { ViewMode, User } from '@/types';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface BlogNavigationProps {
  darkMode: boolean;
  viewMode: ViewMode;
  user: User | null;
  savedArticlesCount: number;
  zoroArticlesCount: number;
  onToggleDarkMode: () => void;
  onToggleViewMode: () => void;
  onShowSavedPanel: () => void;
  onShowZoroPanel: () => void;
  onSignOut: () => void;
}

export const BlogNavigation: React.FC<BlogNavigationProps> = ({
  darkMode,
  viewMode,
  user,
  savedArticlesCount,
  zoroArticlesCount,
  onToggleDarkMode,
  onToggleViewMode,
  onShowSavedPanel,
  onShowZoroPanel,
  onSignOut
}) => {
  const theme = useThemeClasses(darkMode);
  const [showUserMenu, setShowUserMenu] = useState(false);

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
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
                    aria-label="User menu"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${darkMode ? 'bg-blue-600' : 'bg-blue-500'} text-white text-sm font-medium`}>
                      {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className={`hidden md:block text-sm font-medium ${theme.textClass}`}>
                      {user.name || user.email?.split('@')[0] || 'User'}
                    </span>
                    <ChevronDown className={`w-4 h-4 ${theme.textSecondaryClass}`} />
                  </button>
                  
                  {showUserMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowUserMenu(false)}
                      />
                      <div className={`absolute right-0 mt-2 w-48 ${theme.cardBgClass} rounded-lg shadow-xl border ${theme.cardBorderClass} z-20 py-2`}>
                        <div className={`px-4 py-2 border-b ${theme.borderClass}`}>
                          <p className={`text-sm font-medium ${theme.textClass}`}>{user.name || 'User'}</p>
                          <p className={`text-xs ${theme.textSecondaryClass}`}>{user.email}</p>
                          {user.role && (
                            <span className={`mt-1 inline-block px-2 py-1 text-xs rounded ${darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-700'}`}>
                              {user.role}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={onSignOut}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm ${theme.textClass} hover:${darkMode ? 'bg-slate-700' : 'bg-slate-100'} transition-colors`}
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  Sign In
                </Link>
              )}
              
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
            <div className="flex items-center gap-3">
              {user && (user.role === 'planner' || user.role === 'admin') && (
                <button
                  onClick={onToggleViewMode}
                  className={`hidden md:flex px-4 py-2 rounded-lg font-medium transition-all items-center gap-2 ${
                    viewMode === 'planner'
                      ? darkMode ? 'bg-white text-slate-900 shadow-lg' : 'bg-slate-800 text-white shadow-lg'
                      : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Settings className="w-5 h-5" />
                  {viewMode === 'planner' ? 'Planner View' : 'Switch to Planner'}
                </button>
              )}

              {viewMode === 'user' && (
                <>
                  <button
                    onClick={onShowSavedPanel}
                    className={`relative px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    aria-label="Saved articles"
                  >
                    <Bookmark className="w-5 h-5" />
                    {savedArticlesCount > 0 && (
                      <span className={`absolute -top-1 -right-1 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ${darkMode ? 'bg-blue-500' : 'bg-slate-800'}`}>
                        {savedArticlesCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={onShowZoroPanel}
                    className={`relative px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    aria-label="Zoro context"
                  >
                    <ZoroZIcon postId="header" isSelected={zoroArticlesCount > 0} className="w-5 h-5" />
                    {zoroArticlesCount > 0 && (
                      <span className={`absolute -top-1 -right-1 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ${darkMode ? 'bg-blue-500' : 'bg-slate-800'}`}>
                        {zoroArticlesCount}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
          <p className={theme.textSecondaryClass}>
            {viewMode === 'user' 
              ? 'Expert guidance for Indians and NRIs on financial planning, investments, and wealth building'
              : 'Admin dashboard for content management and analytics'}
          </p>
        </div>
      </header>
    </>
  );
};

