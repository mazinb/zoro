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

  const handleSave = async (data: {
    answers: any;
    expenseBuckets: any;
    result: any;
    email?: string;
  }) => {
    if (!session?.access_token) {
      // If not logged in but email provided, create user account
      if (data.email) {
        // Redirect to signup with email pre-filled
        router.push(`/login?email=${encodeURIComponent(data.email)}&redirect=/retire&mode=signup`);
        return;
      }
      throw new Error('Please log in or provide an email to save your plan');
    }

    const response = await fetch('/api/retirement/plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        lifestyle: data.answers.lifestyle,
        country: data.answers.country,
        housing: data.answers.housing,
        healthcare: data.answers.healthcare,
        travel: data.answers.travel,
        safety: data.answers.safety,
        expense_buckets: data.expenseBuckets,
        annual_spend: data.result.annualSpend,
        required_amount: data.result.required,
        aggressive_amount: data.result.aggressive,
        balanced_amount: data.result.balanced,
        conservative_amount: data.result.conservative,
        currency: data.result.currency,
        email_for_breakdown: data.email,
        liquid_net_worth: data.answers.liquidNetWorth,
        annual_income_job: data.answers.annualIncomeJob,
        other_income: data.answers.otherIncome,
        pension: data.answers.pension,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to save retirement plan');
    }

    // Reload the plan after saving
    await loadRetirementPlan();
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
            {isLoggedIn ? (
              <button 
                onClick={handleLogout}
                className={`text-sm ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
              >
                Logout
              </button>
            ) : (
              <button 
                onClick={() => router.push('/login?redirect=/retire')}
                className={`text-sm ${theme.textSecondaryClass} hover:${theme.textClass} transition-colors`}
              >
                Login
              </button>
            )}
          </div>
        </div>
      </nav>

      <RetirementCalculator 
        initialData={retirementData}
        onSave={isLoggedIn ? handleSave : undefined}
      />
    </div>
  );
}

