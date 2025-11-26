'use client';

import React, { useState } from 'react';
import { Mail, Lock, UserPlus, Loader2, User, LogIn } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ZoroLogo } from '@/components/ZoroLogo';

interface SignupFormProps {
  darkMode: boolean;
  initialEmail?: string;
  verificationToken?: string;
  message?: string;
  onSignup: (email: string, password: string, name?: string) => Promise<{ error: Error | null }>;
  onSwitchToLogin: () => void;
  loading?: boolean;
}

export const SignupForm: React.FC<SignupFormProps> = ({
  darkMode,
  initialEmail,
  verificationToken,
  message,
  onSignup,
  onSwitchToLogin,
  loading = false
}) => {
  const theme = useThemeClasses(darkMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(message || null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await onSignup(email, password, name);
      
      if (error) {
        setError(error.message || 'Failed to create account. Please try again.');
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
          <h1 className={`text-2xl font-bold ${theme.textClass} mb-2`}>Create Account</h1>
          <p className={theme.textSecondaryClass}>Sign up to get started</p>
        </div>

        {/* Login with Email Option */}
        <div className="mb-6">
          <Button
            variant="secondary"
            darkMode={darkMode}
            onClick={onSwitchToLogin}
            disabled={isSubmitting || loading}
            className="w-full"
          >
            <LogIn className="w-5 h-5 mr-2" />
            Login with Email
          </Button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-6">
          <div className={`flex-1 h-px ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
          <span className={`text-sm ${theme.textSecondaryClass}`}>or</span>
          <div className={`flex-1 h-px ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
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
              Name (Optional)
            </label>
            <div className="relative">
              <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${theme.textSecondaryClass} w-5 h-5`} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme.textClass}`}
                placeholder="Your name"
                disabled={isSubmitting || loading}
              />
            </div>
          </div>

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
                minLength={6}
                className={`w-full pl-10 pr-4 py-3 ${theme.inputBgClass} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme.textClass}`}
                placeholder="••••••••"
                disabled={isSubmitting || loading}
              />
            </div>
            <p className={`mt-1 text-xs ${theme.textSecondaryClass}`}>Must be at least 6 characters</p>
          </div>

          <div>
            <label className={`block text-sm font-medium ${theme.textClass} mb-2`}>
              Confirm Password
            </label>
            <div className="relative">
              <Lock className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${theme.textSecondaryClass} w-5 h-5`} />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
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
                Creating account...
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Sign Up
              </>
            )}
          </Button>
        </form>

        <div className={`mt-6 text-center ${theme.textSecondaryClass} text-sm`}>
          Already have an account?{' '}
          <button
            onClick={onSwitchToLogin}
            className={`font-medium ${theme.textClass} hover:underline`}
            disabled={isSubmitting || loading}
          >
            Sign in
          </button>
        </div>
      </Card>
    </div>
  );
};

