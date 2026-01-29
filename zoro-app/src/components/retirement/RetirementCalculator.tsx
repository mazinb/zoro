'use client';

import React, { useState, useEffect } from 'react';
import { Shield, TrendingUp, Check } from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { RETIREMENT_CONFIG } from './retirementConfig';
import { ExpenseBucket, Answers } from './types';
import { countryData, getCountriesSorted } from './countryData';
import { formatCurrency, formatInputValue, parseInputValue, isValueInRange, getTotalMonthlyExpenses } from './utils';
import { HousingStep } from './steps/HousingStep';
import { HealthcareStep } from './steps/HealthcareStep';
import { TravelStep } from './steps/TravelStep';
import { AnimatedZoroLogo } from '@/components/AnimatedZoroLogo';

const { lifestyleToHousingDefault } = RETIREMENT_CONFIG;

interface RetirementCalculatorProps {
  initialData?: {
    answers?: Partial<Answers>;
    expenseBuckets?: Record<string, ExpenseBucket>;
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
  const [customBuckets, setCustomBuckets] = useState<Record<string, ExpenseBucket> | null>(
    initialData?.expenseBuckets || null
  );
  const [showExpenses, setShowExpenses] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [liquidNetWorthError, setLiquidNetWorthError] = useState('');
  const [finalNotes, setFinalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [userToken, setUserToken] = useState<string | undefined>(propUserToken);
  const [userName, setUserName] = useState<string | undefined>(propUserName);

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

  // Auto-save function
  const saveProgress = async (answersToSave: Answers, bucketsToSave: Record<string, ExpenseBucket> | null) => {
    if (!userToken && !email) return; // Don't save if no identifier
    
    try {
      await fetch('/api/user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: userToken,
          email: email || undefined,
          name: userName,
          formType: 'retirement',
          formData: answersToSave,
          expenseBuckets: bucketsToSave,
          sharedData: {
            // Cross-populate shared data
            liquidNetWorth: answersToSave.liquidNetWorth,
            annualIncomeJob: answersToSave.annualIncomeJob,
            otherIncome: answersToSave.otherIncome,
            country: answersToSave.country,
          },
        }),
      });
    } catch (error) {
      // Silently fail - don't interrupt user flow
      console.error('Failed to save progress:', error);
    }
  };

  // Save expense buckets separately when they change
  useEffect(() => {
    if (customBuckets && (userToken || email)) {
      const saveBuckets = async () => {
        try {
          await fetch('/api/user-data', {
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
        } catch (error) {
          console.error('Failed to save buckets:', error);
        }
      };
      
      // Debounce bucket saves
      const timeoutId = setTimeout(saveBuckets, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [customBuckets, userToken, email, userName, answers]);

  const validateLiquidNetWorth = (): boolean => {
    const value = parseFloat(answers.liquidNetWorth || '0') || 0;
    if (value <= 0) {
      setLiquidNetWorthError('Please enter a non-zero liquid net worth');
      return false;
    }
    setLiquidNetWorthError('');
    return true;
  };

  const validateEmail = (): boolean => {
    const trimmed = email.trim();
    const ok = /.+@.+\..+/.test(trimmed);
    if (!ok) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

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
          email,
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

      // Also save to retirement_leads for backward compatibility
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
        throw new Error(errorData.error || 'Failed to submit');
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
    setShowExpenses(false);
    setCustomBuckets(null);
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
      setCustomBuckets({ ...countryData[value].buckets });
      setShowCountryDropdown(false);
      setShowExpenses(true);
      return;
    }

    setTimeout(() => setStep(step + 1), 300);
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
      if (step === 1) {
        setShowCountryDropdown(false);
        setShowExpenses(false);
      }
    }
  };

  const initializeCustomBuckets = () => {
    if (!customBuckets) {
      const country = countryData[answers.country] || countryData['Other'];
      const buckets: Record<string, ExpenseBucket> = {
        food: country.buckets.food,
        transportation: country.buckets.transportation,
        entertainment: country.buckets.entertainment,
        other: country.buckets.other,
      };
      setCustomBuckets(buckets);
    }
  };

  const handleContinueToExpenses = () => {
    initializeCustomBuckets();
    setShowExpenses(true);
  };

  const handleBucketChange = (bucketKey: string, newValue: string) => {
    const numValue = parseFloat(newValue) || 0;
    setCustomBuckets((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [bucketKey]: { ...prev[bucketKey], value: numValue },
      };
    });
  };

  const handleSliderChange = (bucketKey: string, newValue: string) => {
    setCustomBuckets((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [bucketKey]: { ...prev[bucketKey], value: parseFloat(newValue) },
      };
    });
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

            {showExpenses && customBuckets && (
              <div className={`p-6 rounded-lg mb-6 ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'}`}>
                <h3 className={`text-xl font-light mb-2 ${theme.textClass}`}>Review Monthly Expenses</h3>
                <p className={`text-sm mb-6 ${theme.textSecondaryClass}`}>
                  Adjust these values to match your expected lifestyle
                </p>

                <div className="space-y-6">
                  {Object.entries(customBuckets).map(([key, bucket]) => {
                    const inRange = bucket.min && bucket.max ? isValueInRange(bucket.value, bucket) : true;
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex justify-between items-center mb-1">
                          <label className={`text-sm font-medium ${theme.textClass}`}>
                            {bucket.label}
                          </label>
                          <input
                            type="number"
                            value={bucket.value}
                            onChange={(e) => handleBucketChange(key, e.target.value)}
                            className={`w-32 px-3 py-2 rounded text-sm font-medium ${
                              darkMode
                                ? 'bg-slate-900 border border-slate-600 text-gray-100'
                                : 'bg-gray-100 border border-gray-300 text-gray-900'
                            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                          />
                        </div>
                        {bucket.min !== undefined && bucket.max !== undefined && (
                          <div className="space-y-1">
                            <input
                              type="range"
                              min={bucket.min}
                              max={bucket.max}
                              step={bucket.step || 1}
                              value={inRange ? bucket.value : bucket.min}
                              onChange={(e) => handleSliderChange(key, e.target.value)}
                              disabled={!inRange}
                              className={`w-full h-2 rounded-lg appearance-none cursor-pointer slider ${
                                !inRange ? 'opacity-30 cursor-not-allowed' : ''
                              }`}
                              style={{
                                background: inRange
                                  ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((bucket.value - bucket.min) / (bucket.max - bucket.min)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} ${((bucket.value - bucket.min) / (bucket.max - bucket.min)) * 100}%, ${darkMode ? '#4b5563' : '#d1d5db'} 100%)`
                                  : darkMode ? '#4b5563' : '#d1d5db'
                              }}
                            />
                            <div className={`flex justify-between text-xs ${theme.textSecondaryClass}`}>
                              <span>{formatCurrency(bucket.min, countryData[answers.country].currency)}</span>
                              <span>{formatCurrency(bucket.max, countryData[answers.country].currency)}</span>
                            </div>
                          </div>
                        )}
                        {!inRange && bucket.min !== undefined && bucket.max !== undefined && (
                          <p className={`text-xs ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                            Value outside range - slider disabled
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className={`mt-6 pt-6 border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-lg font-medium ${theme.textClass}`}>Total Monthly</span>
                    <span className="text-2xl font-light text-blue-500">
                      {formatCurrency(getTotalMonthlyExpenses(customBuckets), countryData[answers.country].currency)}
                    </span>
                  </div>
                  <div className={`text-sm mt-2 ${theme.textSecondaryClass}`}>
                    Annual: {formatCurrency(getTotalMonthlyExpenses(customBuckets) * 12, countryData[answers.country].currency)}
                  </div>
                </div>
              </div>
            )}

            {!showExpenses ? (
              <button
                onClick={handleContinueToExpenses}
                className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-lg"
              >
                Review Expenses
              </button>
            ) : (
              <button
                onClick={() => setStep(step + 1)}
                className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-lg"
              >
                Continue
              </button>
            )}
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
                    placeholder={countryData[answers.country].currency === '₹' ? '5,00,000' : countryData[answers.country].currency === '฿' ? '500,000' : '50,000'}
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
                    placeholder={countryData[answers.country].currency === '₹' ? '10,00,000' : countryData[answers.country].currency === '฿' ? '1,000,000' : '100,000'}
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
                    placeholder={countryData[answers.country].currency === '₹' ? '2,00,000' : countryData[answers.country].currency === '฿' ? '200,000' : '20,000'}
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
                    placeholder={countryData[answers.country].currency === '₹' ? '3,00,000' : countryData[answers.country].currency === '฿' ? '300,000' : '30,000'}
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
                    placeholder={countryData[answers.country].currency === '₹' ? '50,000' : countryData[answers.country].currency === '฿' ? '50,000' : '5,000'}
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
