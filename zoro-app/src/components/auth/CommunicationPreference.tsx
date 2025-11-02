'use client';

import React, { useState } from 'react';
import { Mail, MessageCircle, Loader2, Check } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ZoroLogo } from '@/components/ZoroLogo';
import { ContactMethod } from '@/types';

interface CommunicationPreferenceProps {
  darkMode: boolean;
  userEmail?: string;
  onPreferenceSelected: (method: ContactMethod) => Promise<void>;
  onSkip?: () => void;
  loading?: boolean;
}

export const CommunicationPreference: React.FC<CommunicationPreferenceProps> = ({
  darkMode,
  userEmail,
  onPreferenceSelected,
  onSkip,
  loading = false
}) => {
  const theme = useThemeClasses(darkMode);
  const [selectedMethod, setSelectedMethod] = useState<ContactMethod | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (method: ContactMethod) => {
    setError(null);
    setSelectedMethod(method);
    setIsSubmitting(true);

    try {
      await onPreferenceSelected(method);
      setSuccess(true);
      
      // Redirect after a short delay
      setTimeout(() => {
        window.location.href = '/blog';
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preference. Please try again.');
      setSelectedMethod(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className={`min-h-screen transition-colors duration-300 flex items-center justify-center p-4 ${darkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-slate-50 to-blue-50'}`}>
        <Card darkMode={darkMode} className="w-full max-w-md p-8 shadow-2xl">
          <div className="flex flex-col items-center">
            <div className="bg-green-500 rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h2 className={`text-2xl font-bold ${theme.textClass} mb-2`}>Preference Saved!</h2>
            <p className={theme.textSecondaryClass}>Redirecting you now...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 flex items-center justify-center p-4 ${darkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-slate-50 to-blue-50'}`}>
      <Card darkMode={darkMode} className="w-full max-w-md p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <ZoroLogo className="h-12 mb-4" isDark={darkMode} />
          <h1 className={`text-2xl font-bold ${theme.textClass} mb-2`}>Choose Your Communication Method</h1>
          <p className={theme.textSecondaryClass}>
            {userEmail ? `Welcome back, ${userEmail.split('@')[0]}!` : 'Welcome back!'}
          </p>
          <p className={`text-sm ${theme.textSecondaryClass} mt-2`}>
            How would you like us to reach you?
          </p>
        </div>

        {error && (
          <div className={`p-4 rounded-lg mb-6 ${darkMode ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'}`}>
            <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Email Option */}
          <button
            onClick={() => handleSubmit('email')}
            disabled={isSubmitting || loading}
            className={`w-full p-6 rounded-lg border-2 transition-all ${
              selectedMethod === 'email'
                ? darkMode
                  ? 'border-blue-500 bg-blue-900/20'
                  : 'border-blue-500 bg-blue-50'
                : darkMode
                ? 'border-slate-700 bg-slate-800 hover:border-slate-600'
                : 'border-slate-200 bg-white hover:border-slate-300'
            } ${isSubmitting || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                <Mail className={`w-6 h-6 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
              </div>
              <div className="flex-1 text-left">
                <h3 className={`font-semibold ${theme.textClass} mb-1`}>Email</h3>
                <p className={`text-sm ${theme.textSecondaryClass}`}>
                  We'll send updates to your email address
                </p>
              </div>
              {isSubmitting && selectedMethod === 'email' && (
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              )}
            </div>
          </button>

          {/* WhatsApp Option */}
          <button
            onClick={() => handleSubmit('whatsapp')}
            disabled={isSubmitting || loading}
            className={`w-full p-6 rounded-lg border-2 transition-all ${
              selectedMethod === 'whatsapp'
                ? darkMode
                  ? 'border-green-500 bg-green-900/20'
                  : 'border-green-500 bg-green-50'
                : darkMode
                ? 'border-slate-700 bg-slate-800 hover:border-slate-600'
                : 'border-slate-200 bg-white hover:border-slate-300'
            } ${isSubmitting || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-green-900/30' : 'bg-green-100'}`}>
                <MessageCircle className={`w-6 h-6 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
              </div>
              <div className="flex-1 text-left">
                <h3 className={`font-semibold ${theme.textClass} mb-1`}>WhatsApp</h3>
                <p className={`text-sm ${theme.textSecondaryClass}`}>
                  We'll message you on WhatsApp
                </p>
              </div>
              {isSubmitting && selectedMethod === 'whatsapp' && (
                <Loader2 className="w-5 h-5 animate-spin text-green-500" />
              )}
            </div>
          </button>
        </div>

        {onSkip && (
          <div className="mt-6 text-center">
            <button
              onClick={onSkip}
              className={`text-sm ${theme.textSecondaryClass} hover:underline`}
              disabled={isSubmitting || loading}
            >
              Skip for now
            </button>
          </div>
        )}

        <p className={`text-xs ${theme.textSecondaryClass} text-center mt-6 italic`}>
          🔒 Your privacy matters. You can change this preference anytime.
        </p>
      </Card>
    </div>
  );
};

