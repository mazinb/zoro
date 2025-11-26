'use client';

import React, { useState } from 'react';
import { Mail, Lock, LogIn, Loader2 } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ZoroLogo } from '@/components/ZoroLogo';

interface LoginFormProps {
  darkMode: boolean;
  initialEmail?: string;
  message?: string;
  onLogin: (email: string, password: string) => Promise<{ error: Error | null }>;
  onSwitchToSignup: () => void;
  loading?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  darkMode,
  initialEmail,
  message,
  onLogin,
  onSwitchToSignup,
  loading = false
}) => {
  const theme = useThemeClasses(darkMode);
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(message || null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { error } = await onLogin(email, password);
      
      if (error) {
        setError(error.message || 'Failed to sign in. Please check your credentials.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 flex items-center justify-center p-4 ${darkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-slate-50 to-blue-50'}`}>
      <Card darkMode={darkMode} className="w-full max-w-md p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <ZoroLogo className="h-12 mb-4" isDark={darkMode} />
          <h1 className={`text-2xl font-bold ${theme.textClass} mb-2`}>Welcome Back</h1>
          <p className={theme.textSecondaryClass}>Sign in to access your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {infoMessage && (
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-blue-900/30 border border-blue-700' : 'bg-blue-50 border border-blue-200'}`}>
              <p className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>{infoMessage}</p>
            </div>
          )}
          {error && (
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'}`}>
              <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
            </div>
          )}

          <div>
            <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>
              Email
            </label>
            <div className="relative">
              <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${theme.textSecondaryClass} w-5 h-5`} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`w-full pl-10 pr-4 py-3 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme.textClass}`}
                placeholder="your@email.com"
                disabled={isSubmitting || loading || !!initialEmail}
                readOnly={!!initialEmail}
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>
              Password
            </label>
            <div className="relative">
              <Lock className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${theme.textSecondaryClass} w-5 h-5`} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`w-full pl-10 pr-4 py-3 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme.textClass}`}
                placeholder="••••••••"
                disabled={isSubmitting || loading}
              />
            </div>
          </div>

          <Button
            variant="primary"
            darkMode={darkMode}
            type="submit"
            disabled={isSubmitting || loading}
            className="w-full"
          >
            {isSubmitting || loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Sign In
              </>
            )}
          </Button>
        </form>

        <div className={`mt-6 text-center ${theme.textSecondaryClass} text-sm`}>
          Don&apos;t have an account?{' '}
          <button
            onClick={onSwitchToSignup}
            className={`font-medium ${theme.textClass} hover:underline`}
            disabled={isSubmitting || loading}
          >
            Sign up
          </button>
        </div>
      </Card>
    </div>
  );
};

