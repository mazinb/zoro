'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { InvestSmarterForm } from '@/components/forms/InvestSmarterForm';
import { GoalDataGate } from '@/components/goals/GoalDataGate';
import { goalHasRequiredData } from '@/lib/goalDataConfig';
import type { UserDataRow } from '@/lib/goalDataConfig';

function InvestPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);
  const [initialData, setInitialData] = useState<any>(null);
  const [userDataForGate, setUserDataForGate] = useState<UserDataRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [passedGate, setPassedGate] = useState(false);

  const token = searchParams.get('token');
  const userName = searchParams.get('name') || undefined;

  useEffect(() => {
    const loadUserData = async () => {
      if (token) {
        try {
          const response = await fetch(`/api/user-data?token=${token}`);
          const result = await response.json();
          if (result.data) {
            setUserDataForGate(result.data as UserDataRow);
            setInitialData({
              answers: result.data.invest_answers,
              sharedData: result.data.shared_data,
              email: result.data.email,
            });
          }
        } catch (error) {
          console.error('Failed to load user data:', error);
        }
      }
      setLoading(false);
    };

    loadUserData();
  }, [token]);

  if (loading) {
    return (
      <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300 flex items-center justify-center`}>
        <div className={`${theme.textClass}`}>Loading...</div>
      </div>
    );
  }

  const showGate = token && goalHasRequiredData('invest') && !passedGate;

  return (
    <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
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

      {showGate ? (
        <main className="max-w-6xl mx-auto px-6 py-10">
          <GoalDataGate
            goalId="invest"
            userData={userDataForGate}
            token={token}
            userName={userName}
            darkMode={darkMode}
            theme={theme}
            onContinue={() => setPassedGate(true)}
          />
        </main>
      ) : (
        <InvestSmarterForm
          darkMode={darkMode}
          initialData={initialData || undefined}
          userToken={token || undefined}
          userName={userName}
        />
      )}
    </div>
  );
}

export default function InvestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300 flex items-center justify-center">
        <div className="text-gray-900 dark:text-gray-100">Loading...</div>
      </div>
    }>
      <InvestPageContent />
    </Suspense>
  );
}

