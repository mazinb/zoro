'use client';

import React, { useState } from 'react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { AnimatedZoroLogo } from '@/components/AnimatedZoroLogo';
import { Check } from 'lucide-react';
import { useFormSave } from '@/hooks/useFormSave';

interface InsuranceAnswers {
  householdSize: string | null;
  currentStack: string[];
  lifeInsuranceMath: string | null;
  criticalIllness: string | null;
  liabilityCheck: string | null;
  premiumPulse: string | null;
  renewal: string | null;
  additionalNotes: string | null;
}

interface InsuranceFormProps {
  initialData?: {
    answers?: Partial<InsuranceAnswers>;
    sharedData?: any;
  };
  darkMode?: boolean;
  userToken?: string;
  userName?: string;
}

export const InsuranceForm: React.FC<InsuranceFormProps> = ({
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
  } = useFormSave<InsuranceAnswers>({
    formType: 'insurance',
    initialData,
    userToken: propUserToken,
    userName: propUserName,
    getSharedData: (answers) => ({
      ...initialData?.sharedData,
      householdSize: answers.householdSize,
    }),
  });

  const totalSteps = 8;

  const [answers, setAnswers] = useState<InsuranceAnswers>({
    householdSize: initialData?.answers?.householdSize || null,
    currentStack: initialData?.answers?.currentStack || [],
    lifeInsuranceMath: initialData?.answers?.lifeInsuranceMath || null,
    criticalIllness: initialData?.answers?.criticalIllness || null,
    liabilityCheck: initialData?.answers?.liabilityCheck || null,
    premiumPulse: initialData?.answers?.premiumPulse || null,
    renewal: initialData?.answers?.renewal || null,
    additionalNotes: initialData?.answers?.additionalNotes || null,
  });

  // Auto-save function (wraps the hook's saveProgress)
  const saveProgress = async (answersToSave: InsuranceAnswers) => {
    await saveProgressHook(answersToSave);
  };

  const handleAnswer = (question: keyof InsuranceAnswers, value: string) => {
    setAnswers((prev) => {
      const updated = { ...prev, [question]: value } as InsuranceAnswers;
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
        currentStack: prev.currentStack.includes(value)
          ? prev.currentStack.filter((item) => item !== value)
          : [...prev.currentStack, value],
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
          formType: 'insurance',
          formData: answers,
          sharedData: {
            householdSize: answers.householdSize,
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
            <h2 className={`text-3xl font-light mb-4 ${theme.textClass}`}>
              How many people (and pets) depend on your income?
            </h2>
            <div className="space-y-4">
              <input
                type="number"
                min="0"
                value={answers.householdSize || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setAnswers((prev) => ({ ...prev, householdSize: value }));
                }}
                placeholder="Enter number"
                className={`w-full px-4 py-3 rounded-lg ${
                  darkMode
                    ? 'bg-slate-800 border border-slate-700 text-gray-100'
                    : 'bg-white border border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              <button
                onClick={() => {
                  if (answers.householdSize) {
                    handleAnswer('householdSize', answers.householdSize);
                  }
                }}
                disabled={!answers.householdSize}
                className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-lg"
              >
                Continue
              </button>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
              Which of these do you already have?
            </h2>
            <div className="space-y-3">
              {['Health', 'Life', 'Auto', 'Home/Renters', 'Disability'].map((option) => (
                <label
                  key={option}
                  className={`flex items-center p-5 rounded-lg cursor-pointer transition-all ${
                    answers.currentStack.includes(option)
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
                    checked={answers.currentStack.includes(option)}
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

      case 2:
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
              In a worst-case scenario, how many years of your salary should your family receive?
            </h2>
            <div className="space-y-3">
              {['3', '5', '10', '20'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer('lifeInsuranceMath', option)}
                  className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
                    darkMode
                      ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700'
                      : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                  }`}
                >
                  <div className={`font-medium text-lg ${theme.textClass}`}>{option} years</div>
                </button>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
              Do you have a plan for a major medical emergency that stops you from working?
            </h2>
            <div className="space-y-3">
              {['Yes', 'No', "I think my job covers it"].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer('criticalIllness', option)}
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
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
              Do you own assets (home, car, business) that could be at risk in a lawsuit?
            </h2>
            <div className="space-y-3">
              {['Yes', 'No'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer('liabilityCheck', option)}
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

      case 5:
        return (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>
              Are you happy with what you're currently paying?
            </h2>
            <div className="space-y-3">
              {["It's fine", 'Too high', 'I have no idea'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer('premiumPulse', option)}
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
              When did you last shop around for a better rate?
            </h2>
            <div className="space-y-3">
              {['Last 12 months', '2+ years', 'Never'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer('renewal', option)}
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
              Any additional context, concerns, or questions about your insurance coverage.
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
        <h1 className={`text-2xl font-light tracking-tight ${theme.textClass}`}>Review Insurance</h1>
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

