'use client';

import React, { useState } from 'react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { AnimatedZoroLogo } from '@/components/AnimatedZoroLogo';
import { Check } from 'lucide-react';
import { CurrencySelector } from './CurrencySelector';
import { NumberInput } from './NumberInput';

interface SaveMoreAnswers {
  currency: string | null;
  currentSurplus: string | null;
  spendingLeakage: string | null;
  emergencyBuffer: string | null;
  existingCash: string | null;
  savingFriction: string | null;
  why: string | null;
  commitment: string | null;
  additionalNotes: string | null;
}

interface SaveMoreFormProps {
  initialData?: {
    answers?: Partial<SaveMoreAnswers>;
    sharedData?: any;
  };
  darkMode?: boolean;
  userToken?: string;
  userName?: string;
}

export const SaveMoreForm: React.FC<SaveMoreFormProps> = ({
  initialData,
  darkMode: propDarkMode,
  userToken: propUserToken,
  userName: propUserName
}) => {
  const darkMode = propDarkMode ?? false;
  const theme = useThemeClasses(darkMode);

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [userToken, setUserToken] = useState<string | undefined>(propUserToken);
  const [userName, setUserName] = useState<string | undefined>(propUserName);

  const totalSteps = 9; // Steps 0-8: currentSurplus, savings challenge, spendingLeakage, emergencyBuffer, existingCash, savingFriction, why, commitment, additionalNotes

  const [answers, setAnswers] = useState<SaveMoreAnswers>({
    currency: initialData?.answers?.currency || initialData?.sharedData?.currency || '₹', // Default to INR
    currentSurplus: initialData?.answers?.currentSurplus || null,
    spendingLeakage: initialData?.answers?.spendingLeakage || null,
    emergencyBuffer: initialData?.answers?.emergencyBuffer || null,
    existingCash: initialData?.answers?.existingCash || null,
    savingFriction: initialData?.answers?.savingFriction || null,
    why: initialData?.answers?.why || null,
    commitment: initialData?.answers?.commitment || null,
    additionalNotes: initialData?.answers?.additionalNotes || null,
  });

  // Auto-save function
  const saveProgress = async (answersToSave: SaveMoreAnswers) => {
    // Allow saving even without email initially - token will be generated on first save
    try {
      const response = await fetch('/api/user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: userToken,
          email: email || undefined,
          name: userName,
          formType: 'save_more',
          formData: answersToSave,
          sharedData: {
            // Cross-populate: existingCash can be used in other forms
            existingCash: answersToSave.existingCash,
            currentSurplus: answersToSave.currentSurplus,
            currency: answersToSave.currency,
          },
        }),
      });
      
      const result = await response.json();
      if (result.token && result.token !== userToken) {
        setUserToken(result.token);
        // Update URL with token
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('token', result.token);
          if (userName) url.searchParams.set('name', userName);
          window.history.replaceState({}, '', url.toString());
        }
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  };

  const validateEmail = (): boolean => {
    // Only validate email if no token (new user)
    if (userToken) {
      return true;
    }
    const trimmed = email.trim();
    const ok = /.+@.+\..+/.test(trimmed);
    if (!ok) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleAnswer = (question: keyof SaveMoreAnswers, value: string) => {
    setAnswers((prev) => {
      const updated = { ...prev, [question]: value } as SaveMoreAnswers;
      setTimeout(() => {
        saveProgress(updated);
      }, 500);
      return updated;
    });
    setTimeout(() => setStep(step + 1), 300);
  };

  const handleSubmit = async () => {
    if (!validateEmail()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: userToken,
          email: userToken ? undefined : email, // Only send email if no token
          name: userName,
          formType: 'save_more',
          formData: answers,
          sharedData: {
            existingCash: answers.existingCash,
            currentSurplus: answers.currentSurplus,
            currency: answers.currency,
          },
        }),
      });

      const result = await response.json();
      const finalToken = result.token || userToken;

      if (finalToken && finalToken !== userToken) {
        setUserToken(finalToken);
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('token', finalToken);
          if (userName) url.searchParams.set('name', userName);
          window.history.replaceState({}, '', url.toString());
        }
      }

      setSubmitted(true);
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted && !showSuccess) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-white'} flex items-center justify-center p-4 transition-colors duration-300`}>
        <div className="flex flex-col items-center justify-center">
          <AnimatedZoroLogo
            className="h-32 md:h-48 lg:h-64"
            isDark={darkMode}
            onAnimationComplete={() => {
              setShowSuccess(true);
            }}
          />
        </div>
      </div>
    );
  }

  if (submitted && showSuccess) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-white'} flex items-center justify-center p-4 transition-colors duration-300`}>
        <div className="max-w-md w-full text-center">
          <div className={`p-8 rounded-2xl ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200 shadow-lg'}`}>
            <div className="bg-green-500 rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center animate-bounce">
              <Check className="w-10 h-10 text-white" aria-hidden="true" />
            </div>
            <h2 className={`text-2xl font-light mb-2 ${theme.textClass}`}>You're all set!</h2>
            <p className={theme.textSecondaryClass}>
              We'll review this and reply manually.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className={`text-2xl font-light tracking-tight ${theme.textClass}`}>Save More Consistently</h1>
        <div className="flex-shrink-0">
          {!userToken && (
            <CurrencySelector
              value={answers.currency}
              onChange={(currency) => {
                setAnswers((prev) => ({ ...prev, currency }));
                saveProgress({ ...answers, currency });
              }}
              darkMode={darkMode}
            />
          )}
          {userToken && (
            <CurrencySelector
              value={answers.currency}
              onChange={() => {}}
              darkMode={darkMode}
              disabled={true}
            />
          )}
        </div>
      </div>

      <div className="mb-12">
        <div className={`h-1 rounded-full ${darkMode ? 'bg-slate-800' : 'bg-gray-200'}`}>
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${(step / (totalSteps - 1)) * 100}%` }}
          />
        </div>
        <p className={`text-sm mt-2 ${theme.textSecondaryClass}`}>
          Step {step + 1} of {totalSteps}
        </p>
      </div>

      <div className="space-y-8">
        {step > 0 && !isSubmitting && (
          <button
            onClick={() => setStep(step - 1)}
            className={`flex items-center gap-2 text-sm transition-colors ${theme.textSecondaryClass} hover:${theme.textClass}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}

        {step === 0 && (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-4 ${theme.textClass}`}>
              After all monthly bills are paid, how much is left over?
            </h2>
            <div className="space-y-4">
              <NumberInput
                value={answers.currentSurplus}
                onChange={(val) => setAnswers((prev) => ({ ...prev, currentSurplus: val }))}
                currency={answers.currency || '₹'}
                placeholder={answers.currency === '₹' ? 'e.g., 50,000 or 5L or 1C' : 'e.g., 5,000 or 5K'}
                darkMode={darkMode}
              />
              <button
                onClick={() => {
                  if (answers.currentSurplus) {
                    handleAnswer('currentSurplus', answers.currentSurplus);
                  }
                }}
                disabled={!answers.currentSurplus}
                className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-lg"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
              What is your biggest savings challenge right now?
            </h2>
            <div className="space-y-3">
              {['Not saving consistently', 'Unexpected expenses', 'Not sure where to start', 'Lifestyle expenses'].map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    // This step doesn't save to a field, just moves forward
                    setTimeout(() => setStep(step + 1), 300);
                  }}
                  className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
                    darkMode
                      ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700'
                      : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                  }`}
                >
                  <div className={`font-medium text-lg ${theme.textClass}`}>{option}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
              Where does your 'unplanned' money usually go?
            </h2>
            <div className="space-y-3">
              {['Dining out', 'Subscriptions', 'Impulse shopping', 'Small daily treats'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer('spendingLeakage', option)}
                  className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
                    darkMode
                      ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700'
                      : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                  }`}
                >
                  <div className={`font-medium text-lg ${theme.textClass}`}>{option}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
              How many months of basic expenses would make you feel safe?
            </h2>
            <div className="space-y-3">
              {['3', '6', '12'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer('emergencyBuffer', option)}
                  className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
                    darkMode
                      ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700'
                      : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                  }`}
                >
                  <div className={`font-medium text-lg ${theme.textClass}`}>{option} months</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-4 ${theme.textClass}`}>
              How much is sitting in your bank right now?
            </h2>
            <div className="space-y-4">
              <NumberInput
                value={answers.existingCash}
                onChange={(val) => setAnswers((prev) => ({ ...prev, existingCash: val }))}
                currency={answers.currency || '₹'}
                placeholder={answers.currency === '₹' ? 'e.g., 5,00,000 or 5L or 1C' : 'e.g., 50,000 or 50K'}
                darkMode={darkMode}
              />
              <button
                onClick={() => {
                  if (answers.existingCash) {
                    handleAnswer('existingCash', answers.existingCash);
                  }
                }}
                disabled={!answers.existingCash}
                className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-lg"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
              What stops you from saving more?
            </h2>
            <div className="space-y-3">
              {['Lack of automation', 'Unexpected bills', 'High debt', 'Lifestyle creep'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer('savingFriction', option)}
                  className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
                    darkMode
                      ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700'
                      : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                  }`}
                >
                  <div className={`font-medium text-lg ${theme.textClass}`}>{option}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
              What are you saving for first?
            </h2>
            <div className="space-y-3">
              {['Peace of mind', 'Travel', 'Big purchase', 'Early retirement'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer('why', option)}
                  className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
                    darkMode
                      ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700'
                      : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                  }`}
                >
                  <div className={`font-medium text-lg ${theme.textClass}`}>{option}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
              Could you commit to moving money automatically on payday?
            </h2>
            <div className="space-y-3">
              {['Yes', 'No', 'Adjust'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer('commitment', option)}
                  className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
                    darkMode
                      ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700'
                      : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                  }`}
                >
                  <div className={`font-medium text-lg ${theme.textClass}`}>{option}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 8 && (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-4 ${theme.textClass}`}>
              Anything else you'd like to share?
            </h2>
            <p className={`text-sm mb-6 ${theme.textSecondaryClass}`}>
              Any additional context, goals, or concerns about your savings.
            </p>
            <div className="mb-6">
              <textarea
                value={answers.additionalNotes || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setAnswers((prev) => ({ ...prev, additionalNotes: value }));
                }}
                placeholder="Share any additional thoughts..."
                rows={4}
                className={`w-full px-4 py-3 rounded-lg ${
                  darkMode
                    ? 'bg-slate-800 border border-slate-700 text-gray-100'
                    : 'bg-white border border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
            {!userToken && (
              <div className="mb-4">
                <label className={`block text-sm font-medium mb-2 ${theme.textClass}`}>
                  Where should we send your summary?
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  placeholder="you@email.com"
                  className={`w-full px-4 py-3 rounded-lg ${
                    darkMode
                      ? 'bg-slate-800 border border-slate-700 text-gray-100'
                      : 'bg-white border border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500 ${emailError ? 'border-red-500' : ''}`}
                />
                {emailError && (
                  <p className="text-sm text-red-500 mt-2" role="alert">
                    {emailError}
                  </p>
                )}
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || (!userToken && !email)}
              className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-lg"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

