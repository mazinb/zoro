'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignupForm } from '@/components/auth/SignupForm';
import { useAuth } from '@/hooks/useAuth';
import { useDarkMode } from '@/hooks/useDarkMode';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { darkMode } = useDarkMode();
  const { signIn, signUp, user, session } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);

  // Get redirect params from URL
  const redirectPath = searchParams?.get('redirect') || '/dashboard';
  const mode = searchParams?.get('mode');
  const emailParam = searchParams?.get('email');
  const tokenParam = searchParams?.get('token');
  const messageParam = searchParams?.get('message');

  // Redirect logged-in users to their intended destination
  useEffect(() => {
    if (user && session?.access_token) {
      if (emailParam && !tokenParam) {
        router.push(`/dashboard?message=${encodeURIComponent(messageParam || 'You are already logged in')}`);
        return;
      }
      const finalPath = mode ? `${redirectPath}?mode=${mode}` : redirectPath;
      router.push(finalPath);
    }
  }, [user, session, redirectPath, mode, emailParam, tokenParam, messageParam, router]);

  if (user) {
    return null;
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

        const result = await signUp(email, password, name);

        // If signup successful, check for pending form submission
        if (!result.error && typeof window !== 'undefined') {
          // Check for pending form submission
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

