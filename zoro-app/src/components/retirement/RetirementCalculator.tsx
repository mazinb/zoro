'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useFormSave } from '@/hooks/useFormSave';
import { Shield, TrendingUp, Check, ExternalLink } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { RETIREMENT_CONFIG } from './retirementConfig';
import { ExpenseBucket, Answers } from './types';
import { countryData, getCountriesSorted } from './countryData';
import { formatCurrency, formatInputValue, parseInputValue, getTotalMonthlyExpenses } from './utils';
import { HousingStep } from './steps/HousingStep';
import { HealthcareStep } from './steps/HealthcareStep';
import { TravelStep } from './steps/TravelStep';
import { AnimatedZoroLogo } from '@/components/AnimatedZoroLogo';

const { lifestyleToHousingDefault } = RETIREMENT_CONFIG;

interface RetirementCalculatorProps {
  initialData?: {
    answers?: Partial<Answers>;
    expenseBuckets?: Record<string, ExpenseBucket>;
    email?: string;
  };
  darkMode?: boolean;
  userToken?: string;
  userName?: string;
}

export const RetirementCalculator: React.FC<RetirementCalculatorProps> = ({
  initialData,
  darkMode: propDarkMode,
  userToken: propUserToken,
  userName: propUserName
}) => {
  const darkMode = propDarkMode ?? false;
  const theme = useThemeClasses(darkMode);

  const [step, setStep] = useState(0);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  /** Expense buckets from user_data (expenses page). Read-only here; edit at /expenses. */
  const [customBuckets, setCustomBuckets] = useState<Record<string, ExpenseBucket> | null>(
    initialData?.expenseBuckets || null
  );
  const [liquidNetWorthError, setLiquidNetWorthError] = useState('');
  const [finalNotes, setFinalNotes] = useState('');
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
    validateEmail: validateEmailHook,
  } = useFormSave<Answers>({
    formType: 'retirement',
    initialData,
    userToken: propUserToken,
    userName: propUserName,
    getSharedData: (answers) => ({
      liquidNetWorth: answers.liquidNetWorth,
      annualIncomeJob: answers.annualIncomeJob,
      otherIncome: answers.otherIncome,
      country: answers.country,
    }),
    expenseBuckets: customBuckets,
  });

  const totalSteps = 8;

  const [answers, setAnswers] = useState<Answers>({
    lifestyle: initialData?.answers?.lifestyle || null,
    country: initialData?.answers?.country || 'India',
    housing: initialData?.answers?.housing || null,
    healthcare: initialData?.answers?.healthcare || null,
    travel: initialData?.answers?.travel || null,
    safety: initialData?.answers?.safety || null,
    liquidNetWorth: initialData?.answers?.liquidNetWorth || null,
    annualIncomeJob: initialData?.answers?.annualIncomeJob || null,
    otherIncome: initialData?.answers?.otherIncome || null,
    pension: initialData?.answers?.pension || null,
    liabilities: initialData?.answers?.liabilities || null,
  });

  useEffect(() => {
    if (initialData?.expenseBuckets) {
      setCustomBuckets(initialData.expenseBuckets);
    }
  }, [initialData]);

  // Auto-save function (wraps the hook's saveProgress). Expense buckets are read-only from initialData; only expenses page writes them.
  const saveProgress = async (answersToSave: Answers, _bucketsToSave?: Record<string, ExpenseBucket> | null) => {
    await saveProgressHook(answersToSave);
  };

  const validateLiquidNetWorth = (): boolean => {
    const value = parseFloat(answers.liquidNetWorth || '0') || 0;
    if (value <= 0) {
      setLiquidNetWorthError('Please enter a non-zero liquid net worth');
      return false;
    }
    setLiquidNetWorthError('');
    return true;
  };

  // Use hook's validateEmail but keep custom validation for liquidNetWorth
  const validateEmail = () => validateEmailHook();

  const handleSubmit = async () => {
    if (!validateLiquidNetWorth() || !validateEmail()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Save to user_data table
      const userDataResponse = await fetch('/api/user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: userToken,
          email: email || undefined,
          name: userName,
          formType: 'retirement',
          formData: answers,
          expenseBuckets: customBuckets,
          sharedData: {
            liquidNetWorth: answers.liquidNetWorth,
            annualIncomeJob: answers.annualIncomeJob,
            otherIncome: answers.otherIncome,
            country: answers.country,
          },
        }),
      });

      const userDataResult = await userDataResponse.json();
      const finalToken = userDataResult.token || userToken;

      // Send admin notification email (using unified user_data format)
      const response = await fetch('/api/retirement/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          additionalInfo: finalNotes.trim() ? finalNotes.trim() : null,
          answers,
          expenseBuckets: customBuckets,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Don't fail the submission if admin email fails
        console.warn('Failed to send admin notification:', errorData.error);
      }

      // Update token if we got a new one
      if (finalToken && finalToken !== userToken) {
        setUserToken(finalToken);
        // Update URL with token for sharing
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

  const resetForm = () => {
    setStep(0);
    setShowCountryDropdown(false);
    setCustomBuckets(initialData?.expenseBuckets || null);
    setEmail('');
    setEmailError('');
    setLiquidNetWorthError('');
    setFinalNotes('');
    setIsSubmitting(false);
    setSubmitted(false);
    setShowSuccess(false);
    setAnswers({
      lifestyle: null,
      country: 'India',
      housing: null,
      healthcare: null,
      travel: null,
      safety: null,
      liquidNetWorth: null,
      annualIncomeJob: null,
      otherIncome: null,
      pension: null,
      liabilities: null,
    });
  };

  const handleAnswer = (question: keyof Answers, value: string) => {
    setAnswers((prev) => {
      const updated = { ...prev, [question]: value } as Answers;
      if (question === 'lifestyle') {
        const lifestyleKey = value as keyof typeof lifestyleToHousingDefault;
        const defaultHousing = lifestyleToHousingDefault[lifestyleKey];
        if (defaultHousing) {
          updated.housing = defaultHousing;
        }
      }
      
      // Auto-save after update
      setTimeout(() => {
        saveProgress(updated, customBuckets);
      }, 500);
      
      return updated;
    });

    if (question === 'country') {
      setShowCountryDropdown(false);
      return;
    }

    setTimeout(() => setStep(step + 1), 300);
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
      if (step === 1) {
        setShowCountryDropdown(false);
      }
    }
  };

  const expensesQuery = new URLSearchParams();
  if (userToken) expensesQuery.set('token', userToken);
  if (userName) expensesQuery.set('name', userName);
  const expensesUrl = expensesQuery.toString() ? `/expenses?${expensesQuery.toString()}` : '/expenses';
  const hasExpenseBuckets = customBuckets && Object.keys(customBuckets).length > 0 && Object.values(customBuckets).some((b) => b && typeof b.value === 'number');

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
              Thank you, let us continue the conversation over email
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-12">
        <h1 className={`text-2xl font-light tracking-tight ${theme.textClass}`}>Retirement Calculator</h1>
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
            onClick={handleBack}
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
            <h2 className={`text-3xl font-light mb-4 ${theme.textClass}`}>Imagine you are fully retired tomorrow.</h2>
            <p className={`text-lg mb-8 ${theme.textSecondaryClass}`}>
              Your money must last forever. How would you like to live?
            </p>
            <div className="space-y-3">
              {['Simple', 'Comfortable', 'Very Comfortable', 'Luxury'].map((option, idx) => (
                <button
                  key={option}
                  onClick={() => handleAnswer('lifestyle', option)}
                  className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
                    darkMode
                      ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700'
                      : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                  }`}
                >
                  <div className={`font-medium text-lg ${theme.textClass}`}>{String.fromCharCode(65 + idx)}. {option}</div>
                  <div className={`text-sm mt-1 ${theme.textSecondaryClass}`}>
                    {option === 'Simple' && 'Calm, basic, stress-free life'}
                    {option === 'Comfortable' && 'Middle/upper-middle lifestyle'}
                    {option === 'Very Comfortable' && 'High flexibility and travel'}
                    {option === 'Luxury' && 'No real constraints'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-6 ${theme.textClass}`}>Where will you spend most of your retired life?</h2>

            <div className="relative mb-8">
              <button
                onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                className={`w-full p-5 rounded-lg text-left transition-all flex items-center justify-between ${
                  darkMode
                    ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700'
                    : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{countryData[answers.country].flag}</span>
                  <span className={`font-medium text-lg ${theme.textClass}`}>{answers.country}</span>
                </div>
                <svg
                  className={`w-5 h-5 transition-transform ${showCountryDropdown ? 'rotate-180' : ''} ${theme.textClass}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showCountryDropdown && (
                <div className={`absolute z-10 w-full mt-2 rounded-lg shadow-xl ${
                  darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'
                }`}>
                  {getCountriesSorted().map((country) => (
                    <button
                      key={country}
                      onClick={() => handleAnswer('country', country)}
                      className={`w-full p-4 text-left transition-all flex items-center gap-3 hover:bg-opacity-50 ${
                        darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'
                      } ${country === answers.country ? (darkMode ? 'bg-slate-750' : 'bg-gray-50') : ''}`}
                    >
                      <span className="text-2xl">{countryData[country].flag}</span>
                      <span className={`font-medium ${theme.textClass}`}>{country}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Estimated expenses: single source on /expenses; here we show status and link only */}
            <div className={`p-6 rounded-lg mb-6 ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'}`}>
              <h3 className={`text-xl font-light mb-2 ${theme.textClass}`}>Estimated expenses</h3>
              {hasExpenseBuckets ? (
                <>
                  <p className={`text-sm mb-4 ${theme.textSecondaryClass}`}>
                    You&apos;ve set estimated expenses. Edit them on the Expenses page if needed.
                  </p>
                  <div className={`mb-4 flex justify-between items-center`}>
                    <span className={`text-lg font-medium ${theme.textClass}`}>Total monthly</span>
                    <span className="text-2xl font-light text-blue-500">
                      {formatCurrency(getTotalMonthlyExpenses(customBuckets!), countryData[answers.country].currency)}
                    </span>
                  </div>
                  <div className={`text-sm mb-4 ${theme.textSecondaryClass}`}>
                    Annual: {formatCurrency(getTotalMonthlyExpenses(customBuckets!) * 12, countryData[answers.country].currency)}
                  </div>
                  <Link
                    href={expensesUrl}
                    className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${theme.textSecondaryClass} hover:${theme.textClass}`}
                  >
                    Edit in Expenses
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </>
              ) : (
                <>
                  <p className={`text-sm mb-4 ${theme.textSecondaryClass}`}>
                    Add your estimated expenses first so we can plan your retirement needs.
                  </p>
                  <Link
                    href={expensesUrl}
                    className="inline-flex items-center gap-2 py-3 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors mb-4"
                  >
                    Add expenses
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <p className={`text-xs ${theme.textSecondaryClass}`}>
                    You can also skip for now and add them later.
                  </p>
                </>
              )}
            </div>

            <button
              onClick={() => setStep(step + 1)}
              className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-lg"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <HousingStep
            darkMode={darkMode}
            answers={answers}
            onSelect={(housing) => handleAnswer('housing', housing)}
          />
        )}

        {step === 3 && (
          <HealthcareStep
            darkMode={darkMode}
            onSelect={(healthcare) => handleAnswer('healthcare', healthcare)}
          />
        )}

        {step === 4 && (
          <TravelStep
            darkMode={darkMode}
            onSelect={(travel) => handleAnswer('travel', travel)}
          />
        )}

        {step === 5 && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-8 h-8 text-blue-500" />
              <h2 className={`text-3xl font-light ${theme.textClass}`}>Income & Assets</h2>
            </div>
            <p className={`text-sm mb-6 ${theme.textSecondaryClass}`}>
              Liquid net worth is required. All other fields are optional.
            </p>

            <div className="space-y-4">
              <div>
                <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${theme.textClass}`}>
                  Liquid Net Worth
                </label>
                <div className="relative">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
                    {countryData[answers.country].currency}
                  </span>
                  <input
                    type="text"
                    value={answers.liquidNetWorth ? formatInputValue(answers.liquidNetWorth, countryData[answers.country].currency) : ''}
                    onChange={(e) => {
                      const parsed = parseInputValue(e.target.value);
                      setAnswers((prev) => ({ ...prev, liquidNetWorth: parsed }));
                      if (liquidNetWorthError) {
                        setLiquidNetWorthError('');
                      }
                    }}
                    placeholder={countryData[answers.country].currency === '₹' ? 'e.g., 5,00,000' : countryData[answers.country].currency === '฿' ? 'e.g., 500,000' : 'e.g., 50,000'}
                    className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                      darkMode
                        ? 'bg-slate-800 border border-slate-700 text-gray-100'
                        : 'bg-white border border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
                {liquidNetWorthError && (
                  <p className="text-sm text-red-500 mt-2" role="alert">
                    {liquidNetWorthError}
                  </p>
                )}
              </div>

              <div>
                <label className={`text-sm font-medium mb-2 block ${theme.textClass}`}>
                  Annual Income from Job
                </label>
                <div className="relative">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
                    {countryData[answers.country].currency}
                  </span>
                  <input
                    type="text"
                    value={answers.annualIncomeJob ? formatInputValue(answers.annualIncomeJob, countryData[answers.country].currency) : ''}
                    onChange={(e) => {
                      const parsed = parseInputValue(e.target.value);
                      setAnswers((prev) => ({ ...prev, annualIncomeJob: parsed }));
                    }}
                    placeholder={countryData[answers.country].currency === '₹' ? 'e.g., 10,00,000' : countryData[answers.country].currency === '฿' ? 'e.g., 1,000,000' : 'e.g., 100,000'}
                    className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                      darkMode
                        ? 'bg-slate-800 border border-slate-700 text-gray-100'
                        : 'bg-white border border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>

              <div>
                <label className={`text-sm font-medium mb-2 block ${theme.textClass}`}>
                  Other Income
                </label>
                <div className="relative">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
                    {countryData[answers.country].currency}
                  </span>
                  <input
                    type="text"
                    value={answers.otherIncome ? formatInputValue(answers.otherIncome, countryData[answers.country].currency) : ''}
                    onChange={(e) => {
                      const parsed = parseInputValue(e.target.value);
                      setAnswers((prev) => ({ ...prev, otherIncome: parsed }));
                    }}
                    placeholder={countryData[answers.country].currency === '₹' ? 'e.g., 2,00,000' : countryData[answers.country].currency === '฿' ? 'e.g., 200,000' : 'e.g., 20,000'}
                    className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                      darkMode
                        ? 'bg-slate-800 border border-slate-700 text-gray-100'
                        : 'bg-white border border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>

              <div>
                <label className={`text-sm font-medium mb-2 block ${theme.textClass}`}>
                  Pension
                </label>
                <div className="relative">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
                    {countryData[answers.country].currency}
                  </span>
                  <input
                    type="text"
                    value={answers.pension ? formatInputValue(answers.pension, countryData[answers.country].currency) : ''}
                    onChange={(e) => {
                      const parsed = parseInputValue(e.target.value);
                      setAnswers((prev) => ({ ...prev, pension: parsed }));
                    }}
                    placeholder={countryData[answers.country].currency === '₹' ? 'e.g., 3,00,000' : countryData[answers.country].currency === '฿' ? 'e.g., 300,000' : 'e.g., 30,000'}
                    className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                      darkMode
                        ? 'bg-slate-800 border border-slate-700 text-gray-100'
                        : 'bg-white border border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>

              <div>
                <label className={`text-sm font-medium mb-2 block ${theme.textClass}`}>
                  Monthly Liabilities
                </label>
                <div className="relative">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textClass}`}>
                    {countryData[answers.country].currency}
                  </span>
                  <input
                    type="text"
                    value={answers.liabilities ? formatInputValue(answers.liabilities, countryData[answers.country].currency) : ''}
                    onChange={(e) => {
                      const parsed = parseInputValue(e.target.value);
                      setAnswers((prev) => ({ ...prev, liabilities: parsed }));
                    }}
                    placeholder={countryData[answers.country].currency === '₹' ? 'e.g., 50,000' : countryData[answers.country].currency === '฿' ? 'e.g., 50,000' : 'e.g., 5,000'}
                    className={`w-full pl-8 pr-4 py-3 rounded-lg ${
                      darkMode
                        ? 'bg-slate-800 border border-slate-700 text-gray-100'
                        : 'bg-white border border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (!validateLiquidNetWorth()) {
                  return;
                }
                setStep(step + 1);
              }}
              className="mt-6 w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-lg"
            >
              Continue
            </button>
          </div>
        )}

        {step === 6 && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-8 h-8 text-blue-500" />
              <h2 className={`text-3xl font-light ${theme.textClass}`}>How safe does your plan need to be?</h2>
            </div>
            <div className="space-y-3">
              {[
                { key: 'ultra_safe', letter: 'A', label: 'Ultra Safe', desc: 'I never want to worry' },
                { key: 'safe', letter: 'B', label: 'Safe', desc: 'Very conservative approach' },
                { key: 'balanced', letter: 'C', label: 'Balanced', desc: 'Balanced & realistic' },
                { key: 'aggressive', letter: 'D', label: 'Aggressive', desc: "I'm okay with some risk" },
              ].map((option) => (
                <button
                  key={option.key}
                  onClick={() => {
                    handleAnswer('safety', option.key);
                    setTimeout(() => setStep(step + 1), 300);
                  }}
                  className={`w-full p-5 rounded-lg text-left transition-all transform hover:scale-102 ${
                    darkMode
                      ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700'
                      : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                  }`}
                >
                  <div className={`font-medium text-lg ${theme.textClass}`}>{option.letter}. {option.label}</div>
                  <div className={`text-sm mt-1 ${theme.textSecondaryClass}`}>
                    {option.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="animate-fade-in">
            <h2 className={`text-3xl font-light mb-4 ${theme.textClass}`}>Where should we send your summary?</h2>
            <p className={`text-sm mb-6 ${theme.textSecondaryClass}`}>
              We'll review the full details and reply manually.
            </p>
            {!userToken && (
              <div className="mb-4">
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
            {userToken && (
              <p className={`text-sm mb-6 ${theme.textSecondaryClass}`}>
                Your data will be saved automatically.
              </p>
            )}
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${theme.textClass}`}>
                Anything else we should know?
              </label>
              <textarea
                value={finalNotes}
                onChange={(e) => setFinalNotes(e.target.value)}
                rows={3}
                placeholder="Share any extra context you'd like us to review."
                className={`w-full px-4 py-3 rounded-lg ${
                  darkMode
                    ? 'bg-slate-800 border border-slate-700 text-gray-100'
                    : 'bg-white border border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-lg"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
            <button
              onClick={resetForm}
              className={`mt-4 w-full py-3 rounded-lg transition-colors ${
                darkMode
                  ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700'
                  : 'bg-white hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Start Over
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
