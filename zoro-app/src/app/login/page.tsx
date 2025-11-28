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
  const redirectPath = searchParams?.get('redirect') || '/checkin';
  const mode = searchParams?.get('mode');
  const skipPreference = searchParams?.get('skipPreference') === 'true';
  const emailParam = searchParams?.get('email');
  const tokenParam = searchParams?.get('token');
  const messageParam = searchParams?.get('message');

  const checkUserPreference = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      // PRIORITY 1: Check if there's pending advisor onboarding data in sessionStorage
      // This takes highest priority as it's from the email verification flow
      if (typeof window !== 'undefined') {
        const pendingAdvisor = sessionStorage.getItem('pendingAdvisorOnboarding');
        if (pendingAdvisor) {
          try {
            const advisorData = JSON.parse(pendingAdvisor);
            // Redirect to advisor onboarding completion
            router.push(`/advisors/complete?advisorId=${advisorData.advisorId || ''}`);
            return;
          } catch (e) {
            console.error('Error parsing pending advisor data:', e);
          }
        }
      }

      // PRIORITY 2: Check if user already has advisor preferences but incomplete
      const advisorPrefsResponse = await fetch('/api/advisors/preferences', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (advisorPrefsResponse.ok) {
        const advisorData = await advisorPrefsResponse.json();
        if (advisorData.preferences && !advisorData.preferences.expertise_explanation) {
          // Incomplete onboarding - redirect to completion
          router.push(`/advisors/complete?advisorId=${advisorData.preferences.advisor_id}`);
          return;
        }
      }

      // Check regular user preference
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
      // If user is already logged in and trying to signup/login, redirect to profile
      if (emailParam && !tokenParam) {
        // Email exists message - redirect to profile
        router.push(`/profile?message=${encodeURIComponent(messageParam || 'You are already logged in')}`);
        return;
      }
      // Check if user already has a preference set
      checkUserPreference();
    }
  }, [user, session, skipPreference, checkUserPreference, emailParam, tokenParam, messageParam, router]);

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

  // If mode is signup or token is present, show signup form
  const shouldShowSignup = mode === 'signup' || !!tokenParam || isSignup;

  return shouldShowSignup ? (
    <SignupForm
      darkMode={darkMode}
      initialEmail={emailParam || undefined}
      verificationToken={tokenParam || undefined}
      message={messageParam || undefined}
      onSignup={async (email, password, name) => {
        setLoading(true);
        
        // Verify token if present
        if (tokenParam) {
          try {
            const verifyResponse = await fetch('/api/auth/verify-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, token: tokenParam }),
            });
            
            if (!verifyResponse.ok) {
              const errorData = await verifyResponse.json();
              setLoading(false);
              return { error: new Error(errorData.error || 'Invalid verification token') };
            }
          } catch {
            setLoading(false);
            return { error: new Error('Failed to verify token') };
          }
        }

        const result = await signUp(email, password, name);
        
        // If signup successful, check for pending advisor onboarding first
        if (!result.error && typeof window !== 'undefined') {
          // Check for pending advisor onboarding
          const pendingAdvisor = sessionStorage.getItem('pendingAdvisorOnboarding');
          if (pendingAdvisor) {
            try {
              const advisorData = JSON.parse(pendingAdvisor);
              // Wait a bit for session to be available
              await new Promise(resolve => setTimeout(resolve, 500));
              // Redirect to advisor onboarding completion
              router.push(`/advisors/complete?advisorId=${advisorData.advisorId || ''}`);
              setLoading(false);
              return result;
            } catch (e) {
              console.error('Error parsing pending advisor data:', e);
            }
          }

          // If no advisor onboarding, check for pending form submission
          const pendingData = sessionStorage.getItem('pendingFormSubmission');
          if (pendingData) {
            try {
              const formData = JSON.parse(pendingData);
              // Wait a bit for session to be available
              await new Promise(resolve => setTimeout(resolve, 500));
              const { data: { session } } = await (await import('@/lib/supabase-client')).supabaseClient.auth.getSession();
              
              if (session?.access_token) {
                const submitResponse = await fetch('/api/submit', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({
                    goals: formData.selectedGoals || [],
                    goalDetails: formData.goalDetails || {},
                    name: formData.name,
                    netWorth: formData.netWorth,
                    contactMethod: 'email',
                    additionalInfo: formData.additionalInfo,
                    email: email,
                    userId: session.user.id
                  }),
                });
                
                if (submitResponse.ok) {
                  // Clear pending submission
                  sessionStorage.removeItem('pendingFormSubmission');
                  
                  // Redirect to home with success message
                  router.push('/?submitted=true');
                  setLoading(false);
                  return result;
                }
              }
            } catch (err) {
              console.error('Error submitting pending form:', err);
              // Don't fail signup if form submission fails
            }
          }
        }
        
        setLoading(false);
        // Preference check will happen automatically via useEffect when session is available
        return result;
      }}
      onSwitchToLogin={() => {
        setIsSignup(false);
        // Remove token from URL
        const newParams = new URLSearchParams(searchParams?.toString() || '');
        newParams.delete('token');
        newParams.delete('mode');
        router.push(`/login?${newParams.toString()}`);
      }}
      loading={loading}
    />
  ) : (
    <LoginForm
      darkMode={darkMode}
      initialEmail={emailParam || undefined}
      message={messageParam || undefined}
      onLogin={async (email, password) => {
        setLoading(true);
        const result = await signIn(email, password);
        setLoading(false);
        // Preference check will happen automatically via useEffect when session is available
        return result;
      }}
      onSwitchToSignup={() => {
        setIsSignup(true);
        // Add email to signup URL if present
        if (emailParam) {
          const newParams = new URLSearchParams(searchParams?.toString() || '');
          newParams.set('mode', 'signup');
          router.push(`/login?${newParams.toString()}`);
        }
      }}
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

