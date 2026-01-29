'use client';

import React, { useState } from 'react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { AnimatedZoroLogo } from '@/components/AnimatedZoroLogo';
import { Check } from 'lucide-react';
import { formatInputValue, parseInputValue } from '@/components/retirement/utils';

interface BigPurchaseAnswers {
  currency: string | null;
  purchase: string | null;
  priceTag: string | null;
  deadline: string | null;
  currentProgress: string | null;
  tradeoff: string | null;
  recurringCost: string | null;
  specificNote: string | null;
  additionalNotes: string | null;
}

interface BigPurchaseFormProps {
  initialData?: {
    answers?: Partial<BigPurchaseAnswers>;
    sharedData?: any;
  };
  darkMode?: boolean;
  userToken?: string;
  userName?: string;
}

export const BigPurchaseForm: React.FC<BigPurchaseFormProps> = ({
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

  const totalSteps = 9; // Added currency step

  const [answers, setAnswers] = useState<BigPurchaseAnswers>({
    currency: initialData?.answers?.currency || initialData?.sharedData?.currency || null,
    purchase: initialData?.answers?.purchase || null,
    priceTag: initialData?.answers?.priceTag || null,
    deadline: initialData?.answers?.deadline || null,
    currentProgress: initialData?.answers?.currentProgress || null,
    tradeoff: initialData?.answers?.tradeoff || null,
    recurringCost: initialData?.answers?.recurringCost || null,
    specificNote: initialData?.answers?.specificNote || null,
    additionalNotes: initialData?.answers?.additionalNotes || null,
  });

  const saveProgress = async (answersToSave: BigPurchaseAnswers) => {
    if (!userToken && !email) return;
    
    try {
      const response = await fetch('/api/user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: userToken,
          email: email || undefined,
          name: userName,
          formType: 'big_purchase',
          formData: answersToSave,
          sharedData: {
            ...initialData?.sharedData,
            currency: answersToSave.currency,
          },
        }),
      });
      
      const result = await response.json();
      if (result.token && result.token !== userToken) {
        setUserToken(result.token);
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  };

  const validateEmail = (): boolean => {
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

  const handleAnswer = (question: keyof BigPurchaseAnswers, value: string) => {
    setAnswers((prev) => {
      const updated = { ...prev, [question]: value } as BigPurchaseAnswers;
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
          email: userToken ? undefined : email,
          name: userName,
          formType: 'big_purchase',
          formData: answers,
          sharedData: {
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

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
              What currency are you using?
            </h2>
            <div className="space-y-3">
              {[
                { code: '₹', name: 'Indian Rupee (₹)', flag: '🇮🇳' },
                { code: '$', name: 'US Dollar ($)', flag: '🇺🇸' },
                { code: '€', name: 'Euro (€)', flag: '🇪🇺' },
                { code: 'AED', name: 'UAE Dirham (AED)', flag: '🇦🇪' },
                { code: '฿', name: 'Thai Baht (฿)', flag: '🇹🇭' },
              ].map((option) => (
                <button
                  key={option.code}
                  onClick={() => handleAnswer('currency', option.code)}
                  className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
                    darkMode
                      ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700'
                      : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{option.flag}</span>
                    <span className={`font-medium text-lg ${theme.textClass}`}>{option.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
              What are we buying?
            </h2>
            <div className="space-y-3">
              {['Home', 'Car', 'Wedding', 'Dream Vacation', 'Other'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer('purchase', option)}
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
        );

      case 2:
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-4 ${theme.textClass}`}>
              What is the total estimated cost?
            </h2>
            <div className="space-y-4">
              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
                  {answers.currency || '₹'}
                </span>
                <input
                  type="text"
                  value={answers.priceTag ? formatInputValue(answers.priceTag, answers.currency || '₹') : ''}
                  onChange={(e) => {
                    const parsed = parseInputValue(e.target.value);
                    setAnswers((prev) => ({ ...prev, priceTag: parsed }));
                  }}
                  placeholder={answers.currency === '₹' ? 'e.g., 50,00,000 or 50L or 5Cr' : 'e.g., 500,000 or 500K'}
                  className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                    darkMode
                      ? 'bg-slate-800 border border-slate-700 text-gray-100'
                      : 'bg-white border border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              <button
                onClick={() => {
                  if (answers.priceTag) {
                    handleAnswer('priceTag', answers.priceTag);
                  }
                }}
                disabled={!answers.priceTag}
                className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-lg"
              >
                Continue
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-4 ${theme.textClass}`}>
              When do you want to make this happen?
            </h2>
            <div className="space-y-4">
              <input
                type="month"
                value={answers.deadline || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setAnswers((prev) => ({ ...prev, deadline: value }));
                }}
                className={`w-full px-4 py-3 rounded-lg ${
                  darkMode
                    ? 'bg-slate-800 border border-slate-700 text-gray-100'
                    : 'bg-white border border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              <button
                onClick={() => {
                  if (answers.deadline) {
                    handleAnswer('deadline', answers.deadline);
                  }
                }}
                disabled={!answers.deadline}
                className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-lg"
              >
                Continue
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-4 ${theme.textClass}`}>
              How much have you already set aside for this specifically?
            </h2>
            <div className="space-y-4">
              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
                  {answers.currency || '₹'}
                </span>
                <input
                  type="text"
                  value={answers.currentProgress ? formatInputValue(answers.currentProgress, answers.currency || '₹') : ''}
                  onChange={(e) => {
                    const parsed = parseInputValue(e.target.value);
                    setAnswers((prev) => ({ ...prev, currentProgress: parsed }));
                  }}
                  placeholder={answers.currency === '₹' ? 'e.g., 10,00,000 or 10L' : 'e.g., 100,000 or 100K'}
                  className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                    darkMode
                      ? 'bg-slate-800 border border-slate-700 text-gray-100'
                      : 'bg-white border border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              <button
                onClick={() => {
                  if (answers.currentProgress !== null) {
                    handleAnswer('currentProgress', answers.currentProgress || '0');
                  }
                }}
                className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-lg"
              >
                Continue
              </button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
              If you fall short, would you rather wait longer or buy a cheaper version?
            </h2>
            <div className="space-y-3">
              {['Wait longer', 'Compromise'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer('tradeoff', option)}
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
        );

      case 6:
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-4 ${theme.textClass}`}>
              Will this purchase add new monthly expenses? (e.g., Gas, Insurance, Maintenance)
            </h2>
            <div className="space-y-4">
              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
                  {answers.currency || '₹'}
                </span>
                <input
                  type="text"
                  value={answers.recurringCost ? formatInputValue(answers.recurringCost, answers.currency || '₹') : ''}
                  onChange={(e) => {
                    const parsed = parseInputValue(e.target.value);
                    setAnswers((prev) => ({ ...prev, recurringCost: parsed }));
                  }}
                  placeholder={answers.currency === '₹' ? 'e.g., 10,000 or 10K (0 if none)' : 'e.g., 1,000 or 1K (0 if none)'}
                  className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                    darkMode
                      ? 'bg-slate-800 border border-slate-700 text-gray-100'
                      : 'bg-white border border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              <button
                onClick={() => {
                  if (answers.recurringCost !== null) {
                    handleAnswer('recurringCost', answers.recurringCost || '0');
                  }
                }}
                className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-lg"
              >
                Continue
              </button>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-4 ${theme.textClass}`}>
              What's the one thing that would make this purchase perfect?
            </h2>
            <div className="space-y-4">
              <textarea
                value={answers.specificNote || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setAnswers((prev) => ({ ...prev, specificNote: value }));
                }}
                placeholder="Share any specific requirements or preferences..."
                rows={4}
                className={`w-full px-4 py-3 rounded-lg ${
                  darkMode
                    ? 'bg-slate-800 border border-slate-700 text-gray-100'
                    : 'bg-white border border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              <button
                onClick={() => {
                  handleAnswer('specificNote', answers.specificNote || '');
                }}
                className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-lg"
              >
                Continue
              </button>
            </div>
          </div>
        );

      case 8:
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-4 ${theme.textClass}`}>
              Anything else you'd like to share?
            </h2>
            <p className={`text-sm mb-6 ${theme.textSecondaryClass}`}>
              Any additional context, goals, or concerns about this purchase.
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
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-12">
        <h1 className={`text-2xl font-light tracking-tight ${theme.textClass}`}>Plan for Big Purchases</h1>
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

        {renderStep()}
      </div>
    </div>
  );
};

