'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AdvisorOnboardingComplete } from '@/components/advisors/AdvisorOnboardingComplete';
import { useAuth } from '@/hooks/useAuth';
import { useDarkMode } from '@/hooks/useDarkMode';

function AdvisorCompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, session } = useAuth();
  const { darkMode } = useDarkMode();
  const [advisorId, setAdvisorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdvisorId = async () => {
      // First check URL param
      const urlAdvisorId = searchParams?.get('advisorId');
      if (urlAdvisorId) {
        setAdvisorId(urlAdvisorId);
        setLoading(false);
        return;
      }

      // Check session storage for pending onboarding
      if (typeof window !== 'undefined') {
        const pending = sessionStorage.getItem('pendingAdvisorOnboarding');
        if (pending) {
          try {
            const data = JSON.parse(pending);
            if (data.advisorId) {
              setAdvisorId(data.advisorId);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.error('Error parsing pending advisor data:', e);
          }
        }
      }

      // If user is logged in, try to get advisor ID from preferences
      if (user && session?.access_token) {
        try {
          const response = await fetch('/api/advisors/preferences', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.preferences?.advisor_id) {
              setAdvisorId(data.preferences.advisor_id);
              setLoading(false);
              return;
            }
          }
        } catch (error) {
          console.error('Error fetching advisor preferences:', error);
        }
      }

      // No advisor ID found - redirect to advisor onboarding start
      router.push('/advisors');
      setLoading(false);
    };

    checkAdvisorId();
  }, [searchParams, user, session, router]);

  const handleComplete = () => {
    // Clear pending data
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('pendingAdvisorOnboarding');
    }
    // Redirect to profile or dashboard
    router.push('/profile');
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-white'} flex items-center justify-center`}>
        <div className="text-center">
          <p className={darkMode ? 'text-slate-400' : 'text-slate-600'}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!advisorId) {
    return null; // Will redirect
  }

  return (
    <AdvisorOnboardingComplete
      advisorId={advisorId}
      darkMode={darkMode}
      onComplete={handleComplete}
    />
  );
}

export default function AdvisorCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    }>
      <AdvisorCompleteContent />
    </Suspense>
  );
}

