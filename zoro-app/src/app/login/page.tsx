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
  const { signIn, signUp, user } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);

  // Get redirect params from URL
  const redirectPath = searchParams?.get('redirect') || '/blog';
  const mode = searchParams?.get('mode');

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const finalPath = mode ? `${redirectPath}?mode=${mode}` : redirectPath;
      router.push(finalPath);
    }
  }, [user, router, redirectPath, mode]);

  if (user) {
    return null; // Will redirect
  }

  return isSignup ? (
    <SignupForm
      darkMode={darkMode}
      onSignup={async (email, password, name) => {
        setLoading(true);
        const result = await signUp(email, password, name);
        setLoading(false);
        if (!result.error) {
          const finalPath = mode ? `${redirectPath}?mode=${mode}` : redirectPath;
          router.push(finalPath);
        }
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
        if (!result.error) {
          const finalPath = mode ? `${redirectPath}?mode=${mode}` : redirectPath;
          router.push(finalPath);
        }
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

