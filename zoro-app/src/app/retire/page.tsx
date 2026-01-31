'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { RetirementCalculator } from '@/components/retirement/RetirementCalculator';
import { ExpenseBucket, Answers } from '@/components/retirement/types';

function RetirePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);
  const [initialData, setInitialData] = useState<{
    answers?: Partial<Answers>;
    expenseBuckets?: Record<string, ExpenseBucket>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      const token = searchParams.get('token');
      const name = searchParams.get('name');
      
      if (token) {
        try {
          const response = await fetch(`/api/user-data?token=${token}`);
          const result = await response.json();
          
          if (result.data) {
            const retirementAnswers = result.data.retirement_answers;
            const expenseBuckets = result.data.retirement_expense_buckets;
            
            if (retirementAnswers || expenseBuckets) {
              setInitialData({
                answers: retirementAnswers || undefined,
                expenseBuckets: expenseBuckets || undefined,
                email: result.data.email, // Include email so form can use it
              });
            }
          }
        } catch (error) {
          console.error('Failed to load user data:', error);
        }
      }
      setLoading(false);
    };

    loadUserData();
  }, [searchParams]);

  if (loading) {
    return (
      <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300 flex items-center justify-center`}>
        <div className={`${theme.textClass}`}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
      {/* Navigation - matching checkin/profile pages */}
      <nav className={`border-b ${theme.borderClass}`}>
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center cursor-pointer"
            aria-label="Back to home"
          >
            <ZoroLogo className="h-10" isDark={darkMode} />
          </button>
          <div className="flex items-center gap-6">
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      <RetirementCalculator 
        darkMode={darkMode} 
        initialData={initialData || undefined}
        userToken={searchParams.get('token') || undefined}
        userName={searchParams.get('name') || undefined}
      />
    </div>
  );
}

export default function RetirePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300 flex items-center justify-center">
        <div className="text-gray-900 dark:text-gray-100">Loading...</div>
      </div>
    }>
      <RetirePageContent />
    </Suspense>
  );
}

