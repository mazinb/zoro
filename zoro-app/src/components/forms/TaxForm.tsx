'use client';

import React, { useState } from 'react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { AnimatedZoroLogo } from '@/components/AnimatedZoroLogo';
import { Check } from 'lucide-react';
import { CurrencySelector } from './CurrencySelector';
import { NumberInput } from './NumberInput';
import { useFormSave } from '@/hooks/useFormSave';

interface TaxAnswers {
  currency: string | null;
  incomeSource: string | null;
  grossIncome: string | null;
  deductions: string[];
  retirementStrategy: string | null;
  businessExpenses: string | null;
  bigSurprise: string | null;
  mainGoal: string | null;
  additionalNotes: string | null;
}

interface TaxFormProps {
  initialData?: {
    answers?: Partial<TaxAnswers>;
    sharedData?: any;
  };
  darkMode?: boolean;
  userToken?: string;
  userName?: string;
}

export const TaxForm: React.FC<TaxFormProps> = ({
  initialData,
  darkMode: propDarkMode,
  userToken: propUserToken,
  userName: propUserName
}) => {
  const darkMode = propDarkMode ?? false;
  const theme = useThemeClasses(darkMode);

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSelfEmployed, setIsSelfEmployed] = useState(false);

  // Use shared form save hook
  const {
    email,
    setEmail,
    emailError,
    setEmailError,
    userToken,
    setUserToken,
    userName,
    saveProgress: saveProgressHook,
    validateEmail,
  } = useFormSave<TaxAnswers>({
    formType: 'tax',
    initialData,
    userToken: propUserToken,
    userName: propUserName,
    getSharedData: (answers) => ({
      ...initialData?.sharedData,
      currency: answers.currency,
      grossIncome: answers.grossIncome,
    }),
  });

  const totalSteps = 8; // Removed currency step

  const [answers, setAnswers] = useState<TaxAnswers>({
    currency: initialData?.answers?.currency || initialData?.sharedData?.currency || '₹', // Default to INR
    incomeSource: initialData?.answers?.incomeSource || null,
    grossIncome: initialData?.answers?.grossIncome || null,
    deductions: initialData?.answers?.deductions || [],
    retirementStrategy: initialData?.answers?.retirementStrategy || null,
    businessExpenses: initialData?.answers?.businessExpenses || null,
    bigSurprise: initialData?.answers?.bigSurprise || null,
    mainGoal: initialData?.answers?.mainGoal || null,
    additionalNotes: initialData?.answers?.additionalNotes || null,
  });

  // Auto-save function (wraps the hook's saveProgress)
  const saveProgress = async (answersToSave: TaxAnswers) => {
    await saveProgressHook(answersToSave);
  };

  const handleAnswer = (question: keyof TaxAnswers, value: string) => {
    setAnswers((prev) => {
      const updated = { ...prev, [question]: value } as TaxAnswers;
      if (question === 'incomeSource') {
        setIsSelfEmployed(value === 'Business Owner' || value === 'Freelance/Contractor');
      }
      setTimeout(() => {
        saveProgress(updated);
      }, 500);
      return updated;
    });
    setTimeout(() => setStep(step + 1), 300);
  };

  const handleCheckboxChange = (value: string) => {
    setAnswers((prev) => {
      const updated = {
        ...prev,
        deductions: prev.deductions.includes(value)
          ? prev.deductions.filter((item) => item !== value)
          : [...prev.deductions, value],
      };
      setTimeout(() => {
        saveProgress(updated);
      }, 500);
      return updated;
    });
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
          email: email || undefined,
          name: userName,
          formType: 'tax',
          formData: answers,
          sharedData: {
            currency: answers.currency,
            grossIncome: answers.grossIncome,
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
              How do you primarily earn?
            </h2>
            <div className="space-y-3">
              {['Salaried', 'Freelance/Contractor', 'Business Owner'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer('incomeSource', option)}
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

      case 1:
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-4 ${theme.textClass}`}>
              What is your approximate annual household income?
            </h2>
            <div className="space-y-4">
              <NumberInput
                value={answers.grossIncome}
                onChange={(val) => setAnswers((prev) => ({ ...prev, grossIncome: val }))}
                currency={answers.currency || '₹'}
                placeholder={answers.currency === '₹' ? 'e.g., 10,00,000 or 10L or 1C' : 'e.g., 100,000 or 100K'}
                darkMode={darkMode}
              />
              <button
                onClick={() => {
                  if (answers.grossIncome) {
                    handleAnswer('grossIncome', answers.grossIncome);
                  }
                }}
                disabled={!answers.grossIncome}
                className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-lg"
              >
                Continue
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
              Do you have any of these?
            </h2>
            <div className="space-y-3">
              {['Kids', 'Home Mortgage', 'Student Loans', 'Charitable giving'].map((option) => (
                <label
                  key={option}
                  className={`flex items-center p-5 rounded-lg cursor-pointer transition-all ${
                    answers.deductions.includes(option)
                      ? darkMode
                        ? 'bg-blue-900 border-2 border-blue-500'
                        : 'bg-blue-50 border-2 border-blue-500'
                      : darkMode
                      ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700'
                      : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={answers.deductions.includes(option)}
                    onChange={() => handleCheckboxChange(option)}
                    className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500"
                  />
                  <span className={`ml-3 font-medium text-lg ${theme.textClass}`}>{option}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => setStep(step + 1)}
              className="mt-6 w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-lg"
            >
              Continue
            </button>
          </div>
        );

      case 3:
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
              Are you maxing out your employer-matched retirement accounts?
            </h2>
            <div className="space-y-3">
              {['Yes', 'No', 'Not sure'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer('retirementStrategy', option)}
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

      case 4:
        if (isSelfEmployed) {
          return (
            <div className="animate-fade-in">
              <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
                Do you track home office, travel, or equipment costs?
              </h2>
              <div className="space-y-3">
                {['Yes', 'No'].map((option) => (
                  <button
                    key={option}
                    onClick={() => handleAnswer('businessExpenses', option)}
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
        }
        return null;

      case 5:
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
              Did you owe a lot last year or get a big refund?
            </h2>
            <div className="space-y-3">
              {['Owed a lot', 'Big refund', 'Perfect'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer('bigSurprise', option)}
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
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
              What's your priority?
            </h2>
            <div className="space-y-3">
              {['Pay less now', 'Save for later', 'Avoid an audit'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer('mainGoal', option)}
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

      case 7:
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-4 ${theme.textClass}`}>
              Anything else you'd like to share?
            </h2>
            <p className={`text-sm mb-6 ${theme.textSecondaryClass}`}>
              Any additional context, concerns, or questions about your tax situation.
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

  // Adjust step if we skip business expenses question
  const currentStep = !isSelfEmployed && step === 4 ? step + 1 : step;
  const adjustedTotalSteps = !isSelfEmployed ? totalSteps - 1 : totalSteps;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8 flex flex-row items-center justify-between gap-4">
        <h1 className={`text-2xl font-light tracking-tight ${theme.textClass}`}>Tax Optimization</h1>
        <div className="flex-shrink-0 ml-auto">
          <CurrencySelector
            value={answers.currency}
            onChange={(currency) => {
              setAnswers((prev) => {
                const cleared: TaxAnswers = {
                  ...prev,
                  currency,
                  grossIncome: null,
                };
                saveProgress(cleared);
                return cleared;
              });
            }}
            darkMode={darkMode}
          />
        </div>
      </div>

      <div className="mb-12">
        <div className={`h-1 rounded-full ${darkMode ? 'bg-slate-800' : 'bg-gray-200'}`}>
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${(currentStep / (adjustedTotalSteps - 1)) * 100}%` }}
          />
        </div>
        <p className={`text-sm mt-2 ${theme.textSecondaryClass}`}>
          Step {currentStep + 1} of {adjustedTotalSteps}
        </p>
      </div>

      <div className="space-y-8">
        {currentStep > 0 && !isSubmitting && (
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

