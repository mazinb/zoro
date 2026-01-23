'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import { ZoroLogo } from '@/components/ZoroLogo';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAuth } from '@/hooks/useAuth';
import { RetirementCalculator } from '@/components/retirement/RetirementCalculator';

export default function RetirePage() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const theme = useThemeClasses(darkMode);
  const { user, session, signOut } = useAuth();
  const isLoggedIn = !!user;

  const [retirementData, setRetirementData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoggedIn && session?.access_token) {
      loadRetirementPlan();
    } else {
      setLoading(false);
    }
  }, [isLoggedIn, session]);

  const loadRetirementPlan = async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/retirement/plan', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.plan) {
          setRetirementData({
            answers: {
              lifestyle: data.plan.lifestyle,
              country: data.plan.country,
              housing: data.plan.housing,
              healthcare: data.plan.healthcare,
              travel: data.plan.travel,
              safety: data.plan.safety,
              liquidNetWorth: data.plan.liquid_net_worth?.toString() || null,
              annualIncomeJob: data.plan.annual_income_job?.toString() || null,
              otherIncome: data.plan.other_income?.toString() || null,
              pension: data.plan.pension?.toString() || null,
              liabilities: data.plan.liabilities?.toString() || null,
            },
            expenseBuckets: data.plan.expense_buckets,
          });
        }
      }
    } catch (error) {
      console.error('Error loading retirement plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${theme.bgClass} transition-colors duration-300`}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-4"></div>
            <p className={theme.textSecondaryClass}>Loading...</p>
          </div>
        </div>
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
            {isLoggedIn && (
              <>
                <button
                  onClick={() => router.push('/checkin')}
                  className={`text-sm ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
                >
                  Check-ins
                </button>
                <button
                  onClick={() => router.push('/profile')}
                  className={`text-sm ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
                >
                  Profile
                </button>
              </>
            )}
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {isLoggedIn && (
              <button 
                onClick={handleLogout}
                className={`text-sm ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </nav>

      <RetirementCalculator 
        initialData={retirementData}
        darkMode={darkMode}
      />
    </div>
  );
}

