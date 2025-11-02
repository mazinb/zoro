'use client';

import React, { useState } from 'react';
import { Mail, Lock, User, LogIn, UserPlus, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface EmailAuthInlineProps {
  darkMode: boolean;
  onAuthSuccess: (email: string) => void;
  onSignIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  onSignUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null }>;
  initialMode?: 'login' | 'signup';
  loading?: boolean;
}

export const EmailAuthInline: React.FC<EmailAuthInlineProps> = ({
  darkMode,
  onAuthSuccess,
  onSignIn,
  onSignUp,
  initialMode = 'login',
  loading = false
}) => {
  const theme = useThemeClasses(darkMode);
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const result = mode === 'login'
        ? await onSignIn(email, password)
        : await onSignUp(email, password, name);
      
      if (result.error) {
        setError(result.error.message || `Failed to ${mode === 'login' ? 'sign in' : 'create account'}. Please try again.`);
      } else {
        // Success - callback to parent
        onAuthSuccess(email);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
  };

  return (
    <div className="w-full">
      {error && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${darkMode ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'}`}>
          <AlertCircle className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-red-300' : 'text-red-700'}`} />
          <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <div>
            <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>
              Name (Optional)
            </label>
            <div className="relative">
              <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${theme.textSecondaryClass} w-4 h-4`} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme.textClass} text-sm`}
                placeholder="Your name"
                disabled={isSubmitting || loading}
              />
            </div>
          </div>
        )}

        <div>
          <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>
            Email
          </label>
          <div className="relative">
            <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${theme.textSecondaryClass} w-4 h-4`} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={`w-full pl-10 pr-4 py-2.5 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme.textClass} text-sm`}
              placeholder="your@email.com"
              disabled={isSubmitting || loading}
            />
          </div>
        </div>

        <div>
          <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>
            Password
          </label>
          <div className="relative">
            <Lock className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${theme.textSecondaryClass} w-4 h-4`} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className={`w-full pl-10 pr-4 py-2.5 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme.textClass} text-sm`}
              placeholder="••••••••"
              disabled={isSubmitting || loading}
            />
          </div>
          {mode === 'signup' && (
            <p className={`mt-1 text-xs ${theme.textSecondaryClass}`}>Must be at least 6 characters</p>
          )}
        </div>

        {mode === 'signup' && (
          <div>
            <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>
              Confirm Password
            </label>
            <div className="relative">
              <Lock className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${theme.textSecondaryClass} w-4 h-4`} />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className={`w-full pl-10 pr-4 py-2.5 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme.textClass} text-sm`}
                placeholder="••••••••"
                disabled={isSubmitting || loading}
              />
            </div>
          </div>
        )}

        <div className={`text-xs ${theme.textSecondaryClass} mb-2 italic`}>
          Verification email will be sent
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
              <Loader2 className="w-4 h-4 animate-spin" />
              {mode === 'login' ? 'Signing in...' : 'Creating account...'}
            </>
          ) : (
            <>
              {mode === 'login' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Sign Up
                </>
              )}
            </>
          )}
        </Button>

        <div className={`text-center text-xs ${theme.textSecondaryClass} mt-3`}>
          {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={toggleMode}
            className={`font-medium ${theme.textClass} hover:underline`}
            disabled={isSubmitting || loading}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </form>
    </div>
  );
};

