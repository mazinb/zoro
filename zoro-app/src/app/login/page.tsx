'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignupForm } from '@/components/auth/SignupForm';
import { CommunicationPreference } from '@/components/auth/CommunicationPreference';
import { useAuth } from '@/hooks/useAuth';
import { useDarkMode } from '@/hooks/useDarkMode';
import { ContactMethod } from '@/types';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { darkMode } = useDarkMode();
  const { signIn, signUp, user, session } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPreference, setShowPreference] = useState(false);

  // Get redirect params from URL
  const redirectPath = searchParams?.get('redirect') || '/blog';
  const mode = searchParams?.get('mode');
  const skipPreference = searchParams?.get('skipPreference') === 'true';

  const checkUserPreference = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const response = await fetch('/api/user/preference', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // If no preference is set, show preference selection
        if (!data.preferred_communication_method) {
          setShowPreference(true);
        } else {
          // User already has preference, redirect normally
          const finalPath = mode ? `${redirectPath}?mode=${mode}` : redirectPath;
          router.push(finalPath);
        }
      } else {
        // If API fails, show preference anyway to be safe
        setShowPreference(true);
      }
    } catch (error) {
      console.error('Error checking preference:', error);
      // On error, show preference selection
      setShowPreference(true);
    }
  }, [session, router, redirectPath, mode]);

  // Check if user is logged in and show preference selection
  useEffect(() => {
    if (user && session?.access_token && !skipPreference) {
      // Check if user already has a preference set
      checkUserPreference();
    }
  }, [user, session, skipPreference, checkUserPreference]);

  const handlePreferenceSelected = async (method: ContactMethod) => {
    if (!session?.access_token) {
      throw new Error('No session available');
    }

    const response = await fetch('/api/user/preference', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preferred_communication_method: method
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save preference');
    }
  };

  const handleSkipPreference = () => {
    const finalPath = mode ? `${redirectPath}?mode=${mode}` : redirectPath;
    router.push(finalPath);
  };

  // Show communication preference if user is logged in and hasn't set one
  if (user && showPreference) {
    return (
      <CommunicationPreference
        darkMode={darkMode}
        userEmail={user.email}
        onPreferenceSelected={handlePreferenceSelected}
        onSkip={handleSkipPreference}
        loading={loading}
      />
    );
  }

  // If user is logged in and has preference or skip is requested, redirect
  if (user && !showPreference) {
    return null; // Will redirect or preference check is running
  }

  return isSignup ? (
    <SignupForm
      darkMode={darkMode}
      onSignup={async (email, password, name) => {
        setLoading(true);
        const result = await signUp(email, password, name);
        setLoading(false);
        // Preference check will happen automatically via useEffect when session is available
        return result;
      }}
      onSwitchToLogin={() => setIsSignup(false)}
      loading={loading}
    />
  ) : (
    <LoginForm
      darkMode={darkMode}
      onLogin={async (email, password) => {
        setLoading(true);
        const result = await signIn(email, password);
        setLoading(false);
        // Preference check will happen automatically via useEffect when session is available
        return result;
      }}
      onSwitchToSignup={() => setIsSignup(true)}
      loading={loading}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

